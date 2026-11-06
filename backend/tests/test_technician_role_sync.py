"""Technician create/delete role persistence and identify hints."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.models.user import User
from app.schemas.technician import TechnicianCreate
from app.services.auth_identify import resolve_identify_role_hint
from app.services.technician_service import TechnicianService


@pytest.mark.asyncio
async def test_create_technician_existing_client_user_persists_technician_role():
    user_id = uuid4()
    existing = User(
        id=user_id,
        email="client-tech@example.com",
        first_name="Pat",
        last_name="Lee",
        roles=["client"],
        is_active=True,
    )
    db = MagicMock()
    user_query = MagicMock()
    user_query.filter.return_value.first.side_effect = [existing, existing]
    tech_query = MagicMock()
    tech_query.filter.return_value.first.return_value = None
    emp_query = MagicMock()
    emp_query.filter.return_value.first.return_value = None

    def query_router(model):
        from app.models.technician import Technician

        if model is User:
            return user_query
        if model is Technician:
            return tech_query
        return emp_query

    db.query.side_effect = query_router
    db.add = MagicMock()
    db.flush = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock()

    data = TechnicianCreate(
        user_email="client-tech@example.com",
        user_first_name="Pat",
        user_last_name="Lee",
        employee_id="E-100",
    )

    with patch(
        "app.services.role_service.add_user_roles",
        wraps=__import__("app.services.role_service", fromlist=["add_user_roles"]).add_user_roles,
    ) as mock_add:
        with patch(
            "app.services.role_service.mirror_user_roles",
            return_value=None,
        ) as mock_mirror:
            result = await TechnicianService.create_technician(db, data, uuid4())

    mock_add.assert_called_once()
    _args, kwargs = mock_add.call_args
    assert kwargs.get("commit") is False
    assert existing.roles == ["client", "technician"]
    mock_mirror.assert_called_once_with(existing)
    assert result.user_id == user_id


@pytest.mark.asyncio
async def test_delete_technician_tech_only_user_becomes_client():
    tech_id = uuid4()
    user_id = uuid4()
    technician = SimpleNamespace(id=tech_id, user_id=user_id)
    user = User(
        id=user_id,
        auth_id="auth0|tech-only",
        email="tech-only@example.com",
        roles=["technician"],
        is_active=True,
    )

    db = MagicMock()
    wo_query = MagicMock()
    wo_query.filter.return_value.count.return_value = 0
    user_query = MagicMock()
    user_query.filter.return_value.first.return_value = user

    def query_router(model):
        from app.models.work_order import WorkOrder

        if model is WorkOrder:
            return wo_query
        if model is User:
            return user_query
        return MagicMock()

    db.query.side_effect = query_router
    db.delete = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock()

    with patch.object(
        TechnicianService,
        "get_technician",
        new=AsyncMock(return_value=technician),
    ):
        with patch(
            "app.services.role_service.mirror_user_roles",
            return_value=None,
        ) as mock_mirror:
            ok = await TechnicianService.delete_technician(db, tech_id)

    assert ok is True
    assert user.roles == ["client"]
    mock_mirror.assert_called_once_with(user)
    db.delete.assert_called_once_with(technician)


def test_inactive_technician_identify_returns_no_role_hint():
    tech_id = uuid4()
    technician = SimpleNamespace(id=tech_id, email="tech@example.com", status="inactive")
    db = MagicMock()

    def query_side_effect(model):
        chain = MagicMock()
        from app.models.client import Client
        from app.models.technician import Technician
        from app.models.user import User

        if model is User:
            chain.filter.return_value.first.return_value = None
        elif model is Technician:
            chain.filter.return_value.first.return_value = technician
        elif model is Client:
            chain.filter.return_value.first.return_value = None
        return chain

    db.query.side_effect = query_side_effect

    role, record_id, verified = resolve_identify_role_hint(
        db,
        "auth0|tech1",
        {"email": "tech@example.com", "email_verified": True},
    )
    assert role is None
    assert record_id is None
    assert verified is True
