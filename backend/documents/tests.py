from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Document, Folder

User = get_user_model()


class AuthenticatedAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="S3curePass!23")
        self.other_user = User.objects.create_user(email="other@example.com", password="S3curePass!23")
        access = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")


class FolderTests(AuthenticatedAPITestCase):
    def test_create_folder(self):
        response = self.client.post(reverse("folder-list"), {"name": "Work"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Folder.objects.get().owner, self.user)

    def test_list_only_shows_own_folders(self):
        Folder.objects.create(name="Mine", owner=self.user)
        Folder.objects.create(name="Not mine", owner=self.other_user)
        response = self.client.get(reverse("folder-list"))
        names = [f["name"] for f in response.data["results"]]
        self.assertEqual(names, ["Mine"])

    def test_cannot_nest_folder_under_someone_elses_folder(self):
        other_folder = Folder.objects.create(name="Their folder", owner=self.other_user)
        response = self.client.post(
            reverse("folder-list"), {"name": "Mine", "parent": str(other_folder.id)}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_nest_folder_inside_itself(self):
        folder = Folder.objects.create(name="Loop", owner=self.user)
        response = self.client.patch(
            reverse("folder-detail", args=[folder.id]), {"parent": str(folder.id)}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rename_folder(self):
        folder = Folder.objects.create(name="Old name", owner=self.user)
        response = self.client.patch(reverse("folder-detail", args=[folder.id]), {"name": "New name"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folder.refresh_from_db()
        self.assertEqual(folder.name, "New name")

    def test_delete_folder(self):
        folder = Folder.objects.create(name="Gone soon", owner=self.user)
        response = self.client.delete(reverse("folder-detail", args=[folder.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Folder.objects.filter(id=folder.id).exists())


class DocumentTests(AuthenticatedAPITestCase):
    def test_create_document(self):
        response = self.client.post(reverse("document-list"), {"title": "My doc"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        doc = Document.objects.get()
        self.assertEqual(doc.owner, self.user)
        self.assertEqual(doc.title, "My doc")

    def test_list_only_shows_own_documents(self):
        Document.objects.create(title="Mine", owner=self.user)
        Document.objects.create(title="Not mine", owner=self.other_user)
        response = self.client.get(reverse("document-list"))
        titles = [d["title"] for d in response.data["results"]]
        self.assertEqual(titles, ["Mine"])

    def test_soft_deleted_documents_excluded_from_list(self):
        doc = Document.objects.create(title="Deleted", owner=self.user)
        self.client.delete(reverse("document-detail", args=[doc.id]))
        response = self.client.get(reverse("document-list"))
        self.assertEqual(response.data["results"], [])

    def test_soft_delete_keeps_the_row(self):
        doc = Document.objects.create(title="Deleted", owner=self.user)
        response = self.client.delete(reverse("document-detail", args=[doc.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        doc.refresh_from_db()
        self.assertIsNotNone(doc.deleted_at)

    def test_cannot_delete_someone_elses_document(self):
        doc = Document.objects.create(title="Theirs", owner=self.other_user)
        response = self.client.delete(reverse("document-detail", args=[doc.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_rename_document(self):
        doc = Document.objects.create(title="Old title", owner=self.user)
        response = self.client.patch(reverse("document-detail", args=[doc.id]), {"title": "New title"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        doc.refresh_from_db()
        self.assertEqual(doc.title, "New title")

    def test_filter_by_root_excludes_documents_in_folders(self):
        folder = Folder.objects.create(name="Folder", owner=self.user)
        Document.objects.create(title="In folder", owner=self.user, folder=folder)
        Document.objects.create(title="At root", owner=self.user)
        response = self.client.get(reverse("document-list"), {"folder": "root"})
        titles = [d["title"] for d in response.data["results"]]
        self.assertEqual(titles, ["At root"])

    def test_cannot_assign_document_to_someone_elses_folder(self):
        other_folder = Folder.objects.create(name="Theirs", owner=self.other_user)
        response = self.client.post(
            reverse("document-list"), {"title": "Sneaky", "folder": str(other_folder.id)}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_request_rejected(self):
        self.client.credentials()
        response = self.client.get(reverse("document-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
