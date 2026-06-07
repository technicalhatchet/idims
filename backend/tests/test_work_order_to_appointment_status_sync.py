"""Tests for phase 3: work order status → appointment sync."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.services.work_order_status_sync_service import (
    sync_appointments_from_work_order_status,
)


def _appt(appt_id, start, status="scheduled"):
    a = MagicMock()
    a.id = appt_id
    a.scheduled_start = start
    a.status = status
    return a


@patch(
    "app.services.work_order_status_sync_service._active_appointments_for_work_order"
)
@patch("app.services.work_order_status_sync_service._apply_appointment_status_change")
def test_wo_reschedule_updates_next_future_visit(mock_apply, mock_load):
    mock_apply.return_value = True
    now = datetime.utcnow()
    future = _appt(uuid.uuid4(), now + timedelta(days=2))
    mock_load.return_value = [_appt(uuid.uuid4(), now - timedelta(days=1), "completed"), future]

    wo = MagicMock()
    wo.id = uuid.uuid4()
    wo.is_closed = False

    count = sync_appointments_from_work_order_status(
        MagicMock(),
        wo,
        uuid.uuid4(),
        previous_work_order_status="scheduled",
        new_work_order_status="reschedule",
    )

    assert count == 1
    mock_apply.assert_called_once()
    assert mock_apply.call_args[0][2] == "reschedule"


@patch(
    "app.services.work_order_status_sync_service._active_appointments_for_work_order"
)
@patch("app.services.work_order_status_sync_service._apply_appointment_status_change")
def test_wo_canceled_cancels_future_visits(mock_apply, mock_load):
    mock_apply.return_value = True
    now = datetime.utcnow()
    mock_load.return_value = [
        _appt(uuid.uuid4(), now - timedelta(days=1), "completed"),
        _appt(uuid.uuid4(), now + timedelta(days=1), "scheduled"),
        _appt(uuid.uuid4(), now + timedelta(days=3), "scheduled"),
    ]

    wo = MagicMock()
    wo.id = uuid.uuid4()
    wo.is_closed = False

    count = sync_appointments_from_work_order_status(
        MagicMock(),
        wo,
        uuid.uuid4(),
        previous_work_order_status="scheduled",
        new_work_order_status="canceled",
    )

    assert count == 2
    assert mock_apply.call_count == 2
    assert all(call[0][2] == "canceled" for call in mock_apply.call_args_list)


@patch(
    "app.services.work_order_status_sync_service._active_appointments_for_work_order"
)
@patch("app.services.work_order_status_sync_service._apply_appointment_status_change")
def test_wo_waiting_on_parts_leaves_visits_alone(mock_apply, mock_load):
    mock_load.return_value = [_appt(uuid.uuid4(), datetime.utcnow() + timedelta(days=1))]

    wo = MagicMock()
    wo.id = uuid.uuid4()
    wo.is_closed = False

    count = sync_appointments_from_work_order_status(
        MagicMock(),
        wo,
        uuid.uuid4(),
        previous_work_order_status="in_progress",
        new_work_order_status="waiting_on_parts",
    )

    assert count == 0
    mock_apply.assert_not_called()


@patch(
    "app.services.work_order_status_sync_service._active_appointments_for_work_order"
)
@patch("app.services.work_order_status_sync_service._apply_appointment_status_change")
def test_wo_en_route_syncs_todays_driver_visit(mock_apply, mock_load):
    mock_apply.return_value = True
    now = datetime.utcnow()
    today = _appt(uuid.uuid4(), now.replace(hour=14, minute=0, second=0, microsecond=0))
    tomorrow = _appt(uuid.uuid4(), now + timedelta(days=1))
    mock_load.return_value = [today, tomorrow]

    wo = MagicMock()
    wo.id = uuid.uuid4()
    wo.is_closed = False

    count = sync_appointments_from_work_order_status(
        MagicMock(),
        wo,
        uuid.uuid4(),
        previous_work_order_status="scheduled",
        new_work_order_status="en_route",
    )

    assert count == 1
    mock_apply.assert_called_once()
    assert mock_apply.call_args[0][1] is today
    assert mock_apply.call_args[0][2] == "en_route"
