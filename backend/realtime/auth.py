from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def get_user_from_access_token(raw_token):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        validated = AccessToken(raw_token)
        return User.objects.get(pk=validated["user_id"])
    except (InvalidToken, TokenError, User.DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Authenticates a Channels WebSocket connection using the same JWT
    access token issued by /api/auth/login/, passed as ?token=... since
    the Angular dev server (and Vercel in prod) is a different origin than
    the backend and can't rely on session cookies for the WS handshake."""

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        token = parse_qs(query_string).get("token", [None])[0]

        scope["user"] = await get_user_from_access_token(token) if token else AnonymousUser()

        return await super().__call__(scope, receive, send)
