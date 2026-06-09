"""Diagnostic discount applies when a visit with repair SKU(s) completes (not appointment_type)."""

import uuid
from decimal import Decimal
from unittest.mock import MagicMock

from app.services.work_order_billing_helpers import (
    appointment_has_repair_sku,
    compute_balance_due,
    has_completed_repair_appointment,
)


def _make_service_line(*, service_type="repair", appointment_id=None, name="Repair"):
    line = MagicMock()
    line.appointment_id = appointment_id
    line.service_id = uuid.uuid4()
    line.name = name
    line.price = Decimal("100.00")
    line.billing_status = "billable"
    line.service = MagicMock()
    line.service.service_type = service_type
    return line


def test_one_stop_diagnostic_visit_with_repair_sku_qualifies_for_discount():
    appt_id = uuid.uuid4()
    appt = MagicMock()
    appt.id = appt_id
    appt.appointment_type = "diagnostic"
    appt.status = "completed_pending_payment"
    appt.services = []

    work_order = MagicMock()
    work_order.appointments = [appt]
    work_order.service_items = [
        _make_service_line(service_type="diagnostic", appointment_id=appt_id, name="Diagnostic"),
        _make_service_line(service_type="repair", appointment_id=appt_id, name="Repair"),
    ]
    work_order.diagnostic_discount_amount = Decimal("50.00")
    work_order.tax_rate = Decimal("0")
    work_order.amount_previously_paid = Decimal("0")
    work_order.parts = []

    assert appointment_has_repair_sku(work_order, appt)
    assert has_completed_repair_appointment(work_order)

    due = compute_balance_due(work_order)
    # 100 diag + 100 repair billable - 50 discount
    assert due == Decimal("150.00")


def test_diagnostic_only_visit_does_not_qualify():
    appt_id = uuid.uuid4()
    appt = MagicMock()
    appt.id = appt_id
    appt.appointment_type = "diagnostic"
    appt.status = "completed_pending_payment"
    appt.services = []

    work_order = MagicMock()
    work_order.appointments = [appt]
    work_order.service_items = [
        _make_service_line(service_type="diagnostic", appointment_id=appt_id, name="Diagnostic"),
    ]
    work_order.diagnostic_discount_amount = Decimal("50.00")
    work_order.tax_rate = Decimal("0")
    work_order.amount_previously_paid = Decimal("0")
    work_order.parts = []

    assert not appointment_has_repair_sku(work_order, appt)
    assert not has_completed_repair_appointment(work_order)


def test_legacy_repair_appointment_type_without_repair_sku_does_not_qualify():
    appt = MagicMock()
    appt.id = uuid.uuid4()
    appt.appointment_type = "repair"
    appt.status = "completed"
    appt.services = []

    work_order = MagicMock()
    work_order.appointments = [appt]
    work_order.service_items = [
        _make_service_line(service_type="diagnostic", appointment_id=appt.id, name="Diagnostic"),
    ]

    assert not has_completed_repair_appointment(work_order)
