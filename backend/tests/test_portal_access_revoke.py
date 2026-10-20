"""Staff revoke portal login — commit before Auth0 orphan role removal."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.routers.clients import revoke_client_portal_login_route


@pytest.mark.asyncio
async def test_revoke_commits_before_auth0_role_removal():
    client_id = uuid.uuid4()
    login_id = uuid.uuid4()
    login = MagicMock()
    login.auth0_user_id = "auth0|orphan-test"

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = login
    call_order = []

    def commit():
        call_order.append("commit")

    db.commit.side_effect = commit

    with patch(
        "app.services.portal_login_service.revoke_client_login",
        return_value=login,
    ) as mock_revoke:
        with patch(
            "app.services.portal_login_service.remove_auth0_client_role_if_orphaned",
            side_effect=lambda sub: call_order.append("auth0") or None,
        ):
            await revoke_client_portal_login_route(
                client_id=client_id,
                login_id=login_id,
                db=db,
                current_user=MagicMock(),
            )

    mock_revoke.assert_called_once()
    assert call_order == ["commit", "auth0"]


@pytest.mark.asyncio
async def test_revoke_missing_login_404():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    with pytest.raises(HTTPException) as exc:
        await revoke_client_portal_login_route(
            client_id=uuid.uuid4(),
            login_id=uuid.uuid4(),
            db=db,
            current_user=MagicMock(),
        )
    assert exc.value.status_code == 404
