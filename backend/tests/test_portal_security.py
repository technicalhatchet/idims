"""Portal linking and admin preview write guards."""

from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.services.auth_identify import (
    resolve_identify_role_hint,
    role_assignable_from_callback,
)
from app.services.portal_account_linking import (
    EMAIL_VERIFICATION_REQUIRED_MESSAGE,
    is_placeholder_client_email,
    resolve_verified_link_email_from_profile,
)
from app.services.portal_preview_guard import (
    PREVIEW_LOCKED_DETAIL,
    PREVIEW_PAYMENT_FORBIDDEN_DETAIL,
    PREVIEW_UNLOCK_AUDIENCE,
    assert_portal_write_allowed,
    create_preview_unlock_token,
    verify_preview_unlock_token,
)


def _request_with_unlock(token: str | None) -> Request:
    headers = []
    if token:
        headers.append((b"x-portal-preview-unlock", token.encode()))
    scope = {"type": "http", "method": "PUT", "headers": headers}
    return Request(scope)


def test_placeholder_email_detection():
    assert is_placeholder_client_email("bookings+4195551212@noreply.atomicrepair419.com")
    assert not is_placeholder_client_email("customer@example.com")


def test_unverified_email_does_not_resolve_for_linking():
    email, verified = resolve_verified_link_email_from_profile(
        {"email": "a@example.com", "email_verified": False}
    )
    assert email == "a@example.com"
    assert verified is False


def test_verified_email_resolves_for_linking():
    email, verified = resolve_verified_link_email_from_profile(
        {"email": "A@Example.com", "email_verified": True}
    )
    assert email == "a@example.com"
    assert verified is True


def test_unverified_profile_returns_no_role_hint():
    db = MagicMock()
    role, record_id, verified = resolve_identify_role_hint(
        db,
        "auth0|tech1",
        {"email": "tech@example.com", "email_verified": False},
    )
    assert role is None
    assert record_id is None
    assert verified is False
    db.query.assert_not_called()


def test_verified_technician_email_returns_technician_hint():
    tech_id = uuid4()
    technician = SimpleNamespace(id=tech_id, email="tech@example.com")
    db = MagicMock()

    def query_side_effect(model):
        chain = MagicMock()
        from app.models.technician import Technician
        from app.models.user import User

        if model is User:
            chain.filter.return_value.first.return_value = None
        elif model is Technician:
            chain.filter.return_value.first.return_value = technician
        return chain

    db.query.side_effect = query_side_effect

    role, record_id, verified = resolve_identify_role_hint(
        db,
        "auth0|tech1",
        {"email": "tech@example.com", "email_verified": True},
    )
    assert role == "technician"
    assert record_id == str(tech_id)
    assert verified is True
    assert role_assignable_from_callback(role) is True


def test_verified_client_email_returns_client_hint_not_assignable():
    client_id = uuid4()
    client = SimpleNamespace(id=client_id, email="client@example.com")
    db = MagicMock()

    def query_side_effect(model):
        chain = MagicMock()
        from app.models.client import Client
        from app.models.technician import Technician
        from app.models.user import User

        if model is User:
            chain.filter.return_value.first.return_value = None
        elif model is Technician:
            chain.filter.return_value.first.return_value = None
        elif model is Client:
            chain.filter.return_value.first.return_value = client
        return chain

    db.query.side_effect = query_side_effect

    role, record_id, verified = resolve_identify_role_hint(
        db,
        "auth0|client1",
        {"email": "client@example.com", "email_verified": True},
    )
    assert role == "client"
    assert record_id == str(client_id)
    assert role_assignable_from_callback(role) is False


def test_placeholder_auth0_email_never_links():
    email, verified = resolve_verified_link_email_from_profile(
        {"email": "bookings+1@noreply.atomicrepair419.com", "email_verified": True}
    )
    assert email is None
    assert verified is True


@patch("app.services.portal_preview_guard.get_portal_invite_secret", return_value="test-secret")
def test_preview_unlock_token_round_trip(_secret):
    admin_sub = "auth0|admin1"
    client_id = uuid4()
    token = create_preview_unlock_token(admin_sub, client_id)
    assert verify_preview_unlock_token(token, admin_sub, client_id)
    assert not verify_preview_unlock_token(token, "auth0|other", client_id)
    assert not verify_preview_unlock_token(token, admin_sub, uuid4())


@patch("app.services.portal_preview_guard.get_portal_invite_secret", return_value="test-secret")
def test_expired_preview_unlock_token_rejected(_secret):
    admin_sub = "auth0|admin1"
    client_id = uuid4()
    payload = {
        "aud": PREVIEW_UNLOCK_AUDIENCE,
        "sub": admin_sub,
        "client_id": str(client_id),
        "iat": datetime.utcnow() - timedelta(hours=1),
        "exp": datetime.utcnow() - timedelta(minutes=1),
    }
    token = jwt.encode(payload, "test-secret", algorithm="HS256")
    assert not verify_preview_unlock_token(token, admin_sub, client_id)


@patch("app.services.portal_preview_guard.get_portal_invite_secret", return_value="test-secret")
def test_locked_preview_write_returns_403(_secret):
    client_id = uuid4()
    request = _request_with_unlock(None)
    with pytest.raises(HTTPException) as exc:
        assert_portal_write_allowed(
            request=request,
            token_roles=["admin"],
            admin_sub="auth0|admin",
            admin_client_id=str(client_id),
            client_id=client_id,
            route="PUT /portal/me",
        )
    assert exc.value.status_code == 403
    assert exc.value.detail == PREVIEW_LOCKED_DETAIL


@patch("app.services.portal_preview_guard.get_portal_invite_secret", return_value="test-secret")
def test_locked_preview_property_create_returns_403(_secret):
    client_id = uuid4()
    request = _request_with_unlock(None)
    with pytest.raises(HTTPException) as exc:
        assert_portal_write_allowed(
            request=request,
            token_roles=["admin"],
            admin_sub="auth0|admin",
            admin_client_id=str(client_id),
            client_id=client_id,
            route="POST /portal/properties",
        )
    assert exc.value.status_code == 403
    assert exc.value.detail == PREVIEW_LOCKED_DETAIL


@patch("app.services.portal_preview_guard.get_portal_invite_secret", return_value="test-secret")
def test_unlocked_preview_write_allowed(_secret):
    client_id = uuid4()
    admin_sub = "auth0|admin"
    token = create_preview_unlock_token(admin_sub, client_id)
    request = _request_with_unlock(token)
    assert_portal_write_allowed(
        request=request,
        token_roles=["admin"],
        admin_sub=admin_sub,
        admin_client_id=str(client_id),
        client_id=client_id,
        route="PUT /portal/me",
    )


@patch("app.services.portal_preview_guard.get_portal_invite_secret", return_value="test-secret")
def test_unlock_token_wrong_client_rejected(_secret):
    admin_sub = "auth0|admin"
    client_id = uuid4()
    token = create_preview_unlock_token(admin_sub, client_id)
    request = _request_with_unlock(token)
    with pytest.raises(HTTPException) as exc:
        assert_portal_write_allowed(
            request=request,
            token_roles=["admin"],
            admin_sub=admin_sub,
            admin_client_id=str(uuid4()),
            client_id=uuid4(),
            route="PUT /portal/me",
        )
    assert exc.value.status_code == 403


@patch("app.services.portal_preview_guard.get_portal_invite_secret", return_value="test-secret")
def test_payment_blocked_even_when_unlocked(_secret):
    client_id = uuid4()
    admin_sub = "auth0|admin"
    token = create_preview_unlock_token(admin_sub, client_id)
    request = _request_with_unlock(token)
    with pytest.raises(HTTPException) as exc:
        assert_portal_write_allowed(
            request=request,
            token_roles=["admin"],
            admin_sub=admin_sub,
            admin_client_id=str(client_id),
            client_id=client_id,
            route="POST /portal/invoices/pay-all",
            block_payment=True,
        )
    assert exc.value.detail == PREVIEW_PAYMENT_FORBIDDEN_DETAIL


@pytest.mark.asyncio
@patch("app.routers.client_portal.ensure_client_login")
@patch("app.routers.client_portal._fetch_auth0_user")
@patch("app.routers.client_portal._assign_client_role", return_value=(True, True, None))
@patch("app.routers.client_portal._finalize_link_account_response")
async def test_link_account_verified_email_links(mock_finalize, _role, mock_fetch, mock_ensure):
    from app.routers.client_portal import link_portal_account, LinkAccountRequest

    client_id = uuid4()
    client = SimpleNamespace(
        id=client_id,
        auth0_user_id=None,
        email="verified@example.com",
        first_name="A",
        last_name="B",
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [
        None,  # existing auth0
        client,  # email lookup
    ]

    mock_fetch.return_value = {"email": "verified@example.com", "email_verified": True}
    mock_finalize.return_value = {"success": True}
    mock_ensure.return_value = (SimpleNamespace(id=uuid4()), True)

    token_data = SimpleNamespace(sub="auth0|user1", email="ignored@example.com", roles=[])

    await link_portal_account(LinkAccountRequest(), token_data, db)
    mock_ensure.assert_called_once()
    db.commit.assert_called()


@pytest.mark.asyncio
@patch("app.routers.client_portal._fetch_auth0_user")
async def test_link_account_unverified_email_403(mock_fetch):
    from app.routers.client_portal import link_portal_account, LinkAccountRequest

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    mock_fetch.return_value = {"email": "a@example.com", "email_verified": False}

    token_data = SimpleNamespace(sub="auth0|user1", email=None, roles=[])

    with pytest.raises(HTTPException) as exc:
        await link_portal_account(LinkAccountRequest(), token_data, db)
    assert exc.value.status_code == 403
    assert exc.value.detail == EMAIL_VERIFICATION_REQUIRED_MESSAGE


@pytest.mark.asyncio
@patch("app.routers.client_portal.ensure_client_login")
@patch("app.routers.client_portal.get_portal_invite_secret", return_value="invite-secret")
@patch("app.routers.client_portal._assign_client_role", return_value=(True, True, None))
@patch("app.routers.client_portal._finalize_link_account_response")
async def test_link_account_invite_token_links(mock_finalize, _role, _secret, mock_ensure):
    from app.routers.client_portal import link_portal_account, LinkAccountRequest

    client_id = uuid4()
    client = SimpleNamespace(
        id=client_id,
        auth0_user_id=None,
        email="invited@example.com",
        first_name="I",
        last_name="V",
    )
    token = jwt.encode(
        {"client_id": str(client_id), "exp": datetime.utcnow() + timedelta(days=1)},
        "invite-secret",
        algorithm="HS256",
    )

    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [None, client]
    mock_finalize.return_value = {"success": True}
    mock_ensure.return_value = (SimpleNamespace(id=uuid4()), True)

    token_data = SimpleNamespace(sub="auth0|invite-user", email=None, roles=[])

    await link_portal_account(LinkAccountRequest(invite_token=token), token_data, db)
    mock_ensure.assert_called_once()


@pytest.mark.asyncio
@patch("app.routers.client_portal.ensure_client_login")
@patch("app.routers.client_portal.mark_claim_used")
@patch("app.routers.client_portal.resolve_client_for_link")
@patch("app.routers.client_portal._assign_client_role", return_value=(True, True, None))
@patch("app.routers.client_portal._finalize_link_account_response")
async def test_link_account_claim_token_links(mock_finalize, _role, mock_resolve, _mark_used, mock_ensure):
    from app.routers.client_portal import link_portal_account, LinkAccountRequest

    client_id = uuid4()
    client = SimpleNamespace(
        id=client_id,
        auth0_user_id=None,
        email="claim@example.com",
        first_name="C",
        last_name="L",
    )
    claim = SimpleNamespace(id=uuid4(), purpose="portal_invite", claim_metadata=None)
    mock_resolve.return_value = (client, claim)
    mock_finalize.return_value = {"success": True}
    mock_ensure.return_value = (SimpleNamespace(id=uuid4()), True)

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    token_data = SimpleNamespace(sub="auth0|claim-user", email=None, roles=[])

    await link_portal_account(LinkAccountRequest(claim_token="raw-claim-token"), token_data, db)
    mock_ensure.assert_called_once()
    _mark_used.assert_called_once()


@pytest.mark.asyncio
@patch("app.routers.client_portal._assign_client_role", return_value=(True, False, None))
@patch("app.routers.client_portal._finalize_link_account_response")
async def test_already_linked_client_still_works(mock_finalize, _role):
    from app.routers.client_portal import link_portal_account, LinkAccountRequest

    existing = SimpleNamespace(
        id=uuid4(),
        auth0_user_id="auth0|existing",
        email="x@example.com",
        first_name="X",
        last_name="Y",
    )
    active_login = SimpleNamespace(id=uuid4(), client_id=existing.id)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [existing, existing]
    mock_finalize.return_value = {"success": True, "already_linked": True}

    token_data = SimpleNamespace(sub="auth0|existing", email=None, roles=["client"])

    with patch(
        "app.routers.client_portal.get_active_login_for_sub",
        return_value=active_login,
    ):
        result = await link_portal_account(LinkAccountRequest(), token_data, db)
    assert result["success"] is True
    mock_finalize.assert_called_once()
