"""identify-user assigns technician to DB for verified staff match."""

from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.user import User
from app.routers.auth import identify_user


class _Body:
    auth0_user_id = None


@pytest.mark.asyncio
@patch("app.services.auth_identify.fetch_auth0_user_profile")
@patch("app.services.auth_identify.resolve_identify_role_hint", return_value=("technician", "rec-1", True))
@patch("app.services.role_service.add_user_roles")
async def test_identify_user_assigns_technician_to_db(mock_add, mock_resolve, mock_profile):
    email = "tech-match@example.com"
    sub = "google-oauth2|new-tech"
    mock_profile.return_value = {"email": email, "email_verified": True}

    db_user = User(
        id=uuid4(),
        auth_id=sub,
        email=email,
        first_name="Tech",
        last_name="Match",
        roles=["technician"],
        is_active=True,
    )
    mock_add.return_value = (db_user, None)

    token = SimpleNamespace(
        sub=sub,
        email=email,
        roles=[],
        permissions=[],
        raw_payload={"email": email, "email_verified": True},
    )
    creds = SimpleNamespace(credentials="fake-token")
    db = MagicMock()

    mock_handler = MagicMock()
    mock_handler.verify_token = AsyncMock(return_value=token)
    mock_handler.ensure_db_user_from_token.return_value = db_user

    def _add_side_effect(db, user, roles):
        user.roles = ["technician"]
        return user, None

    mock_add.side_effect = _add_side_effect

    with patch("app.routers.auth.get_auth_handler", return_value=mock_handler):
        result = await identify_user(_Body(), db=db, credentials=creds)

    assert result["role"] == "technician"
    assert result["db_assigned"] is True
    mock_add.assert_called_once()
