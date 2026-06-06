"""Tests for appointment → work order status sync (phase 1)."""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.work_order_status_sync_service import (
    APPOINTMENT_TO_WORK_ORDER_STATUS,
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
        ("scheduled", None),
        ("completed", None),
    ],
)
def test_resolve_work_order_status_for_appointment(appointment_status, expected_wo_status):
    assert resolve_work_order_status_for_appointment(appointment_status) == expected_wo_status


def test_phase1_mapping_includes_all_field_visit_statuses():
    assert set(APPOINTMENT_TO_WORK_ORDER_STATUS.keys()) == {
        "en_route",
        "in_progress",
        "reschedule",
        "failed",
        "unreachable",
    }


@patch("app.services.work_order_status_sync_service.apply_work_order_status_change")
def test_sync_updates_work_order_from_failed_apr(mock_apply):
    mock_apply.return_value = True
    user_id = uuid.uuid4()
    wo_id = uuid.uuid4()

    work_order = MagicMock()
    work_order.id = wo_id
    work_order.status = "in_progress"
    work_order.is_closed = False

    appointment = MagicMock()
    appointment.status = "failed"
    appointment.work_order = work_order
    appointment.work_order_id = wo_id

    db = MagicMock()

    result = sync_work_order_status_from_appointment(
        db,
        appointment,
        user_id,
        previous_appointment_status="in_progress",
    )

    assert result is True
    mock_apply.assert_called_once_with(
        db,
        work_order,
        "waiting_on_parts",
        user_id,
        notes="Status synced from appointment APR → waiting on parts",
    )


@patch("app.services.work_order_status_sync_service.apply_work_order_status_change")
def test_sync_skips_closed_work_order(mock_apply):
    work_order = MagicMock()
    work_order.status = "scheduled"
    work_order.is_closed = True

    appointment = MagicMock()
    appointment.status = "en_route"
    appointment.work_order = work_order

    result = sync_work_order_status_from_appointment(
        MagicMock(),
        appointment,
        uuid.uuid4(),
        previous_appointment_status="scheduled",
    )

    assert result is False
    mock_apply.assert_not_called()


@patch("app.services.work_order_status_sync_service.apply_work_order_status_change")
def test_sync_skips_protected_work_order_statuses(mock_apply):
    work_order = MagicMock()
    work_order.status = "on_hold"
    work_order.is_closed = False

    appointment = MagicMock()
    appointment.status = "in_progress"
    appointment.work_order = work_order

    result = sync_work_order_status_from_appointment(
        MagicMock(),
        appointment,
        uuid.uuid4(),
        previous_appointment_status="en_route",
    )

    assert result is False
    mock_apply.assert_not_called()


@patch("app.services.work_order_status_sync_service.apply_work_order_status_change")
def test_sync_no_op_when_appointment_status_unchanged(mock_apply):
    appointment = MagicMock()
    appointment.status = "en_route"
    appointment.work_order = MagicMock(is_closed=False, status="scheduled")

    result = sync_work_order_status_from_appointment(
        MagicMock(),
        appointment,
        uuid.uuid4(),
        previous_appointment_status="en_route",
    )

    assert result is False
    mock_apply.assert_not_called()
