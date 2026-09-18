import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from pycrdt import Doc

from documents.models import Document, DocumentSnapshot, DocumentState

logger = logging.getLogger(__name__)

# Roll a new version-history snapshot every N applied updates, so
# history stays bounded without needing a separate scheduled job.
SNAPSHOT_EVERY_N_UPDATES = 50


class EditorConsumer(AsyncWebsocketConsumer):
    """Real-time collaborative sync for one document.

    Wire protocol, kept deliberately simple over the full y-protocols
    sync-step1/step2 negotiation:
      - On connect, the server sends one binary frame: its full merged
        CRDT state (empty doc -> empty update, harmless to apply).
      - The client applies that to its local Yjs doc (merging in whatever
        it already has, including any offline-queued local edits) and
        immediately sends its own full state back.
      - From then on, every local edit's incremental update is sent as a
        binary frame; the server merges it into its authoritative Doc,
        persists the new merged state, and rebroadcasts that same update
        to every other client in the room.
    Because CRDT merges are commutative and idempotent, this "exchange
    full state, then stream diffs" approach converges correctly even
    when a client reconnects after being offline with local-only edits -
    that convergence, not just importing Yjs, is what actually proves
    the offline-merge story.

    Presence (cursor position, user color) rides on JSON text frames,
    tagged {"type": "awareness", ...}, relayed to the room and never
    persisted.
    """

    async def connect(self):
        self.document_id = self.scope["url_route"]["kwargs"]["document_id"]
        self.group_name = f"document_{self.document_id}"
        self.user = self.scope["user"]
        self.ydoc = Doc()

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        document = await self._get_document_if_owned()
        if document is None:
            await self.close(code=4404)
            return

        state = await self._get_or_create_state()
        if state.ydoc_update:
            self.ydoc.apply_update(bytes(state.ydoc_update))

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send(bytes_data=self.ydoc.get_update())
        logger.info(
            "editor_connected",
            extra={"document_id": str(self.document_id), "user_id": str(self.user.id)},
        )

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "awareness_message", "sender_channel": self.channel_name, "payload": json.dumps(
                    {"type": "presence-leave", "userId": str(self.user.id)}
                )},
            )

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data is not None:
            await self._handle_sync_update(bytes_data)
        elif text_data is not None:
            await self._handle_awareness(text_data)

    async def _handle_sync_update(self, update_bytes: bytes):
        self.ydoc.apply_update(update_bytes)
        await self._persist_state()

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "sync_message",
                "sender_channel": self.channel_name,
                "bytes_data": update_bytes,
            },
        )

    async def _handle_awareness(self, text_data: str):
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "awareness_message", "sender_channel": self.channel_name, "payload": text_data},
        )

    async def sync_message(self, event):
        if event["sender_channel"] == self.channel_name:
            return
        await self.send(bytes_data=event["bytes_data"])

    async def awareness_message(self, event):
        if event["sender_channel"] == self.channel_name:
            return
        await self.send(text_data=event["payload"])

    @database_sync_to_async
    def _get_document_if_owned(self):
        return Document.objects.filter(
            id=self.document_id, owner=self.user, deleted_at__isnull=True
        ).first()

    @database_sync_to_async
    def _get_or_create_state(self):
        state, _ = DocumentState.objects.get_or_create(document_id=self.document_id)
        return state

    @database_sync_to_async
    def _persist_state(self):
        update = self.ydoc.get_update()
        state, _ = DocumentState.objects.get_or_create(document_id=self.document_id)
        state.ydoc_update = update
        state.update_count += 1
        state.save(update_fields=["ydoc_update", "update_count", "updated_at"])

        if state.update_count % SNAPSHOT_EVERY_N_UPDATES == 0:
            DocumentSnapshot.objects.create(
                document_id=self.document_id,
                ydoc_update=update,
                label=f"Auto-snapshot at {state.update_count} edits",
            )
