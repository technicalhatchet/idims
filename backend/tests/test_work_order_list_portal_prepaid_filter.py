"""Work-order list: portal prepaid filter must only use valid appointment_status_enum values."""

from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.constants.appointment_status import (
    APPOINTMENT_STATUS_CANCELED,
    appointment_status_enum_values,
)
from app.models.work_order import WorkOrderAppointment
from app.services.work_order_service import WorkOrderService


def test_appointment_status_enum_has_canceled_not_cancelled():
    values = set(appointment_status_enum_values())
    assert APPOINTMENT_STATUS_CANCELED in values
    assert "cancelled" not in values


def test_portal_prepaid_active_appointment_filter_sql_uses_only_valid_enum():
    """PostgreSQL rejects literals not in appointment_status_enum (e.g. 'cancelled')."""
    clause = WorkOrderAppointment.status != APPOINTMENT_STATUS_CANCELED
    compiled = str(
        clause.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert "cancelled" not in compiled.lower()
    assert "canceled" in compiled


@pytest.mark.asyncio
async def test_get_work_orders_without_portal_prepaid_does_not_build_prepaid_subqueries():
    db = MagicMock()
    chain = MagicMock()
    db.query.return_value = chain
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.count.return_value = 0
    chain.all.return_value = []

    await WorkOrderService.get_work_orders(db, skip=0, limit=100, portal_prepaid_unscheduled=False)

    assert db.query.call_count == 1


@pytest.mark.asyncio
async def test_get_work_orders_with_portal_prepaid_builds_payment_and_appointment_subqueries():
    db = MagicMock()
    chain = MagicMock()
    db.query.return_value = chain
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.count.return_value = 0
    chain.all.return_value = []

    await WorkOrderService.get_work_orders(db, skip=0, limit=100, portal_prepaid_unscheduled=True)

    assert db.query.call_count == 3
