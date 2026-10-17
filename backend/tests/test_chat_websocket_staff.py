"""Chat WebSocket must reject non-staff users."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.core.auth import TokenData
from app.routers.chat import (
    WS_CLOSE_STAFF_REQUIRED,
    chat_websocket,
    staff_db_user_for_auth_id,
)


def test_staff_db_user_for_auth_id_accepts_technician():
    tech = SimpleNamespace(roles=["technician"], auth_id="google-oauth2|tech")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = tech
    assert staff_db_user_for_auth_id(db, "google-oauth2|tech") is tech


def test_staff_db_user_for_auth_id_rejects_client_only():
    client = SimpleNamespace(roles=["client"], auth_id="auth0|portal")
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = client
    assert staff_db_user_for_auth_id(db, "auth0|portal") is None


@pytest.mark.asyncio
async def test_chat_websocket_closes_when_user_not_staff():
    websocket = AsyncMock()
    sub = "auth0|client-only"
    token_data = TokenData(sub=sub, exp=9999999999, roles=["client"])

    client_user = SimpleNamespace(id=uuid4(), roles=["client"], auth_id=sub)

    with patch("app.routers.chat.get_auth_handler") as mock_get_handler:
        mock_get_handler.return_value.verify_token = AsyncMock(return_value=token_data)
        with patch("app.routers.chat.SessionLocal") as mock_session_local:
            db = MagicMock()
            db.query.return_value.filter.return_value.first.return_value = client_user
            mock_session_local.return_value = db

            await chat_websocket(websocket, sub, token="fake-jwt")

    websocket.close.assert_awaited_once_with(code=1008, reason=WS_CLOSE_STAFF_REQUIRED)
    websocket.accept.assert_not_awaited()
    db.close.assert_called_once()
