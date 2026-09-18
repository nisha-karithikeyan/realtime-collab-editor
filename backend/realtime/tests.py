from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from pycrdt import Doc, Map
from rest_framework_simplejwt.tokens import RefreshToken

from core.asgi import application
from documents.models import Document, DocumentSnapshot, DocumentState

User = get_user_model()


class EditorConsumerTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@example.com", password="S3curePass!23")
        self.stranger = User.objects.create_user(email="stranger@example.com", password="S3curePass!23")
        self.document = Document.objects.create(title="Live doc", owner=self.owner)
        self.owner_token = str(RefreshToken.for_user(self.owner).access_token)
        self.stranger_token = str(RefreshToken.for_user(self.stranger).access_token)

    def _url(self, token):
        return f"/ws/documents/{self.document.id}/?token={token}"

    def _communicator(self, path):
        # AllowedHostsOriginValidator requires an Origin header (every
        # real browser sends one on WS connections; the test client
        # doesn't by default).
        return WebsocketCommunicator(
            application, path, headers=[(b"origin", b"http://localhost:4200")]
        )

    async def test_connect_sends_initial_state(self):
        communicator = self._communicator(self._url(self.owner_token))
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        initial = await communicator.receive_from()
        self.assertIsInstance(initial, bytes)  # empty doc's update - harmless to apply

        await communicator.disconnect()

    async def test_rejects_connection_from_non_owner(self):
        communicator = self._communicator(self._url(self.stranger_token))
        connected, close_code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(close_code, 4404)

    async def test_rejects_connection_without_token(self):
        communicator = self._communicator(f"/ws/documents/{self.document.id}/")
        connected, close_code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(close_code, 4401)

    async def test_update_from_one_client_persists_and_broadcasts_to_another(self):
        client_a = self._communicator(self._url(self.owner_token))
        client_b = self._communicator(self._url(self.owner_token))

        await client_a.connect()
        await client_a.receive_from()  # initial empty state
        await client_b.connect()
        await client_b.receive_from()  # initial empty state

        # Simulate client A's local Yjs edit and send the update.
        doc = Doc()
        ymap = Map()
        doc["blocks"] = ymap
        ymap["title"] = "Hello from A"
        update = doc.get_update()

        await client_a.send_to(bytes_data=update)

        # Client B should receive the rebroadcast update (not A itself).
        received = await client_b.receive_from()
        self.assertEqual(received, update)

        # And it should be persisted for the next connecting client.
        state = await DocumentState.objects.aget(document=self.document)
        self.assertEqual(bytes(state.ydoc_update), update)
        self.assertEqual(state.update_count, 1)

        await client_a.disconnect()
        await client_b.disconnect()

    async def test_reconnecting_client_receives_previously_persisted_state(self):
        state = await DocumentState.objects.acreate(document=self.document)
        doc = Doc()
        m = Map()
        doc["blocks"] = m
        m["existing"] = "already saved"
        seed_update = doc.get_update()
        state.ydoc_update = seed_update
        await state.asave()

        communicator = self._communicator(self._url(self.owner_token))
        await communicator.connect()
        initial = await communicator.receive_from()
        self.assertEqual(initial, seed_update)
        await communicator.disconnect()

    async def test_snapshot_created_every_n_updates(self):
        sender = self._communicator(self._url(self.owner_token))
        await sender.connect()
        await sender.receive_from()

        # A second, silent listener: since persistence is awaited before
        # the broadcast is sent (see _handle_sync_update), receiving the
        # Nth broadcast here guarantees the Nth persist_state() - and any
        # snapshot it triggered - has already completed, avoiding a race
        # against the sender's own fire-and-forget send_to() calls.
        listener = self._communicator(self._url(self.owner_token))
        await listener.connect()
        await listener.receive_from()

        doc = Doc()
        m = Map()
        doc["blocks"] = m
        for i in range(50):
            m[f"key{i}"] = f"value{i}"
            await sender.send_to(bytes_data=doc.get_update())
            await listener.receive_from()

        snapshot_count = await DocumentSnapshot.objects.filter(document=self.document).acount()
        self.assertEqual(snapshot_count, 1)

        await sender.disconnect()
        await listener.disconnect()
