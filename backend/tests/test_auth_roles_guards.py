"""Staff guards and admin set-role safety."""

from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.core.dependencies import get_staff_user, is_staff_user
from app.models.user import User
from app.routers.auth import set_user_role
from app.services.portal_login_service import remove_auth0_client_role_if_orphaned


@pytest.mark.asyncio
async def test_db_admin_passes_staff_guard_despite_empty_token_roles():
    admin = SimpleNamespace(
        id=uuid4(),
        email="admin@example.com",
        roles=["admin"],
        auth_id="google-oauth2|admin",
    )
    assert is_staff_user(admin) is True
    result = await get_staff_user(admin)
    assert result is admin


@pytest.mark.asyncio
async def test_db_client_fails_staff_guard_even_if_token_would_be_admin():
    client_user = SimpleNamespace(
        id=uuid4(),
        email="portal@example.com",
        roles=["client"],
        auth_id="auth0|client-only",
    )
    with pytest.raises(HTTPException) as exc:
        await get_staff_user(client_user)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
@patch("app.services.role_service.set_user_roles")
async def test_set_user_role_blocks_last_admin(mock_set):
    admin = User(
        id=uuid4(),
        auth_id="auth0|sole-admin",
        email="sole@example.com",
        first_name="Sole",
        last_name="Admin",
        roles=["admin"],
        is_active=True,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = admin
    caller = SimpleNamespace(auth_id=admin.auth_id, roles=["admin"])
    with pytest.raises(HTTPException) as exc:
        await set_user_role(
            user_id=admin.auth_id,
            role="technician",
            current_user=caller,
            db=db,
        )
    assert exc.value.status_code == 400
    mock_set.assert_not_called()


@patch("app.services.role_service.remove_user_roles")
@patch("app.services.portal_login_service.has_active_login_anywhere", return_value=False)
@patch("app.db.database.SessionLocal")
def test_orphan_revoke_removes_client_only(mock_session_local, mock_active, mock_remove):
    user = User(
        id=uuid4(),
        auth_id="auth0|orphan",
        email="orphan@example.com",
        first_name="Or",
        last_name="Phan",
        roles=["admin", "client"],
        is_active=True,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = user
    mock_session_local.return_value = db
    mock_remove.return_value = (user, None)

    err = remove_auth0_client_role_if_orphaned("auth0|orphan")
    assert err is None
    mock_remove.assert_called_once()
    assert mock_remove.call_args[0][2] == ["client"]
