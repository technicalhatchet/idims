"""Work-order list: query flags must not leak FastAPI Query() defaults through the proxy."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import Query as QueryParam
from starlette.requests import Request

from app.utils.query_params import coerce_query_bool, query_bool_from_request


def _request(query_string: bytes = b"") -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/work-orders",
            "query_string": query_string,
            "headers": [],
        }
    )


def test_query_bool_from_request_defaults_false():
    assert query_bool_from_request(_request(), "portal_prepaid_unscheduled") is False


def test_query_bool_from_request_true():
    assert (
        query_bool_from_request(
            _request(b"portal_prepaid_unscheduled=true"),
            "portal_prepaid_unscheduled",
        )
        is True
    )


def test_coerce_query_bool_leaked_query_default_is_false():
    leaked = QueryParam(False)
    assert leaked is not False
    assert (
        coerce_query_bool(
            leaked,
            _request(),
            "portal_prepaid_unscheduled",
        )
        is False
    )


def test_coerce_query_bool_honors_real_bool():
    assert coerce_query_bool(True, _request(), "portal_prepaid_unscheduled") is True
    assert coerce_query_bool(False, _request(b"portal_prepaid_unscheduled=true"), "x") is False


@pytest.mark.asyncio
async def test_list_work_orders_without_param_does_not_enable_prepaid_filter():
    """Simulates main.py calling list_work_orders without resolving Query defaults."""
    from app.routers.work_orders import list_work_orders

    captured = {}

    async def fake_get_work_orders(**kwargs):
        captured.update(kwargs)
        return {"items": [], "total": 0, "page": 1, "pages": 0}

    admin = SimpleNamespace(
        id=uuid.uuid4(),
        email="admin@test",
        roles=["admin"],
        first_name="A",
        last_name="B",
    )

    with patch(
        "app.routers.work_orders.WorkOrderService.get_work_orders",
        new=AsyncMock(side_effect=fake_get_work_orders),
    ):
        await list_work_orders(
            request=_request(b"page=1&limit=100"),
            status_filter=None,
            client_id=None,
            technician_id=None,
            start_date=None,
            end_date=None,
            portal_prepaid_unscheduled=QueryParam(False),
            page=1,
            limit=100,
            db=MagicMock(),
            current_user=admin,
        )

    assert captured.get("portal_prepaid_unscheduled") is False


@pytest.mark.asyncio
async def test_list_work_orders_with_prepaid_param_enables_filter():
    from app.routers.work_orders import list_work_orders

    captured = {}

    async def fake_get_work_orders(**kwargs):
        captured.update(kwargs)
        return {"items": [], "total": 0, "page": 1, "pages": 0}

    admin = SimpleNamespace(
        id=uuid.uuid4(),
        email="admin@test",
        roles=["admin"],
        first_name="A",
        last_name="B",
    )

    with patch(
        "app.routers.work_orders.WorkOrderService.get_work_orders",
        new=AsyncMock(side_effect=fake_get_work_orders),
    ):
        await list_work_orders(
            request=_request(b"page=1&limit=100&portal_prepaid_unscheduled=true"),
            status_filter=None,
            client_id=None,
            technician_id=None,
            start_date=None,
            end_date=None,
            portal_prepaid_unscheduled=QueryParam(False),
            page=1,
            limit=100,
            db=MagicMock(),
            current_user=admin,
        )

    assert captured.get("portal_prepaid_unscheduled") is True


@pytest.mark.asyncio
async def test_get_work_orders_prepaid_filter_only_when_explicit_true():
    from app.services.work_order_service import WorkOrderService

    db = MagicMock()
    chain = MagicMock()
    db.query.return_value = chain
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.count.return_value = 5
    chain.all.return_value = [MagicMock()] * 5

    await WorkOrderService.get_work_orders(db, portal_prepaid_unscheduled=QueryParam(False))
    assert db.query.call_count == 1

    await WorkOrderService.get_work_orders(db, portal_prepaid_unscheduled=True)
    assert db.query.call_count == 4
