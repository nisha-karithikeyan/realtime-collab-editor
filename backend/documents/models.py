import uuid

from django.conf import settings
from django.db import models


class Folder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="folders"
    )
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255, default="Untitled document")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_documents"
    )
    folder = models.ForeignKey(
        Folder, on_delete=models.SET_NULL, null=True, blank=True, related_name="documents"
    )
    # Notion-style sub-pages: independent from `folder` (coarse
    # organization) - a page can live in a folder AND have child pages
    # nested under it, shown as an expandable tree in the sidebar.
    parent_page = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="subpages"
    )
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.title} ({self.id})"


class DocumentState(models.Model):
    """Latest merged Yjs CRDT state for a document (opaque binary - the
    backend never parses block structure, it only merges/persists updates
    so a new collaborator can bootstrap without replaying full history)."""

    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name="state")
    ydoc_update = models.BinaryField()
    updated_at = models.DateTimeField(auto_now=True)
    update_count = models.PositiveIntegerField(default=0)


class DocumentSnapshot(models.Model):
    """Named point-in-time snapshot of the CRDT state, for version history
    / rollback."""

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="snapshots")
    ydoc_update = models.BinaryField()
    label = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Link(models.Model):
    """A bidirectional-wiki-link edge, extracted client-side from a
    document's block content and reported to the backend whenever the
    source document saves. `to_document`'s backlinks panel is just the
    reverse FK query - no separate backlink table needed."""

    from_document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="outgoing_links")
    to_document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="incoming_links")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("from_document", "to_document")


class Comment(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="comments")
    # The Yjs block's stable node id (a UUID string assigned client-side
    # when a block is created), so a comment stays anchored to its block
    # across reorders/edits instead of a fragile index.
    block_id = models.CharField(max_length=64)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.TextField()
    mentioned_user_ids = models.JSONField(default=list, blank=True)
    parent_comment = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies"
    )
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
