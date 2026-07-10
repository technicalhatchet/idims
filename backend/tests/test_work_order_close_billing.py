"""Close readiness billing gates — canceled repair visits should not block."""

import uuid
from unittest.mock import MagicMock, patch

from app.services.work_order_billing_helpers import apply_appointment_status_billing
from app.services.work_order_completion_service import (
    has_outstanding_billable_skus,
    has_unpaid_scheduled_repair,
    is_work_order_financially_closed,
)


def _line(name, billing_status, *, service_type=None, appointment_id=None):
    line = MagicMock()
    line.name = name
    line.billing_status = billing_status
    line.appointment_id = appointment_id
    service = MagicMock() if service_type else None
    if service:
        service.service_type = service_type
    line.service = service
    return line


def _appt(status, appt_id=None):
    appt = MagicMock()
    appt.id = appt_id or uuid.uuid4()
    appt.status = status
    return appt


def test_canceled_appointment_waives_linked_skus():
    db = MagicMock()
    appt_id = uuid.uuid4()

    work_order = MagicMock()
    work_order.is_closed = False

    line = MagicMock()
    line.billing_status = "not_billable"
    line.appointment_id = appt_id

    with patch(
        "app.services.work_order_billing_helpers.work_order_services_for_appointment",
        return_value=[line],
    ):
        updated = apply_appointment_status_billing(
            db,
            work_order=work_order,
            appointment_id=appt_id,
            new_status="canceled",
        )

    assert updated == 1
    assert line.billing_status == "waived"
    work_order.calculate_totals.assert_called_once()


def test_completed_diagnostic_and_canceled_repair_can_close():
    diag_appt = _appt("completed")
    repair_appt = _appt("canceled")

    work_order = MagicMock()
    work_order.service_items = [
        _line("Range Diagnostic", "paid", service_type="diagnostic", appointment_id=diag_appt.id),
        _line("Element Repair", "not_billable", service_type="repair", appointment_id=repair_appt.id),
    ]
    work_order.appointments = [diag_appt, repair_appt]

    assert not has_outstanding_billable_skus(work_order)
    assert not has_unpaid_scheduled_repair(work_order)
    assert is_work_order_financially_closed(work_order)


def test_waived_repair_does_not_block_close():
    repair_appt = _appt("canceled")

    work_order = MagicMock()
    work_order.service_items = [
        _line("Element Repair", "waived", service_type="repair", appointment_id=repair_appt.id),
    ]
    work_order.appointments = [repair_appt]

    assert not has_unpaid_scheduled_repair(work_order)


def test_scheduled_repair_still_blocks_close():
    repair_appt = _appt("scheduled")

    work_order = MagicMock()
    work_order.service_items = [
        _line("Element Repair", "not_billable", service_type="repair", appointment_id=repair_appt.id),
    ]
    work_order.appointments = [repair_appt]

    assert has_unpaid_scheduled_repair(work_order)
