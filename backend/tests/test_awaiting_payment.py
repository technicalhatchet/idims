"""Awaiting Pay: due-later math matches the frontend, days open, send channels."""

import uuid
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.services.awaiting_payment_service import days_open, owed_since, record_send
from app.services.work_order_billing_helpers import compute_balance_due, compute_due_later


def _line(name, service_type, price, status, sku="SKU"):
    return SimpleNamespace(
        id=uuid.uuid4(), appointment_id=None, service_id=uuid.uuid4(), name=name,
        price=Decimal(str(price)), billing_status=status,
        service=SimpleNamespace(service_type=service_type, sku_code=sku),
    )


def _wo(lines, parts=None, paid=0, appointments=None, stamped=None):
    return SimpleNamespace(
        id=uuid.uuid4(), service_items=lines, parts=parts or [], appointments=appointments or [],
        tax_rate=Decimal("0.0775"), amount_previously_paid=Decimal(str(paid)),
        diagnostic_discount_amount=stamped, diagnostic_credit_mode="half",
        updated_at=datetime(2026, 11, 1, 12, 0),
    )


def _part(price, status):
    return SimpleNamespace(price=Decimal(str(price)), status=status)


def test_diag_owed_now_repair_estimate_later():
    # Tonight's job: $89 diag owed, $225 repair + $100 part on the estimate.
    wo = _wo(
        [_line("Diagnostic", "diagnostic", 89, "billable", "DIAG"), _line("Washer Repair", "repair", 225, "not_billable")],
        parts=[_part(100, "needed")],
    )
    assert compute_balance_due(wo) == Decimal("89.00")
    # 89 + 225 + 100 + 7.75 tax - 45 credit - 89 due now
    assert compute_due_later(wo) == Decimal("287.75")


def test_due_later_after_diag_paid():
    wo = _wo(
        [_line("Diagnostic", "diagnostic", 89, "paid", "DIAG"), _line("Washer Repair", "repair", 225, "not_billable")],
        parts=[_part(100, "needed")],
        paid=89,
    )
    assert compute_balance_due(wo) == Decimal("0.00")
    assert compute_due_later(wo) == Decimal("287.75")


def test_nothing_later_when_everything_billed():
    wo = _wo([_line("Diagnostic", "diagnostic", 89, "billable", "DIAG")])
    assert compute_due_later(wo) == Decimal("0.00")


def test_days_open_uses_latest_payment_ready_visit():
    appts = [
        SimpleNamespace(status="completed", actual_end=None, scheduled_start=datetime(2026, 10, 20, 14)),
        SimpleNamespace(status="completed_pending_payment", actual_end=datetime(2026, 11, 2, 18), scheduled_start=datetime(2026, 11, 2, 15)),
        SimpleNamespace(status="scheduled", actual_end=None, scheduled_start=datetime(2026, 11, 20, 9)),
    ]
    wo = _wo([], appointments=appts)
    assert owed_since(wo) == datetime(2026, 11, 2, 18)
    assert days_open(wo, now=datetime(2026, 11, 6, 20)) == 4


def test_days_open_falls_back_to_updated_at():
    wo = _wo([])
    assert days_open(wo, now=datetime(2026, 11, 6)) == 5


def test_bad_channel_rejected_before_db():
    with pytest.raises(ValueError):
        record_send(None, uuid.uuid4(), "carrier pigeon", None)
