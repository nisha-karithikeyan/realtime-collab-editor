import logging
from collections import defaultdict

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Comment, Document, Folder, Link
from .serializers import (
    BacklinkSerializer,
    CommentSerializer,
    DocumentSerializer,
    DocumentTreeSerializer,
    FolderSerializer,
    LinkTargetSerializer,
)

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

        parent_page_id = self.request.query_params.get("parent_page")
        if parent_page_id == "root":
            queryset = queryset.filter(parent_page__isnull=True)
        elif parent_page_id:
            queryset = queryset.filter(parent_page_id=parent_page_id)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(title__icontains=search)

        return queryset

    def perform_destroy(self, instance):
        # Soft delete: the row (and its CRDT state/snapshots/links/
        # comments) stays, so a future "trash"/restore feature has
        # something to work with, and nothing is silently unrecoverable.
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])
        logger.info("document_deleted", extra={"document_id": str(instance.id)})

    @action(detail=False, methods=["get"], url_path="page-tree")
    def page_tree(self, request):
        """All owned, non-deleted documents in the flat shape the sidebar
        needs to build its nested-page tree client-side - same pattern
        slice 2 used for folders."""
        queryset = Document.objects.filter(owner=request.user, deleted_at__isnull=True)
        return Response(DocumentTreeSerializer(queryset, many=True).data)

    @action(detail=False, methods=["get"], url_path="tags")
    def tag_browser(self, request):
        """Every tag in use across the user's documents, with which
        documents carry it - powers the tag browser/filter."""
        queryset = Document.objects.filter(owner=request.user, deleted_at__isnull=True)
        by_tag = defaultdict(list)
        for doc in queryset.only("id", "title", "tags"):
            for tag in doc.tags:
                by_tag[tag].append({"id": str(doc.id), "title": doc.title})
        results = [
            {"tag": tag, "documents": docs} for tag, docs in sorted(by_tag.items())
        ]
        return Response(results)

    @action(detail=True, methods=["put"], url_path="links")
    def set_links(self, request, pk=None):
        """Replace this document's outgoing wiki-links. The client parses
        [[...]] references out of the block content (backend never
        touches CRDT internals) and reports the resulting target document
        ids here; this is also what populates targets' backlink panels."""
        document = self.get_object()
        serializer = LinkTargetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_ids = serializer.validated_data["to_document_ids"]

        valid_targets = set(
            Document.objects.filter(
                id__in=target_ids, owner=request.user, deleted_at__isnull=True
            ).values_list("id", flat=True)
        )

        Link.objects.filter(from_document=document).exclude(to_document_id__in=valid_targets).delete()
        existing = set(
            Link.objects.filter(from_document=document).values_list("to_document_id", flat=True)
        )
        Link.objects.bulk_create(
            [
                Link(from_document=document, to_document_id=target_id)
                for target_id in valid_targets
                if target_id not in existing
            ]
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="backlinks")
    def backlinks(self, request, pk=None):
        document = self.get_object()
        links = Link.objects.filter(to_document=document).select_related("from_document")
        return Response(BacklinkSerializer(links, many=True).data)

    @action(detail=False, methods=["get"], url_path="graph")
    def graph(self, request):
        """Every owned document as a node and every link between two
        owned documents as an edge - the full dataset the graph view
        force-simulates client-side."""
        docs = list(Document.objects.filter(owner=request.user, deleted_at__isnull=True))
        doc_ids = {d.id for d in docs}
        nodes = [{"id": str(d.id), "title": d.title, "tags": d.tags} for d in docs]
        edges = [
            {"source": str(link.from_document_id), "target": str(link.to_document_id)}
            for link in Link.objects.filter(from_document_id__in=doc_ids, to_document_id__in=doc_ids)
        ]
        return Response({"nodes": nodes, "edges": edges})


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Comment.objects.filter(document__owner=self.request.user)
        document_id = self.request.query_params.get("document")
        if document_id:
            queryset = queryset.filter(document_id=document_id)
        return queryset
