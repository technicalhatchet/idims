"""Customer portal invites, rate limits, and self-leave."""

import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services.portal_login_service import portal_member_display_names
from app.services.portal_member_invite_service import (
    assert_can_create_customer_invite,
    count_customer_invites_last_24h,
    email_has_active_login_on_client,
)
from app.services.portal_preview_guard import PREVIEW_LOCKED_DETAIL, assert_portal_write_allowed


def _client():
    return SimpleNamespace(
        id=uuid.uuid4(),
        first_name="Jane",
        last_name="Doe",
        email="jane@example.com",
        company_name=None,
    )


def _login(client_id, **kwargs):
    return SimpleNamespace(
        id=kwargs.get("id", uuid.uuid4()),
        client_id=client_id,
        auth0_user_id=kwargs.get("auth0_sub", "auth0|primary"),
        added_via="invite",
        display_name=kwargs.get("display_name", "Jane Doe"),
        invited_email=kwargs.get("invited_email"),
        user_id=kwargs.get("user_id"),
    )


def test_email_has_active_login_matches_invited_email():
    client_id = uuid.uuid4()
    login = _login(client_id, invited_email="spouse@example.com")
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [login]
    assert email_has_active_login_on_client(db, client_id, "spouse@example.com")


def test_rate_limit_blocks_sixth_invite():
    client_id = uuid.uuid4()
    db = MagicMock()
    with patch(
        "app.services.portal_member_invite_service.count_customer_invites_last_24h",
        return_value=5,
    ):
        with pytest.raises(Exception) as exc:
            assert_can_create_customer_invite(db, client_id, "new@example.com")
    assert exc.value.code == "rate_limit"
    assert exc.value.status_code == 429


def test_cannot_invite_existing_member_email():
    client_id = uuid.uuid4()
    db = MagicMock()
    with patch(
        "app.services.portal_member_invite_service.count_customer_invites_last_24h",
        return_value=0,
    ):
        with patch(
            "app.services.portal_member_invite_service.email_has_active_login_on_client",
            return_value=True,
        ):
            with pytest.raises(Exception) as exc:
                assert_can_create_customer_invite(db, client_id, "member@example.com")
    assert exc.value.code == "already_member"


@pytest.mark.asyncio
async def test_portal_create_invite_sends_email_and_notifies():
    from app.routers.client_portal import PortalMemberInviteBody, portal_create_account_invite

    client = _client()
    login = _login(client.id)
    db = MagicMock()
    claim = SimpleNamespace(
        id=uuid.uuid4(),
        client_id=client.id,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )

    with patch(
        "app.routers.client_portal.assert_can_create_customer_invite",
        return_value="spouse@example.com",
    ):
        with patch(
            "app.routers.client_portal.create_portal_claim",
            return_value=(claim, "raw-token"),
        ):
            with patch("app.routers.client_portal.build_claim_register_url", return_value="https://x/claim"):
                with patch("app.routers.client_portal.send_portal_invite_email") as send_email:
                    with patch(
                        "app.routers.client_portal.notify_admins_portal_access_event",
                        new_callable=AsyncMock,
                    ):
                        result = await portal_create_account_invite(
                            body=PortalMemberInviteBody(
                                display_name="Spouse",
                                email="spouse@example.com",
                            ),
                            client=client,
                            login=login,
                            db=db,
                            _write_guard=None,
                        )
    send_email.assert_called_once()
    assert result["email_sent"] is True
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_invite_flow_both_members_visible_after_redeem():
    """Invitee redeem creates login; household list includes both names."""
    client_id = uuid.uuid4()
    primary = _login(client_id, display_name="Jane Doe")
    spouse = _login(client_id, id=uuid.uuid4(), display_name="Spouse", auth0_sub="auth0|spouse")

    db = MagicMock()
    with patch(
        "app.services.portal_login_service.list_active_logins",
        return_value=[primary, spouse],
    ):
        names = portal_member_display_names(db, client_id)
    assert names == ["Jane Doe", "Spouse"]


@pytest.mark.asyncio
async def test_leave_commits_before_auth0():
    from app.routers.client_portal import PortalLeaveAccountBody, portal_leave_account

    client = _client()
    login = _login(client.id)
    token_data = SimpleNamespace(sub=login.auth0_user_id, roles=["client"])
    db = MagicMock()
    call_order = []

    db.commit.side_effect = lambda: call_order.append("commit")

    with patch("app.routers.client_portal.count_active_logins", return_value=2):
        with patch(
            "app.routers.client_portal.revoke_client_login",
            return_value=login,
        ):
            with patch(
                "app.routers.client_portal.remove_auth0_client_role_if_orphaned",
                side_effect=lambda sub: call_order.append("auth0") or None,
            ):
                with patch(
                    "app.routers.client_portal.notify_admins_portal_access_event",
                    new_callable=AsyncMock,
                ):
                    await portal_leave_account(
                        body=PortalLeaveAccountBody(),
                        token_data=token_data,
                        client=client,
                        login=login,
                        db=db,
                        _write_guard=None,
                    )
    assert call_order == ["commit", "auth0"]


@pytest.mark.asyncio
async def test_leave_last_member_requires_confirm():
    from app.routers.client_portal import PortalLeaveAccountBody, portal_leave_account

    client = _client()
    login = _login(client.id)
    db = MagicMock()
    with patch("app.routers.client_portal.count_active_logins", return_value=1):
        with pytest.raises(HTTPException) as exc:
            await portal_leave_account(
                body=PortalLeaveAccountBody(confirm_last_member=False),
                token_data=SimpleNamespace(sub=login.auth0_user_id),
                client=client,
                login=login,
                db=db,
                _write_guard=None,
            )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_admin_preview_invite_locked_without_unlock():
    from starlette.requests import Request

    client_id = uuid.uuid4()
    request = Request({"type": "http", "headers": []})
    with pytest.raises(HTTPException) as exc:
        assert_portal_write_allowed(
            request=request,
            token_roles=["admin"],
            admin_sub="auth0|admin",
            admin_client_id=str(client_id),
            client_id=client_id,
            route="POST /portal/account/invites",
        )
    assert exc.value.detail == PREVIEW_LOCKED_DETAIL


@pytest.mark.asyncio
async def test_get_portal_client_login_blocks_admin_preview():
    from app.routers.client_portal import get_portal_client_login

    client = _client()
    with pytest.raises(HTTPException) as exc:
        await get_portal_client_login(
            token_data=SimpleNamespace(sub="auth0|admin", roles=["admin"]),
            db=MagicMock(),
            client=client,
            admin_client_id=str(client.id),
        )
    assert exc.value.status_code == 403
