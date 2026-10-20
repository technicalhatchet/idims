"""Phase 2e: clients.user_id sync on portal link + staff-only legacy APIs."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user
from app.main import app
from app.models.client import Client
from app.models.user import User as DBUser
from app.services.portal_user_link import sync_client_user_id_on_link


@pytest.fixture
def client_role_user():
    user_id = uuid4()
    return SimpleNamespace(
        id=user_id,
        email="portal@example.com",
        roles=["client"],
        auth_id="auth0|client-only",
        is_active=True,
    )


def test_sync_client_user_id_sets_when_null():
    db = MagicMock()
    client = Client(
        id=uuid4(),
        first_name="A",
        last_name="B",
        email="a@example.com",
        user_id=None,
        auth0_user_id="auth0|sub1",
    )
    resolved_user = DBUser(
        id=uuid4(),
        auth_id="auth0|sub1",
        email="a@example.com",
        first_name="A",
        last_name="B",
        roles=["client"],
    )
    token_data = SimpleNamespace(sub="auth0|sub1", roles=["client"])

    with patch(
        "app.services.portal_user_link.ensure_db_user_for_portal_link",
        return_value=resolved_user,
    ):
        sync_client_user_id_on_link(db, client, token_data)

    assert client.user_id == resolved_user.id
    db.commit.assert_called_once()


def test_sync_client_user_id_repoints_placeholder_and_moves_notifications():
    from app.models.notification import Notification

    db = MagicMock()
    placeholder_id = uuid4()
    real_id = uuid4()
    client = Client(
        id=uuid4(),
        first_name="A",
        last_name="B",
        email="a@example.com",
        user_id=placeholder_id,
        auth0_user_id="auth0|sub1",
    )
    placeholder_user = DBUser(
        id=placeholder_id,
        auth_id=f"client|{uuid4()}",
        email="a@example.com",
        first_name="A",
        last_name="B",
        roles=["client"],
    )
    resolved_user = DBUser(
        id=real_id,
        auth_id="auth0|sub1",
        email="a@example.com",
        first_name="A",
        last_name="B",
        roles=["client"],
    )
    token_data = SimpleNamespace(sub="auth0|sub1", roles=["client"])

    user_query = MagicMock()
    user_query.filter.return_value.first.return_value = placeholder_user
    db.query.return_value = user_query

    with patch(
        "app.services.portal_user_link.ensure_db_user_for_portal_link",
        return_value=resolved_user,
    ):
        with patch(
            "app.services.portal_user_link.repoint_placeholder_user_customer_data",
            return_value={"notifications": 2},
        ) as mock_repoint:
            sync_client_user_id_on_link(db, client, token_data)

    mock_repoint.assert_called_once_with(
        db,
        placeholder_user_id=placeholder_id,
        real_user_id=real_id,
        client_id=client.id,
    )
    assert client.user_id == real_id
    db.commit.assert_called_once()


def test_repoint_moves_notification_user_id():
    from app.models.notification import Notification
    from app.services.portal_user_link import repoint_placeholder_user_customer_data

    db = MagicMock()
    old_id = uuid4()
    new_id = uuid4()
    client_id = uuid4()

    row_ids = [uuid4(), uuid4(), uuid4()]
    chain = MagicMock()
    chain.filter.return_value.all.return_value = [(i,) for i in row_ids]
    chain.filter.return_value.update.return_value = 3
    db.query.return_value = chain

    counts = repoint_placeholder_user_customer_data(
        db,
        placeholder_user_id=old_id,
        real_user_id=new_id,
        client_id=client_id,
    )
    assert counts.get("notifications") == 3
    chain.filter.assert_called()
    chain.filter.return_value.update.assert_called()


def test_sync_client_user_id_conflict_unchanged(caplog):
    db = MagicMock()
    existing_user_id = uuid4()
    resolved_id = uuid4()
    client = Client(
        id=uuid4(),
        first_name="A",
        last_name="B",
        email="a@example.com",
        user_id=existing_user_id,
        auth0_user_id="auth0|sub1",
    )
    resolved_user = DBUser(
        id=resolved_id,
        auth_id="auth0|sub1",
        email="a@example.com",
        first_name="A",
        last_name="B",
        roles=["client"],
    )
    linked_user = DBUser(
        id=existing_user_id,
        auth_id="auth0|other-real-conflict",
        email="old@example.com",
        first_name="O",
        last_name="L",
        roles=["client"],
    )
    token_data = SimpleNamespace(sub="auth0|sub1", roles=["client"])

    db.query.return_value.filter.return_value.first.return_value = linked_user

    with patch(
        "app.services.portal_user_link.ensure_db_user_for_portal_link",
        return_value=resolved_user,
    ):
        sync_client_user_id_on_link(db, client, token_data)

    assert client.user_id == existing_user_id
    db.commit.assert_not_called()
    assert any("client.user_id conflict" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_finalize_link_sets_user_id():
    from app.routers.client_portal import _finalize_link_account_response

    client = Client(
        id=uuid4(),
        first_name="A",
        last_name="B",
        email="link@example.com",
        user_id=None,
        auth0_user_id="auth0|finalize",
    )
    user = DBUser(
        id=uuid4(),
        auth_id="auth0|finalize",
        email="link@example.com",
        first_name="A",
        last_name="B",
        roles=["client"],
    )
    db = MagicMock()
    token_data = SimpleNamespace(sub="auth0|finalize", roles=["client"])

    with patch("app.routers.client_portal._sync_client_identity", return_value=(True, None)):
        with patch(
            "app.services.portal_user_link.ensure_db_user_for_portal_link",
            return_value=user,
        ):
            _finalize_link_account_response(
                auth0_user_id="auth0|finalize",
                client=client,
                db=db,
                token_data=token_data,
                already_linked=False,
                role_assigned=True,
                link_method="email_verified",
            )

    assert client.user_id == user.id


@pytest.fixture
def api_client(client_role_user):
    async def override_current_user():
        return client_role_user

    app.dependency_overrides[get_current_user] = override_current_user
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/clients"),
        ("PUT", f"/api/clients/{uuid4()}"),
        ("GET", "/api/invoices"),
    ],
)
def test_client_role_gets_403_on_legacy_staff_apis(api_client, method, path):
    headers = {"Authorization": "Bearer test-token"}
    if method == "PUT":
        response = api_client.put(
            path,
            json={"first_name": "A", "last_name": "B"},
            headers=headers,
        )
    else:
        response = api_client.get(path, headers=headers)
    assert response.status_code == 403, f"{path}: {response.status_code} {response.text}"


@pytest.mark.asyncio
async def test_staff_created_client_first_login_adopts_placeholder():
    """Staff ClientService placeholder + verified Auth0 email: same users row, client.user_id unchanged."""
    from app.core.auth import AuthHandler, TokenData
    from app.routers.client_portal import _finalize_link_account_response

    placeholder_id = uuid4()
    client_id = uuid4()
    auth_sub = "auth0|first-login"

    placeholder_user = DBUser(
        id=placeholder_id,
        auth_id=f"client|{uuid4()}",
        email="portal@example.com",
        first_name="Pat",
        last_name="Lee",
        roles=["client"],
        is_active=True,
    )
    client = Client(
        id=client_id,
        first_name="Pat",
        last_name="Lee",
        email="portal@example.com",
        user_id=placeholder_id,
        auth0_user_id=None,
    )

    token_data = TokenData(
        sub=auth_sub,
        exp=9999999999,
        email="portal@example.com",
        roles=["client"],
        raw_payload={"email": "portal@example.com", "email_verified": True},
    )

    handler = AuthHandler(domain="example.auth0.com", audience="https://api")
    db = MagicMock()

    auth_lookup_count = 0

    def query_router(model):
        nonlocal auth_lookup_count
        q = MagicMock()
        if model is DBUser:
            def first():
                nonlocal auth_lookup_count
                auth_lookup_count += 1
                if auth_lookup_count == 1:
                    return None
                return placeholder_user
            q.filter.return_value.first = first
        return q

    db.query.side_effect = query_router

    with patch.object(
        handler,
        "verify_token",
        new=AsyncMock(return_value=token_data),
    ):
        resolved = handler.ensure_db_user_from_token(db, token_data)

    assert resolved.id == placeholder_id
    assert placeholder_user.auth_id == auth_sub
    db.add.assert_not_called()

    client.auth0_user_id = auth_sub
    placeholder_user.auth_id = auth_sub
    with patch("app.routers.client_portal._sync_client_identity", return_value=(True, None)):
        with patch(
            "app.services.portal_user_link.ensure_db_user_for_portal_link",
            return_value=placeholder_user,
        ):
            _finalize_link_account_response(
                auth0_user_id=auth_sub,
                client=client,
                db=db,
                token_data=token_data,
                already_linked=False,
                role_assigned=True,
                link_method="email_verified",
            )

    assert client.user_id == placeholder_id

    from app.models.notification import Notification
    from app.routers.client_portal import list_portal_notifications

    notification = SimpleNamespace(
        id=uuid4(),
        user_id=placeholder_id,
        title="Part shipped",
        content="On the way",
        type="part",
        related_id=None,
        related_type=None,
        is_read=False,
        read_at=None,
        created_at=None,
    )
    notif_db = MagicMock()
    base_query = MagicMock()
    base_query.count.return_value = 1
    base_query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
        notification
    ]
    base_query.filter.return_value.count.return_value = 1
    notif_db.query.return_value.filter.return_value = base_query

    token_data = SimpleNamespace(sub=auth_sub, roles=["client"])
    active_login = SimpleNamespace(id=uuid4(), client_id=client.id, user_id=placeholder_id)
    with patch(
        "app.routers.client_portal.get_active_login_for_sub",
        return_value=active_login,
    ):
        result = await list_portal_notifications(
            client=client,
            token_data=token_data,
            db=notif_db,
            page=1,
            limit=20,
        )
    assert result["portal_linked"] is True
    assert result["total"] == 1
    notif_db.query.assert_called_with(Notification)


@pytest.mark.asyncio
async def test_portal_notifications_when_user_id_set():
    from app.routers.client_portal import list_portal_notifications

    user_id = uuid4()
    client = SimpleNamespace(id=uuid4(), user_id=user_id)
    notification = SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        title="Part update",
        content="Shipped",
        type="part",
        related_id=None,
        related_type=None,
        is_read=False,
        read_at=None,
        created_at=None,
    )

    base_query = MagicMock()
    base_query.count.return_value = 1
    base_query.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
        notification
    ]
    base_query.filter.return_value.count.return_value = 1

    db = MagicMock()
    db.query.return_value.filter.return_value = base_query

    token_data = SimpleNamespace(sub="auth0|notify", roles=["client"])
    active_login = SimpleNamespace(id=uuid4(), client_id=client.id, user_id=user_id)
    with patch(
        "app.routers.client_portal.get_active_login_for_sub",
        return_value=active_login,
    ):
        result = await list_portal_notifications(
            client=client,
            token_data=token_data,
            db=db,
            page=1,
            limit=20,
        )
    assert result["portal_linked"] is True
    assert result["total"] == 1
    assert len(result["notifications"]) == 1
