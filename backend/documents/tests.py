from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Comment, Document, Folder, Link

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

    def test_cannot_nest_page_inside_itself(self):
        doc = Document.objects.create(title="Loop", owner=self.user)
        response = self.client.patch(
            reverse("document-detail", args=[doc.id]), {"parent_page": str(doc.id)}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_nest_page_under_someone_elses_page(self):
        their_doc = Document.objects.create(title="Theirs", owner=self.other_user)
        response = self.client.post(
            reverse("document-list"), {"title": "Mine", "parent_page": str(their_doc.id)}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tags_normalized_on_save(self):
        response = self.client.post(
            reverse("document-list"),
            {"title": "Tagged", "tags": [" Project ", "project", "URGENT", ""]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["tags"], ["project", "urgent"])


class PageTreeTests(AuthenticatedAPITestCase):
    def test_page_tree_returns_only_own_documents_flat(self):
        parent = Document.objects.create(title="Parent", owner=self.user)
        Document.objects.create(title="Child", owner=self.user, parent_page=parent)
        Document.objects.create(title="Not mine", owner=self.other_user)

        response = self.client.get(reverse("document-page-tree"))
        titles = {d["title"] for d in response.data}
        self.assertEqual(titles, {"Parent", "Child"})

    def test_page_tree_excludes_soft_deleted(self):
        doc = Document.objects.create(title="Gone", owner=self.user)
        self.client.delete(reverse("document-detail", args=[doc.id]))
        response = self.client.get(reverse("document-page-tree"))
        self.assertEqual(response.data, [])


class TagBrowserTests(AuthenticatedAPITestCase):
    def test_aggregates_tags_across_documents(self):
        Document.objects.create(title="A", owner=self.user, tags=["work", "urgent"])
        Document.objects.create(title="B", owner=self.user, tags=["work"])
        Document.objects.create(title="Not mine", owner=self.other_user, tags=["work"])

        response = self.client.get(reverse("document-tag-browser"))
        by_tag = {row["tag"]: row["documents"] for row in response.data}

        self.assertEqual(len(by_tag["work"]), 2)
        self.assertEqual(len(by_tag["urgent"]), 1)


class LinkTests(AuthenticatedAPITestCase):
    def test_set_links_creates_and_prunes(self):
        source = Document.objects.create(title="Source", owner=self.user)
        target_a = Document.objects.create(title="Target A", owner=self.user)
        target_b = Document.objects.create(title="Target B", owner=self.user)

        response = self.client.put(
            reverse("document-set-links", args=[source.id]),
            {"to_document_ids": [str(target_a.id), str(target_b.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Link.objects.filter(from_document=source).count(), 2)

        # Re-set with only target_a: target_b's link should be pruned.
        response = self.client.put(
            reverse("document-set-links", args=[source.id]),
            {"to_document_ids": [str(target_a.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        remaining = Link.objects.filter(from_document=source)
        self.assertEqual(list(remaining.values_list("to_document_id", flat=True)), [target_a.id])

    def test_set_links_ignores_documents_you_do_not_own(self):
        source = Document.objects.create(title="Source", owner=self.user)
        their_doc = Document.objects.create(title="Theirs", owner=self.other_user)

        self.client.put(
            reverse("document-set-links", args=[source.id]),
            {"to_document_ids": [str(their_doc.id)]},
            format="json",
        )
        self.assertEqual(Link.objects.filter(from_document=source).count(), 0)

    def test_graph_returns_nodes_and_edges_scoped_to_owner(self):
        a = Document.objects.create(title="A", owner=self.user)
        b = Document.objects.create(title="B", owner=self.user)
        their_doc = Document.objects.create(title="Theirs", owner=self.other_user)
        Link.objects.create(from_document=a, to_document=b)

        response = self.client.get(reverse("document-graph"))
        node_ids = {n["id"] for n in response.data["nodes"]}
        self.assertEqual(node_ids, {str(a.id), str(b.id)})
        self.assertEqual(
            response.data["edges"], [{"source": str(a.id), "target": str(b.id)}]
        )

    def test_backlinks_panel_shows_incoming_links(self):
        target = Document.objects.create(title="Target", owner=self.user)
        source_a = Document.objects.create(title="Source A", owner=self.user)
        source_b = Document.objects.create(title="Source B", owner=self.user)
        Link.objects.create(from_document=source_a, to_document=target)
        Link.objects.create(from_document=source_b, to_document=target)

        response = self.client.get(reverse("document-backlinks", args=[target.id]))
        titles = {row["title"] for row in response.data}
        self.assertEqual(titles, {"Source A", "Source B"})


class CommentTests(AuthenticatedAPITestCase):
    def test_create_and_list_comment(self):
        doc = Document.objects.create(title="Doc", owner=self.user)
        response = self.client.post(
            reverse("comment-list"),
            {"document": str(doc.id), "block_id": "block-1", "body": "Nice work"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["author_name"], self.user.name)

        listed = self.client.get(reverse("comment-list"), {"document": str(doc.id)})
        self.assertEqual(len(listed.data["results"]), 1)

    def test_cannot_comment_on_someone_elses_document(self):
        their_doc = Document.objects.create(title="Theirs", owner=self.other_user)
        response = self.client.post(
            reverse("comment-list"),
            {"document": str(their_doc.id), "block_id": "block-1", "body": "Hi"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_threaded_reply(self):
        doc = Document.objects.create(title="Doc", owner=self.user)
        root = Comment.objects.create(document=doc, block_id="b1", author=self.user, body="Root")
        response = self.client.post(
            reverse("comment-list"),
            {
                "document": str(doc.id),
                "block_id": "b1",
                "body": "Reply",
                "parent_comment": root.id,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(root.replies.count(), 1)

    def test_resolve_comment(self):
        doc = Document.objects.create(title="Doc", owner=self.user)
        comment = Comment.objects.create(document=doc, block_id="b1", author=self.user, body="Fix this")
        response = self.client.patch(reverse("comment-detail", args=[comment.id]), {"resolved": True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        comment.refresh_from_db()
        self.assertTrue(comment.resolved)
