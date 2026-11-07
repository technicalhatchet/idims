"""Diagnostic credit shows on estimates before anything is billable; full diag is still owed until repair completes."""

import uuid
from decimal import Decimal
from types import SimpleNamespace

from app.services.work_order_billing_helpers import (
    compute_balance_due,
    diagnostic_credit_base,
    diagnostic_discount_amount,
)
from pdf.work_order_adapter import compute_totals


def _line(name, service_type, price, status, sku="SKU"):
    return SimpleNamespace(
        id=uuid.uuid4(),
        appointment_id=None,
        service_id=uuid.uuid4(),
        name=name,
        price=Decimal(str(price)),
        billing_status=status,
        service=SimpleNamespace(service_type=service_type, sku_code=sku),
    )


def _wo(lines, *, stamped=None, mode="half", appointments=None, paid=0):
    return SimpleNamespace(
        id=uuid.uuid4(),
        service_items=lines,
        parts=[],
        appointments=appointments or [],
        tax_rate=Decimal("0.0775"),
        amount_previously_paid=Decimal(str(paid)),
        diagnostic_discount_amount=stamped,
        diagnostic_credit_mode=mode,
    )


def test_estimate_with_everything_not_billable_has_credit_base():
    wo = _wo([
        _line("Diagnostic", "diagnostic", 89, "not_billable", sku="DIAG"),
        _line("Washer Repair", "repair", 225, "not_billable"),
    ])
    assert diagnostic_credit_base(wo) == Decimal("89.00")


def test_trip_charge_and_waived_diag_never_count():
    wo = _wo([
        _line("Trip Charge", "diagnostic", 35, "billable", sku="TRIP-CHARGE"),
        _line("Diagnostic", "diagnostic", 89, "waived", sku="DIAG"),
        _line("Washer Repair", "repair", 225, "not_billable"),
    ])
    assert diagnostic_credit_base(wo) == Decimal("0")


def test_stamped_amount_wins():
    wo = _wo([_line("Diagnostic", "diagnostic", 89, "paid")], stamped=Decimal("79.00"))
    assert diagnostic_credit_base(wo) == Decimal("79.00")


def test_full_diag_collected_now_no_credit_until_repair_done():
    # Diag visit pending payment, repair only on the estimate: owe the whole $89.
    appt = SimpleNamespace(id=uuid.uuid4(), status="completed_pending_payment", services=[], appointment_type="diagnostic")
    diag = _line("Diagnostic", "diagnostic", 89, "billable", sku="DIAG")
    diag.appointment_id = appt.id
    wo = _wo([diag, _line("Washer Repair", "repair", 225, "not_billable")], appointments=[appt])
    assert compute_balance_due(wo) == Decimal("89.00")


def test_uncharged_diag_is_not_credited_in_money_math():
    wo = _wo([
        _line("Diagnostic", "diagnostic", 89, "not_billable", sku="DIAG"),
        _line("Washer Repair", "repair", 225, "billable"),
    ])
    assert diagnostic_discount_amount(wo) == Decimal("0")


def test_estimate_pdf_totals_show_half_credit():
    rd = {
        "services": [
            {"name": "Diagnostic", "service_type": "diagnostic", "price": 89, "billing_status": "not_billable"},
            {"name": "Washer Repair", "service_type": "repair", "price": 225, "billing_status": "not_billable"},
        ],
        "parts": [{"price": 100, "status": "needed"}],
        "tax_rate": 0.0775,
        "diagnostic_discount_amount": 89.0,
        "diagnostic_credit_mode": "half",
        "line_preset": "full",
    }
    totals = compute_totals(rd, is_estimate=True)
    assert totals["discount"] == 45.0
    # 89 + 225 + 100 + 7.75 tax - 45
    assert totals["total"] == 376.75
