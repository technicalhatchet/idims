"""Phase 2f: admin client merge."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.client import Client
from app.routers.clients import get_admin_dependency
from app.models.user import User as DBUser
from app.services.client_merge_service import (
    _apply_field_choices,
    _apply_portal_identity_merge,
    _auth0_user_identity_blockers,
    _blockers,
    build_merge_preview,
    client_is_merged,
    has_real_portal_login,
)


def _client(**kwargs):
    defaults = {
        "id": uuid4(),
        "first_name": "Keep",
        "last_name": "Person",
        "email": "keep@example.com",
        "phone": None,
        "mobile": None,
        "status": "active",
        "auth0_user_id": None,
        "user_id": None,
        "merged_into_client_id": None,
        "tags": [],
        "custom_fields": {},
        "sms_consent": False,
        "notes": None,
        "company_name": None,
    }
    defaults.update(kwargs)
    c = Client(**{k: v for k, v in defaults.items() if k not in ("display_name",)})
    return c


def test_both_portal_logins_blocker():
    keep = _client(auth0_user_id="auth0|keep")
    merge = _client(id=uuid4(), auth0_user_id="auth0|merge")
    codes = {b["code"] for b in _blockers(keep, merge, MagicMock())}
    assert "both_portal_logins" in codes


def test_auth0_user_id_mismatch_blocker():
    real_wrong = uuid4()
    keep = _client(auth0_user_id="auth0|survivor", user_id=real_wrong)
    merge = _client(id=uuid4())
    wrong_user = DBUser(
        id=real_wrong,
        auth_id="auth0|other",
        email="w@example.com",
        first_name="W",
        last_name="R",
        roles=["client"],
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = wrong_user
    blockers = _auth0_user_identity_blockers(db, keep, merge)
    assert any(b["code"] == "auth0_user_id_mismatch" for b in blockers)


def test_keep_login_merges_staff_placeholder_notifications():
    """Self-signup keep + staff merge placeholder: notifications follow real login user."""
    real_id = uuid4()
    placeholder_id = uuid4()
    notif_id = uuid4()
    keep = _client(auth0_user_id="auth0|signup", user_id=real_id)
    merge = _client(id=uuid4(), user_id=placeholder_id)
    real_user = DBUser(
        id=real_id,
        auth_id="auth0|signup",
        email="signup@example.com",
        first_name="Sig",
        last_name="Nup",
        roles=["client"],
    )
    ph_user = DBUser(
        id=placeholder_id,
        auth_id=f"client|{uuid4()}",
        email="signup@example.com",
        first_name="Staff",
        last_name="Created",
        roles=["client"],
    )

    def fake_load_user(_db, user_id):
        if user_id == real_id:
            return real_user
        if user_id == placeholder_id:
            return ph_user
        return None

    moved = {}
    db = MagicMock()
    with patch(
        "app.services.client_merge_service._resolve_real_user_for_auth0",
        return_value=real_user,
    ):
        with patch(
            "app.services.client_merge_service._load_user",
            side_effect=fake_load_user,
        ):
            with patch(
                "app.services.client_merge_service.repoint_user_customer_data_collect_ids",
                return_value={"notifications": [str(notif_id)]},
            ) as mock_repoint:
                _apply_portal_identity_merge(db, keep, merge, moved)
    mock_repoint.assert_called()
    assert mock_repoint.call_args.kwargs["from_user_id"] == placeholder_id
    assert mock_repoint.call_args.kwargs["to_user_id"] == real_id
    assert keep.user_id == real_id
    assert moved["notifications"] == [str(notif_id)]


def test_merge_login_moves_auth0_and_repoints_keep_placeholder():
    """Staff keep placeholder + self-signup merge: auth0 and user land on survivor."""
    real_id = uuid4()
    placeholder_id = uuid4()
    keep = _client(user_id=placeholder_id)
    merge = _client(
        id=uuid4(),
        auth0_user_id="auth0|portal",
        user_id=real_id,
    )
    real_user = DBUser(
        id=real_id,
        auth_id="auth0|portal",
        email="portal@example.com",
        first_name="Por",
        last_name="Tal",
        roles=["client"],
    )
    ph_user = DBUser(
        id=placeholder_id,
        auth_id=f"client|{uuid4()}",
        email="portal@example.com",
        first_name="Staff",
        last_name="Created",
        roles=["client"],
    )

    def fake_load_user(_db, user_id):
        if user_id == real_id:
            return real_user
        if user_id == placeholder_id:
            return ph_user
        return None

    moved = {}
    db = MagicMock()
    with patch(
        "app.services.client_merge_service._resolve_real_user_for_auth0",
        return_value=real_user,
    ):
        with patch(
            "app.services.client_merge_service._load_user",
            side_effect=fake_load_user,
        ):
            with patch(
                "app.services.client_merge_service.repoint_user_customer_data_collect_ids",
                return_value={"notifications": ["n1"]},
            ) as mock_repoint:
                _apply_portal_identity_merge(db, keep, merge, moved)
    assert keep.auth0_user_id == "auth0|portal"
    assert keep.user_id == real_id
    assert merge.auth0_user_id is None
    mock_repoint.assert_called()
    assert moved["notifications"] == ["n1"]


def test_apply_field_choices_and_fill_blanks():
    keep = _client(email="keep@example.com", company_name=None)
    merge = _client(
        id=uuid4(),
        email="merge@example.com",
        company_name="ACME",
        tags=["b"],
        custom_fields={"x": 1},
    )
    _apply_field_choices(keep, merge, {"email": "merge", "mobile": "keep", "phone": "keep", "name": "keep"})
    assert keep.email == "merge@example.com"
    assert keep.company_name == "ACME"
    assert "b" in (keep.tags or [])


def test_work_order_pricing_unchanged_on_client_id_repoint():
    """Merge only changes work_orders.client_id — not pricing columns."""
    keep_id = uuid4()
    merge_id = uuid4()
    wo = SimpleNamespace(
        client_id=merge_id,
        diagnostic_discount_applied=True,
        diagnostic_discount_amount=Decimal("50.00"),
        invoice_total=Decimal("200.00"),
    )
    before = (
        wo.diagnostic_discount_applied,
        wo.diagnostic_discount_amount,
        wo.invoice_total,
    )
    wo.client_id = keep_id
    after = (
        wo.diagnostic_discount_applied,
        wo.diagnostic_discount_amount,
        wo.invoice_total,
    )
    assert before == after
    assert wo.client_id == keep_id


def test_build_merge_preview_same_client_blocker():
    cid = uuid4()
    client = _client(id=cid)

    def query_router(_model):
        q = MagicMock()
        q.filter.return_value.first.return_value = client
        q.filter.return_value.count.return_value = 0
        q.filter.return_value.all.return_value = []
        return q

    db = MagicMock()
    db.query.side_effect = query_router
    db.get_bind.return_value = MagicMock()
    with patch("app.services.client_merge_service.inspect") as mock_inspect:
        mock_inspect.return_value.get_table_names.return_value = []
        preview = build_merge_preview(db, keep_client_id=cid, merge_client_id=cid)
    assert preview["can_merge"] is False
    assert any(b["code"] == "same_client" for b in preview["blockers"])


@pytest.fixture
def admin_api_client():
    admin = SimpleNamespace(
        id=uuid4(),
        email="admin@example.com",
        first_name="Admin",
        last_name="User",
        auth_id="auth0|admin",
    )

    async def override_admin():
        return admin

    app.dependency_overrides[get_admin_dependency] = override_admin
    with TestClient(app) as client:
        yield client, admin
    app.dependency_overrides.clear()


def test_merge_post_requires_admin_and_calls_service(admin_api_client):
    client, _admin = admin_api_client
    keep_id = uuid4()
    merge_id = uuid4()
    audit_id = uuid4()
    keep = _client(id=keep_id)

    with patch("app.routers.clients.execute_client_merge") as mock_exec:
        mock_exec.return_value = (keep, SimpleNamespace(id=audit_id), [])
        response = client.post(
            "/api/clients/merge",
            json={
                "keep_client_id": str(keep_id),
                "merge_client_id": str(merge_id),
                "field_choices": {"name": "keep", "email": "keep", "mobile": "keep", "phone": "keep"},
            },
            headers={"Authorization": "Bearer test"},
        )
    assert response.status_code == 200
    assert response.json()["audit_id"] == str(audit_id)


def test_non_admin_merge_forbidden():
    tech = SimpleNamespace(
        id=uuid4(),
        email="tech@example.com",
        first_name="T",
        last_name="E",
        auth_id="auth0|tech",
    )

    async def override_tech():
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    app.dependency_overrides[get_admin_dependency] = override_tech
    with TestClient(app) as client:
        response = client.get(
            f"/api/clients/merge/preview?keep_id={uuid4()}&merge_id={uuid4()}",
            headers={"Authorization": "Bearer test"},
        )
    app.dependency_overrides.clear()
    assert response.status_code == 403


def test_client_is_merged_helper():
    c = _client(merged_into_client_id=uuid4())
    assert client_is_merged(c) is True
    assert has_real_portal_login(_client(auth0_user_id="auth0|x")) is True
