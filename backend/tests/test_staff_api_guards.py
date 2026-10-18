"""Staff-only routers reject portal client-role users."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user, get_staff_user, is_staff_user
from app.main import app


@pytest.fixture
def client_role_user():
    return SimpleNamespace(
        id=uuid4(),
        email="portal@example.com",
        roles=["client"],
        auth_id="auth0|client-only",
        is_active=True,
    )


@pytest.fixture
def technician_user():
    return SimpleNamespace(
        id=uuid4(),
        email="tech@example.com",
        roles=["technician"],
        auth_id="google-oauth2|tech",
        is_active=True,
    )


def test_is_staff_user_recognizes_technician(technician_user):
    assert is_staff_user(technician_user) is True


def test_is_staff_user_rejects_client_only(client_role_user):
    assert is_staff_user(client_role_user) is False


@pytest.mark.asyncio
async def test_get_staff_user_raises_403_for_client(client_role_user):
    with pytest.raises(HTTPException) as exc:
        await get_staff_user(client_role_user)
    assert exc.value.status_code == 403


@pytest.fixture
def api_client(client_role_user):
    async def override_current_user():
        return client_role_user

    app.dependency_overrides[get_current_user] = override_current_user
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "method,path,json_body",
    [
        ("GET", "/api/properties/client/00000000-0000-0000-0000-000000000001", None),
        ("GET", "/api/dma/codes", None),
        ("GET", "/api/logit/projects", None),
        ("GET", "/api/job-economics/categories", None),
        (
            "GET",
            "/api/scheduling/calendar-blocks?start_date=2026-01-01&end_date=2026-01-02",
            None,
        ),
        ("GET", "/api/chat/chat/unread-count", None),
        ("GET", "/api/stripe/stripe/session/ch_fake_session", None),
        (
            "POST",
            "/api/diagnostics/generate-notes",
            {"work_order_id": "00000000-0000-0000-0000-000000000001"},
        ),
        ("GET", "/api/clients", None),
        ("PUT", f"/api/clients/{uuid4()}", {"first_name": "A", "last_name": "B"}),
        ("GET", "/api/invoices", None),
        ("GET", "/api/quotes/quotes", None),
        (
            "GET",
            "/api/scheduling/schedule?start_date=2026-01-01&end_date=2026-01-02",
            None,
        ),
    ],
)
def test_client_role_gets_403_on_staff_routes(api_client, method, path, json_body):
    headers = {"Authorization": "Bearer test-token"}
    if method == "POST":
        response = api_client.post(path, json=json_body or {}, headers=headers)
    elif method == "PUT":
        response = api_client.put(path, json=json_body or {}, headers=headers)
    else:
        response = api_client.get(path, headers=headers)
    assert response.status_code == 403, f"{path}: {response.status_code} {response.text}"
