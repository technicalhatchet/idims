"""Balance due must include paid service lines (e.g. prepaid diagnostic) before subtracting payments."""

import uuid
from decimal import Decimal
from unittest.mock import MagicMock

from app.services.work_order_billing_helpers import (
    compute_balance_due,
    compute_balance_due_legacy_billable_services_only,
)


def _line(*, price, billing_status, service_type="repair", name="Repair"):
    line = MagicMock()
    line.price = Decimal(str(price))
    line.billing_status = billing_status
    line.name = name
    line.appointment_id = None
    line.service_id = uuid.uuid4()
    line.service = MagicMock()
    line.service.service_type = service_type
    return line


def _ct001020_work_order(*, amount_previously_paid: float, diagnostic_credit_mode: str = "half"):
    appt_id = uuid.uuid4()
    appt = MagicMock()
    appt.id = appt_id
    appt.status = "completed_pending_payment"
    appt.services = []

    diag = _line(price=89, billing_status="paid", service_type="diagnostic", name="Diagnostic")
    diag.appointment_id = appt_id
    repair = _line(price=128, billing_status="billable", service_type="repair", name="Repair")
    repair.appointment_id = appt_id

    wo = MagicMock()
    wo.appointments = [appt]
    wo.service_items = [diag, repair]
    wo.parts = []
    wo.tax_rate = Decimal("0")
    wo.diagnostic_discount_amount = Decimal("89.00")
    wo.diagnostic_credit_mode = diagnostic_credit_mode
    wo.amount_previously_paid = Decimal(str(amount_previously_paid))
    return wo


def test_ct001020_half_discount_after_diag_prepaid():
    wo = _ct001020_work_order(amount_previously_paid=89.0, diagnostic_credit_mode="half")
    assert compute_balance_due(wo) == Decimal("83.00")


def test_ct001020_full_diagnostic_credit_after_diag_prepaid():
    wo = _ct001020_work_order(amount_previously_paid=89.0, diagnostic_credit_mode="full")
    assert compute_balance_due(wo) == Decimal("39.00")


def test_ct001020_no_prepayment_net_after_half_discount():
    wo = _ct001020_work_order(amount_previously_paid=0, diagnostic_credit_mode="half")
    # (89 + 128) - 0 - 45 diagnostic credit (half rounded up)
    assert compute_balance_due(wo) == Decimal("172.00")


def test_legacy_calc_underreports_when_diag_marked_paid():
    wo = _ct001020_work_order(amount_previously_paid=89.0, diagnostic_credit_mode="half")
    assert compute_balance_due_legacy_billable_services_only(wo, half_diagnostic_discount=True) == Decimal(
        "0.00"
    )
    assert compute_balance_due(wo) == Decimal("83.00")


def test_work_order_summary_due_matches_compute_balance_due():
    from app.models.work_order import WorkOrder

    wo = _ct001020_work_order(amount_previously_paid=89.0, diagnostic_credit_mode="half")
    summary = WorkOrder.get_billing_status_summary(wo)
    assert summary["due_today"] == compute_balance_due(wo)
