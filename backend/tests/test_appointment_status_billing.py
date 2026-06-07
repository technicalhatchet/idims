"""Appointment status → WorkOrderService billing_status."""

from unittest.mock import MagicMock
import uuid

from app.services.work_order_billing_helpers import apply_appointment_status_billing


def test_completed_pending_payment_makes_linked_sku_billable():
    db = MagicMock()
    wo_id = uuid.uuid4()
    appt_id = uuid.uuid4()
    service_id = uuid.uuid4()

    work_order = MagicMock()
    work_order.id = wo_id
    work_order.is_closed = False

    line = MagicMock()
    line.billing_status = "not_billable"
    line.appointment_id = None
    line.service_id = service_id

    appt = MagicMock()
    appt.services = [MagicMock(id=service_id)]

    assoc_result = MagicMock()
    assoc_result.fetchall.return_value = []

    db.execute.return_value = assoc_result
    db.query.return_value.options.return_value.filter.return_value.first.return_value = appt
    db.query.return_value.filter.return_value.all.return_value = [line]

    updated = apply_appointment_status_billing(
        db,
        work_order=work_order,
        appointment_id=appt_id,
        new_status="completed_pending_payment",
    )

    assert updated == 1
    assert line.billing_status == "billable"
    assert line.appointment_id == appt_id
    work_order.calculate_totals.assert_called_once()
