"""TechDeck dashboard stats must be served at /api/techdeck/dashboard-stats (not WO id proxy)."""

from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_staff_user
from app.main import app


@pytest.fixture
def technician_user():
    return SimpleNamespace(
        id=uuid4(),
        email="tech@example.com",
        roles=["technician"],
        auth_id="google-oauth2|tech",
        is_active=True,
    )


@pytest.fixture
def staff_client(technician_user):
    async def override_staff_user():
        return technician_user

    app.dependency_overrides[get_staff_user] = override_staff_user
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@patch("app.routers.techdeck.get_techdeck_dashboard_stats")
def test_techdeck_dashboard_stats_real_url(mock_stats, staff_client):
    mock_stats.return_value = {
        "total": 12,
        "today": 3,
        "completed_today": 1,
        "parts_waiting": 2,
        "critical_mass": 0,
        "pending_scheduling": 1,
    }

    response = staff_client.get(
        "/api/techdeck/dashboard-stats",
        params={"local_date": "2026-10-24", "tz_offset": 240},
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 12
    assert body["parts_waiting"] == 2
    mock_stats.assert_called_once()


def test_work_orders_dashboard_stats_not_treated_as_work_order_id(staff_client):
    """Legacy/wrong path must not hit UUID parse on 'dashboard-stats' (prod regression)."""
    response = staff_client.get(
        "/api/work-orders/dashboard-stats",
        params={"local_date": "2026-10-24", "tz_offset": 240},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code != 200
    assert "badly formed hexadecimal UUID" not in response.text.lower()
