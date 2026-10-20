"""Portal open sign-up (phase 2c)."""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.portal_signup_service import (
    SOURCE_SELF_SIGNUP,
    PortalSignupError,
    create_self_signup_client,
    names_from_auth0_profile,
    portal_signup_needs_profile,
)


def test_names_from_auth0_profile_defaults():
    first, last = names_from_auth0_profile({})
    assert first == "New"
    assert last == "Customer"


def test_names_from_auth0_profile_given_family():
    first, last = names_from_auth0_profile(
        {"given_name": "Ada", "family_name": "Lovelace"}
    )
    assert first == "Ada"
    assert last == "Lovelace"


def test_portal_signup_needs_profile():
    complete = SimpleNamespace(
        source=SOURCE_SELF_SIGNUP,
        portal_profile_completed_at=datetime.utcnow(),
    )
    pending = SimpleNamespace(
        source=SOURCE_SELF_SIGNUP,
        portal_profile_completed_at=None,
    )
    staff = SimpleNamespace(source="staff", portal_profile_completed_at=None)
    assert not portal_signup_needs_profile(complete)
    assert portal_signup_needs_profile(pending)
    assert not portal_signup_needs_profile(staff)


def test_create_self_signup_client_rejects_unverified():
    db = MagicMock()
    with pytest.raises(PortalSignupError) as exc:
        create_self_signup_client(
            db,
            auth0_user_id="auth0|new",
            profile={"email": "a@example.com", "email_verified": False},
        )
    assert exc.value.code == "email_unverified"


@pytest.mark.asyncio
@patch("app.routers.client_portal.ensure_client_login")
@patch("app.services.portal_user_link.sync_client_user_id_on_link")
@patch("app.routers.client_portal._assign_client_role", return_value=(True, True, None))
@patch("app.routers.client_portal._finalize_link_account_response")
@patch("app.routers.client_portal.create_self_signup_client")
@patch("app.routers.client_portal._fetch_auth0_user")
async def test_link_account_self_signup_returns_needs_profile(
    mock_profile,
    mock_create,
    mock_finalize,
    _role,
    _sync_user,
    mock_ensure_login,
):
    from app.routers.client_portal import LinkAccountRequest, link_portal_account

    client_id = uuid4()
    client = SimpleNamespace(
        id=client_id,
        auth0_user_id="auth0|new-user",
        source=SOURCE_SELF_SIGNUP,
        portal_profile_completed_at=None,
        first_name="New",
        last_name="Customer",
        email="new@example.com",
    )
    mock_profile.return_value = {"email": "new@example.com", "email_verified": True}
    mock_create.return_value = client
    mock_ensure_login.return_value = (SimpleNamespace(id=uuid4()), True)

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    db.commit = MagicMock()
    db.refresh = MagicMock()

    token_data = SimpleNamespace(sub="auth0|new-user", email=None, roles=[])

    result = await link_portal_account(LinkAccountRequest(), token_data, db)
    assert result["needs_profile"] is True
    assert result["role_assigned"] is False
    mock_finalize.assert_not_called()


@pytest.mark.asyncio
@patch(
    "app.routers.client_portal._finalize_link_account_response",
    return_value={"success": True, "role_assigned": True},
)
@patch("app.routers.client_portal._assign_client_role", return_value=(True, True, None))
@patch("app.routers.client_portal.apply_portal_profile_completion")
async def test_complete_signup_assigns_role(mock_apply, mock_role, _finalize):
    from app.routers.client_portal import CompleteSignupRequest, complete_portal_signup

    client = SimpleNamespace(
        id=uuid4(),
        auth0_user_id="auth0|finish",
        source=SOURCE_SELF_SIGNUP,
        portal_profile_completed_at=None,
        first_name="A",
        last_name="B",
        email="finish@example.com",
        sms_consent=False,
    )

    lock_query = MagicMock()
    lock_query.first.return_value = client
    db = MagicMock()
    db.query.return_value.filter.return_value.with_for_update.return_value = lock_query
    db.commit = MagicMock()
    db.refresh = MagicMock()

    token_data = SimpleNamespace(sub="auth0|finish", roles=[])

    result = await complete_portal_signup(
        CompleteSignupRequest(
            first_name="Jane",
            last_name="Doe",
            mobile="4195551212",
            sms_consent=True,
        ),
        token_data,
        db,
    )
    mock_apply.assert_called_once()
    mock_role.assert_called_once_with("auth0|finish")
    assert result["profile_completed"] is True


@pytest.mark.asyncio
async def test_link_account_staff_forbidden():
    from app.routers.client_portal import LinkAccountRequest, link_portal_account

    db = MagicMock()
    token_data = SimpleNamespace(sub="auth0|admin-user", email=None, roles=["admin"])

    with pytest.raises(HTTPException) as exc:
        await link_portal_account(LinkAccountRequest(), token_data, db)
    assert exc.value.status_code == 403
    assert "Staff accounts" in exc.value.detail


@pytest.mark.asyncio
async def test_complete_signup_staff_forbidden():
    from app.routers.client_portal import CompleteSignupRequest, complete_portal_signup

    db = MagicMock()
    token_data = SimpleNamespace(sub="auth0|tech", roles=["technician"])

    with pytest.raises(HTTPException) as exc:
        await complete_portal_signup(
            CompleteSignupRequest(
                first_name="A",
                last_name="B",
                mobile="4195551212",
            ),
            token_data,
            db,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
@patch("app.routers.client_portal.ensure_client_login")
@patch("app.routers.client_portal._assign_client_role", return_value=(True, True, None))
@patch("app.routers.client_portal._finalize_link_account_response")
@patch("app.routers.client_portal.create_self_signup_client")
@patch("app.routers.client_portal.find_client_by_normalized_email")
@patch("app.routers.client_portal._fetch_auth0_user")
async def test_link_account_case_insensitive_email_links(
    mock_fetch,
    mock_find_email,
    mock_create,
    mock_finalize,
    _role,
    mock_ensure,
):
    from app.routers.client_portal import LinkAccountRequest, link_portal_account

    client_id = uuid4()
    client = SimpleNamespace(
        id=client_id,
        auth0_user_id=None,
        email="User@Example.com",
        first_name="Pat",
        last_name="Lee",
    )
    mock_fetch.return_value = {"email": "user@example.com", "email_verified": True}
    mock_find_email.return_value = client
    mock_finalize.return_value = {"success": True, "role_assigned": True}
    mock_ensure.return_value = (SimpleNamespace(id=uuid4()), True)

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    db.commit = MagicMock()
    db.refresh = MagicMock()

    token_data = SimpleNamespace(sub="auth0|case-user", email=None, roles=[])

    await link_portal_account(LinkAccountRequest(), token_data, db)
    mock_create.assert_not_called()
    mock_ensure.assert_called_once()
    mock_finalize.assert_called_once()


@pytest.mark.asyncio
@patch("app.routers.client_portal._assign_client_role", return_value=(True, False, None))
@patch("app.routers.client_portal._finalize_link_account_response")
@patch("app.routers.client_portal.apply_portal_profile_completion")
async def test_complete_signup_skips_non_self_signup(mock_apply, mock_finalize, _role):
    from app.routers.client_portal import CompleteSignupRequest, complete_portal_signup

    client = SimpleNamespace(
        id=uuid4(),
        auth0_user_id="auth0|invited",
        source="staff",
        portal_profile_completed_at=None,
        first_name="Pat",
        last_name="Lee",
        email="pat@example.com",
    )
    active_login = SimpleNamespace(id=uuid4(), client_id=client.id)
    lock_query = MagicMock()
    lock_query.first.return_value = client
    db = MagicMock()
    db.query.return_value.filter.return_value.with_for_update.return_value = lock_query
    mock_finalize.return_value = {"success": True}

    token_data = SimpleNamespace(sub="auth0|invited", roles=["client"])

    with patch(
        "app.routers.client_portal.get_active_login_for_sub",
        return_value=active_login,
    ):
        await complete_portal_signup(
            CompleteSignupRequest(
                first_name="Hacker",
                last_name="Name",
                mobile="4195551212",
            ),
            token_data,
            db,
        )
    mock_apply.assert_not_called()
    assert client.first_name == "Pat"


def test_create_self_signup_client_recovers_from_auth0_unique_violation():
    from sqlalchemy.exc import IntegrityError

    db = MagicMock()
    existing = SimpleNamespace(
        id=uuid4(),
        source=SOURCE_SELF_SIGNUP,
        portal_profile_completed_at=None,
    )

    with patch(
        "app.services.portal_signup_service.find_client_by_normalized_email",
        return_value=None,
    ):
        with patch(
            "app.services.portal_signup_service.get_active_login_for_sub",
            side_effect=[None, SimpleNamespace(client_id=existing.id)],
        ):
            db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = (
                None
            )
            db.add = MagicMock()
            db.flush.side_effect = IntegrityError("insert", {}, Exception("dup"))
            db.rollback = MagicMock()
            db.query.return_value.filter.return_value.first.return_value = existing

            result = create_self_signup_client(
            db,
            auth0_user_id="auth0|race",
                profile={"email": "race@example.com", "email_verified": True},
            )
    assert result is existing
    db.rollback.assert_called_once()
