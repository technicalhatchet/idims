"""Payment must not complete open visits; portal prepay skips visit/completion side effects."""

import uuid
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.work_order_completion_service import (
    try_auto_complete_after_payment,
    work_order_allows_payment_driven_completion,
)
from app.services.work_order_payment_service import apply_payment_to_work_order


def _appt(status: str):
    return SimpleNamespace(id=uuid.uuid4(), status=status, scheduled_start=None)


def test_work_order_allows_payment_driven_completion_cpp_wo():
    wo = SimpleNamespace(status="completed_pending_payment", appointments=[])
    assert work_order_allows_payment_driven_completion(wo) is True


def test_work_order_allows_payment_driven_completion_phone_payment_visit():
    wo = SimpleNamespace(status="in_progress", appointments=[_appt("phone_payment")])
    assert work_order_allows_payment_driven_completion(wo) is True


def test_work_order_allows_payment_driven_completion_blocks_scheduled_only():
    wo = SimpleNamespace(status="scheduled", appointments=[_appt("scheduled")])
    assert work_order_allows_payment_driven_completion(wo) is False


def test_try_auto_complete_skips_when_visit_not_payment_ready():
    wo = SimpleNamespace(
        id=uuid.uuid4(),
        status="pending",
        appointments=[_appt("scheduled")],
        service_items=[],
        parts=[],
        is_closed=False,
        updated_by=uuid.uuid4(),
        created_by=uuid.uuid4(),
    )
    db = MagicMock()
    result = try_auto_complete_after_payment(db, wo, user_id=wo.updated_by)
    assert result["work_order_completed"] is False
    assert wo.status == "pending"


def test_portal_prepayment_skips_visit_and_auto_complete():
    wo = SimpleNamespace(
        id=uuid.uuid4(),
        status="pending",
        appointments=[],
        amount_previously_paid=Decimal("0"),
        tax_collected=Decimal("0"),
        tax_rate=Decimal("0.0775"),
        updated_by=uuid.uuid4(),
        created_by=uuid.uuid4(),
        service_items=[],
        parts=[],
    )
    db = MagicMock()
    wo.calculate_totals = MagicMock()

    with patch(
        "app.services.work_order_payment_service.complete_pending_payment_appointments"
    ) as complete_appts, patch(
        "app.services.work_order_payment_service.try_auto_complete_after_payment"
    ) as auto_complete:
        result = apply_payment_to_work_order(
            db,
            wo,
            124.0,
            mark_billable_services_paid=False,
            advance_visit_and_completion=False,
            user_id=wo.updated_by,
        )

    complete_appts.assert_not_called()
    auto_complete.assert_not_called()
    assert result["work_order_completed"] is False
    assert wo.status == "pending"
    assert wo.amount_previously_paid == Decimal("124.0")


def test_field_payment_runs_auto_complete_path_when_visit_ready():
    wo = SimpleNamespace(
        id=uuid.uuid4(),
        status="completed_pending_payment",
        appointments=[_appt("completed_pending_payment")],
        amount_previously_paid=Decimal("0"),
        tax_collected=Decimal("0"),
        tax_rate=Decimal("0.0775"),
        updated_by=uuid.uuid4(),
        created_by=uuid.uuid4(),
        service_items=[],
        parts=[],
    )
    wo.calculate_totals = MagicMock()
    db = MagicMock()

    with patch(
        "app.services.work_order_payment_service.complete_pending_payment_appointments",
        return_value=1,
    ) as complete_appts, patch(
        "app.services.work_order_payment_service.try_auto_complete_after_payment",
        return_value={"work_order_completed": True, "needs_repair_outcome": False},
    ) as auto_complete:
        result = apply_payment_to_work_order(
            db,
            wo,
            50.0,
            user_id=wo.updated_by,
        )

    complete_appts.assert_called_once()
    auto_complete.assert_called_once()
    assert result["work_order_completed"] is True
