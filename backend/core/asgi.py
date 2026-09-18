import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

django_asgi_app = get_asgi_application()

from realtime.routing import websocket_urlpatterns  # noqa: E402
from realtime.auth import JWTAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # Not AllowedHostsOriginValidator: that checks the WebSocket's
        # Origin header against ALLOWED_HOSTS, which is the backend's
        # OWN domain - correct for a same-origin app, but wrong here,
        # since the frontend (Vercel) and backend (Render) are on
        # different domains. It only appeared to work locally because
        # both dev servers happen to share the "localhost"/"127.0.0.1"
        # hostname family. OriginValidator checks against the actual
        # allowed frontend origins instead, same list CORS already uses.
        "websocket": OriginValidator(
            JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
            settings.CORS_ALLOWED_ORIGINS,
        ),
    }
)
