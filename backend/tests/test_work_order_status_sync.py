"""Tests for appointment → work order status sync."""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.work_order_status_sync_service import (
    APPOINTMENT_TO_WORK_ORDER_STATUS,
    COMPLETION_APPOINTMENT_STATUSES,
    normalize_appointment_status_for_update,
    resolve_work_order_status_for_appointment,
    sync_work_order_status_from_appointment,
)


@pytest.mark.parametrize(
    "appointment_status,expected_wo_status",
    [
        ("en_route", "en_route"),
        ("in_progress", "in_progress"),
        ("reschedule", "reschedule"),
        ("failed", "waiting_on_parts"),
        ("unreachable", "unreachable"),
        ("completed", "completed_pending_payment"),
        ("completed_pending_payment", "completed_pending_payment"),
        ("phone_payment", "completed_pending_payment"),
        ("scheduled", None),
    ],
)
def test_resolve_work_order_status_for_appointment_direct(
    appointment_status, expected_wo_status
):
    assert (
        resolve_work_order_status_for_appointment(appointment_status)
        == expected_wo_status
    )


def test_normalize_completed_to_pending_payment_on_open_job():
    assert normalize_appointment_status_for_update("completed") == "completed_pending_payment"


def test_normalize_completed_allowed_on_closed_job():
    assert (
        normalize_appointment_status_for_update("completed", work_order_closed=True)
        == "completed"
    )


def test_normalize_leaves_other_statuses_unchanged():
    assert normalize_appointment_status_for_update("in_progress") == "in_progress"


def test_resolve_canceled_only_visit_moves_to_reschedule():
    db = MagicMock()
    db.query.return_value.filter.return_value.count.return_value = 0
    wo_id = uuid.uuid4()
    appt_id = uuid.uuid4()
    wo = MagicMock()
    wo.id = wo_id

    assert (
        resolve_work_order_status_for_appointment(
            "canceled",
            db=db,
            work_order=wo,
            appointment_id=appt_id,
        )
        == "reschedule"
    )


def test_resolve_scheduled_promotes_pending_work_order():
    wo = MagicMock()
    wo.status = "pending"
    assert (
        resolve_work_order_status_for_appointment(
            "scheduled",
            work_order=wo,
        )
        == "scheduled"
    )


def test_resolve_scheduled_promotes_reschedule_work_order():
    wo = MagicMock()
    wo.status = "reschedule"
    assert (
        resolve_work_order_status_for_appointment(
            "scheduled",
            work_order=wo,
        )
        == "scheduled"
    )


def test_resolve_scheduled_does_not_override_waiting_on_parts():
    wo = MagicMock()
    wo.status = "waiting_on_parts"
    assert (
        resolve_work_order_status_for_appointment(
            "scheduled",
            work_order=wo,
        )
        is None
    )


@patch("app.services.work_order_status_sync_service.apply_work_order_status_change")
def test_sync_scheduled_visit_promotes_pending_work_order(mock_apply):
    mock_apply.return_value = True
    wo = MagicMock()
    wo.status = "pending"
    wo.is_closed = False
    appt = MagicMock()
    appt.status = "scheduled"
    appt.work_order = wo
    appt.work_order_id = uuid.uuid4()
    appt.id = uuid.uuid4()

    assert sync_work_order_status_from_appointment(MagicMock(), appt, uuid.uuid4()) is True
    mock_apply.assert_called_once()
    assert mock_apply.call_args[0][2] == "scheduled"


def test_phase1_mapping_keys():
    assert set(APPOINTMENT_TO_WORK_ORDER_STATUS.keys()) == {
        "en_route",
        "in_progress",
        "reschedule",
        "failed",
        "unreachable",
    }


def test_completion_statuses_set():
    assert COMPLETION_APPOINTMENT_STATUSES == frozenset({
        "completed",
        "completed_pending_payment",
        "phone_payment",
    })


@patch("app.services.work_order_status_sync_service.apply_work_order_status_change")
def test_sync_skips_completion_status_before_billing(mock_apply):
    work_order = MagicMock()
    work_order.status = "in_progress"
    work_order.is_closed = False

    appointment = MagicMock()
    appointment.status = "completed_pending_payment"
    appointment.work_order = work_order
    appointment.id = uuid.uuid4()

    result = sync_work_order_status_from_appointment(
        MagicMock(),
        appointment,
        uuid.uuid4(),
        previous_appointment_status="in_progress",
        after_billing=False,
    )

    assert result is False
    mock_apply.assert_not_called()


@patch("app.services.work_order_status_sync_service.apply_work_order_status_change")
def test_sync_completion_after_billing(mock_apply):
    mock_apply.return_value = True
    work_order = MagicMock()
    work_order.status = "in_progress"
    work_order.is_closed = False

    appointment = MagicMock()
    appointment.status = "completed_pending_payment"
    appointment.work_order = work_order
    appointment.id = uuid.uuid4()

    result = sync_work_order_status_from_appointment(
        MagicMock(),
        appointment,
        uuid.uuid4(),
        after_billing=True,
    )

    assert result is True
    assert mock_apply.call_args[0][2] == "completed_pending_payment"


@patch("app.services.work_order_status_sync_service.apply_work_order_status_change")
def test_sync_phone_payment_to_completed_pending_payment(mock_apply):
    mock_apply.return_value = True
    work_order = MagicMock()
    work_order.status = "in_progress"
    work_order.is_closed = False

    appointment = MagicMock()
    appointment.status = "phone_payment"
    appointment.work_order = work_order
    appointment.id = uuid.uuid4()

    result = sync_work_order_status_from_appointment(
        MagicMock(),
        appointment,
        uuid.uuid4(),
        after_billing=True,
    )

    assert result is True
    assert mock_apply.call_args[0][2] == "completed_pending_payment"
