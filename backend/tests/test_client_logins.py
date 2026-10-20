"""Phase 2g: multiple portal logins per client."""

from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.client import Client
from app.models.client_login import ClientLogin
from app.models.client_portal_claim import ClientPortalClaim
from app.services.portal_login_service import (
    PortalLoginError,
    assert_can_link_to_client,
    ensure_client_login,
    get_revoked_login_for_sub_client,
)


def _claim(created_at: datetime, **kwargs):
    c = ClientPortalClaim(
        id=uuid4(),
        client_id=kwargs.get("client_id", uuid4()),
        token_hash="abc",
        purpose="portal_invite",
        expires_at=datetime.utcnow() + timedelta(days=7),
        created_at=created_at,
    )
    for key, val in kwargs.items():
        if key != "client_id":
            setattr(c, key, val)
    return c


def test_revoked_blocks_email_match():
    client_id = uuid4()
    sub = "auth0|revoked-user"
    revoked = ClientLogin(
        id=uuid4(),
        client_id=client_id,
        auth0_user_id=sub,
        added_via="invite",
        revoked_at=datetime.utcnow() - timedelta(days=1),
        created_at=datetime.utcnow() - timedelta(days=30),
    )
    db = MagicMock()

    def query_side_effect(model):
        q = MagicMock()
        if model is ClientLogin:
            filters = []

            def filter_fn(*args, **kwargs):
                filters.append(args)
                return q

            q.filter = filter_fn
            q.order_by.return_value.first.return_value = revoked
            q.filter.return_value.first.return_value = None
            q.filter.return_value.order_by.return_value.first.return_value = revoked
        return q

    db.query.side_effect = query_side_effect

    with patch(
        "app.services.portal_login_service.get_active_login_for_sub",
        return_value=None,
    ):
        with patch(
            "app.services.portal_login_service.get_revoked_login_for_sub_client",
            return_value=revoked,
        ):
            with pytest.raises(PortalLoginError) as exc:
                assert_can_link_to_client(
                    db,
                    sub,
                    client_id,
                    link_method="email_match",
                    claim=None,
                )
    assert exc.value.code == "revoked"


def test_stale_claim_after_revoke_blocked():
    client_id = uuid4()
    sub = "auth0|revoked-user"
    revoked_at = datetime.utcnow() - timedelta(hours=1)
    revoked = ClientLogin(
        id=uuid4(),
        client_id=client_id,
        auth0_user_id=sub,
        added_via="invite",
        revoked_at=revoked_at,
        created_at=datetime.utcnow() - timedelta(days=10),
    )
    old_claim = _claim(created_at=revoked_at - timedelta(days=1), client_id=client_id)
    db = MagicMock()

    with patch(
        "app.services.portal_login_service.get_active_login_for_sub",
        return_value=None,
    ):
        with patch(
            "app.services.portal_login_service.get_revoked_login_for_sub_client",
            return_value=revoked,
        ):
            with pytest.raises(PortalLoginError) as exc:
                assert_can_link_to_client(
                    db,
                    sub,
                    client_id,
                    link_method="claim_token",
                    claim=old_claim,
                )
    assert exc.value.code == "revoked"


def test_post_revoke_claim_restores_access():
    client_id = uuid4()
    sub = "auth0|revoked-user"
    revoked_at = datetime.utcnow() - timedelta(hours=2)
    revoked = ClientLogin(
        id=uuid4(),
        client_id=client_id,
        auth0_user_id=sub,
        added_via="invite",
        revoked_at=revoked_at,
        created_at=datetime.utcnow() - timedelta(days=10),
    )
    new_claim = _claim(created_at=datetime.utcnow(), client_id=client_id)
    db = MagicMock()
    client = Client(id=client_id, first_name="A", last_name="B", email="a@example.com")

    with patch(
        "app.services.portal_login_service.get_active_login_for_sub",
        return_value=None,
    ):
        with patch(
            "app.services.portal_login_service.get_revoked_login_for_sub_client",
            return_value=revoked,
        ):
            assert_can_link_to_client(
                db,
                sub,
                client_id,
                link_method="claim_token",
                claim=new_claim,
            )

    with patch(
        "app.services.portal_login_service.get_active_login_for_sub",
        return_value=None,
    ):
        with patch(
            "app.services.portal_login_service.get_revoked_login_for_sub_client",
            return_value=revoked,
        ):
            login, created = ensure_client_login(
                db,
                client=client,
                auth0_sub=sub,
                added_via="invite",
                link_method="claim_token",
                claim=new_claim,
                display_name="Spouse",
            )
    assert created is False
    assert login is revoked
    assert revoked.revoked_at is None
    assert revoked.display_name == "Spouse"
    db.add.assert_not_called()


def test_self_signup_after_revoke_on_other_client_inserts_new_row():
    old_client_id = uuid4()
    new_client_id = uuid4()
    sub = "auth0|moved-on"
    revoked = ClientLogin(
        id=uuid4(),
        client_id=old_client_id,
        auth0_user_id=sub,
        added_via="invite",
        revoked_at=datetime.utcnow() - timedelta(days=1),
        created_at=datetime.utcnow() - timedelta(days=30),
    )
    new_client = Client(id=new_client_id, first_name="New", last_name="Acct", email="n@example.com")
    db = MagicMock()

    def revoked_for_client(_db, _sub, client_id):
        return revoked if client_id == old_client_id else None

    with patch(
        "app.services.portal_login_service.get_active_login_for_sub",
        return_value=None,
    ):
        with patch(
            "app.services.portal_login_service.get_revoked_login_for_sub_client",
            side_effect=revoked_for_client,
        ):
            login, created = ensure_client_login(
                db,
                client=new_client,
                auth0_sub=sub,
                added_via="self_signup",
                link_method="self_signup",
                claim=None,
            )
    assert created is True
    db.add.assert_called_once()
    added = db.add.call_args[0][0]
    assert added.client_id == new_client_id
    assert added.auth0_user_id == sub
    assert login is added


@pytest.mark.asyncio
async def test_get_portal_client_revoked_returns_403():
    from app.routers.client_portal import get_portal_client

    token_data = SimpleNamespace(sub="auth0|gone", roles=["client"])
    db = MagicMock()
    with patch(
        "app.routers.client_portal.resolve_portal_client",
        side_effect=PortalLoginError("revoked", "removed"),
    ):
        with pytest.raises(HTTPException) as exc:
            await get_portal_client(
                token_data=token_data,
                db=db,
                admin_client_id=None,
            )
    assert exc.value.status_code == 403


def test_merge_preview_no_both_portal_logins_blocker():
    from app.services.client_merge_service import _blockers

    keep = Client(id=uuid4(), first_name="K", last_name="P", email="k@x.com")
    merge = Client(id=uuid4(), first_name="M", last_name="P", email="m@x.com")
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.count.return_value = 0
    codes = {b["code"] for b in _blockers(keep, merge, db)}
    assert "both_portal_logins" not in codes
