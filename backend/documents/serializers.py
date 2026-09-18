from rest_framework import serializers

from .models import Comment, Document, Folder, Link


class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ["id", "name", "parent", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_parent(self, parent):
        if parent is None:
            return parent

        request = self.context["request"]
        if parent.owner_id != request.user.id:
            raise serializers.ValidationError("You don't have access to that parent folder.")

        # Prevent a folder from becoming its own ancestor (would create a
        # cycle that breaks any tree walk of the folder structure).
        instance = self.instance
        if instance is not None:
            node = parent
            while node is not None:
                if node.pk == instance.pk:
                    raise serializers.ValidationError("A folder can't be nested inside itself.")
                node = node.parent
        return parent

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


def _validate_no_cycle(instance, candidate_parent, field_label):
    """Shared cycle guard for both Folder.parent and Document.parent_page:
    walk up from the candidate parent and reject if we hit the instance
    being saved."""
    if instance is None or candidate_parent is None:
        return
    node = candidate_parent
    while node is not None:
        if node.pk == instance.pk:
            raise serializers.ValidationError(f"A {field_label} can't be nested inside itself.")
        node = node.parent_page if hasattr(node, "parent_page") else node.parent


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ["id", "title", "folder", "parent_page", "tags", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_folder(self, folder):
        if folder is None:
            return folder
        request = self.context["request"]
        if folder.owner_id != request.user.id:
            raise serializers.ValidationError("You don't have access to that folder.")
        return folder

    def validate_parent_page(self, parent_page):
        if parent_page is None:
            return parent_page
        request = self.context["request"]
        if parent_page.owner_id != request.user.id:
            raise serializers.ValidationError("You don't have access to that page.")
        _validate_no_cycle(self.instance, parent_page, "page")
        return parent_page

    def validate_tags(self, tags):
        if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
            raise serializers.ValidationError("Tags must be a list of strings.")
        # Normalize: dedupe, strip, drop empties - keeps the tag browser
        # from splitting "Project" and "project" into two buckets.
        seen = []
        for tag in tags:
            cleaned = tag.strip().lower()
            if cleaned and cleaned not in seen:
                seen.append(cleaned)
        return seen

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class DocumentTreeSerializer(serializers.ModelSerializer):
    """Lightweight shape for the sidebar page tree - fetched once for all
    owned documents, tree built client-side, same pattern as Folder."""

    class Meta:
        model = Document
        fields = ["id", "title", "parent_page", "folder"]


class LinkTargetSerializer(serializers.Serializer):
    to_document_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=True)


class BacklinkSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="from_document.id")
    title = serializers.CharField(source="from_document.title")

    class Meta:
        model = Link
        fields = ["id", "title"]


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.name", read_only=True)
    author_id = serializers.UUIDField(source="author.id", read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "document",
            "block_id",
            "author_id",
            "author_name",
            "body",
            "mentioned_user_ids",
            "parent_comment",
            "resolved",
            "created_at",
        ]
        read_only_fields = ["id", "author_id", "author_name", "created_at"]

    def validate_document(self, document):
        request = self.context["request"]
        if document.owner_id != request.user.id:
            raise serializers.ValidationError("You don't have access to that document.")
        return document

    def create(self, validated_data):
        validated_data["author"] = self.context["request"].user
        return super().create(validated_data)
