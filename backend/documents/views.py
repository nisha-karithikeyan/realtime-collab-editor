import logging

from django.utils import timezone
from rest_framework import permissions, viewsets

from .models import Document, Folder
from .serializers import DocumentSerializer, FolderSerializer

logger = logging.getLogger(__name__)


class FolderViewSet(viewsets.ModelViewSet):
    serializer_class = FolderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Folder.objects.filter(owner=self.request.user)

    def perform_destroy(self, instance):
        logger.info("folder_deleted", extra={"folder_id": str(instance.id)})
        instance.delete()


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Document.objects.filter(owner=self.request.user, deleted_at__isnull=True)

        folder_id = self.request.query_params.get("folder")
        if folder_id == "root":
            queryset = queryset.filter(folder__isnull=True)
        elif folder_id:
            queryset = queryset.filter(folder_id=folder_id)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(title__icontains=search)

        return queryset

    def perform_destroy(self, instance):
        # Soft delete: the row stays (and its Yjs state/snapshots from
        # slice 3+ stay with it) so a future "trash" / restore feature has
        # something to work with, and nothing is silently unrecoverable.
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])
        logger.info("document_deleted", extra={"document_id": str(instance.id)})
