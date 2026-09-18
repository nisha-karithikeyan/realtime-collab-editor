from rest_framework.routers import DefaultRouter

from .views import CommentViewSet, DocumentViewSet, FolderViewSet

router = DefaultRouter()
router.register("folders", FolderViewSet, basename="folder")
router.register("documents", DocumentViewSet, basename="document")
router.register("comments", CommentViewSet, basename="comment")

urlpatterns = router.urls
