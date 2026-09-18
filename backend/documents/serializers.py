from rest_framework import serializers

from .models import Document, Folder


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


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ["id", "title", "folder", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_folder(self, folder):
        if folder is None:
            return folder
        request = self.context["request"]
        if folder.owner_id != request.user.id:
            raise serializers.ValidationError("You don't have access to that folder.")
        return folder

    def create(self, validated_data):
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)
