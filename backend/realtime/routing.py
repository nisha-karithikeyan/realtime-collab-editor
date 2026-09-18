from django.urls import re_path

from .consumers import EditorConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/documents/(?P<document_id>[0-9a-f-]+)/$",
        EditorConsumer.as_asgi(),
    ),
]
