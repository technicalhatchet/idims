"""Parent WO moves to redo only when child is created."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.work_order_redo_service import create_redo_from_appointment


@pytest.mark.asyncio
@patch("app.services.work_order_redo_service.WorkOrderService.create_work_order", new_callable=AsyncMock)
@patch("app.services.work_order_redo_service.apply_work_order_status_change")
@patch("app.services.work_order_redo_service.WorkOrderService._schedule_notifications", new_callable=AsyncMock)
def test_create_redo_sets_parent_status_to_redo(mock_notify, mock_apply_status, mock_create_wo):
    parent_id = uuid.uuid4()
    appt_id = uuid.uuid4()
    user_id = uuid.uuid4()

    parent = MagicMock()
    parent.id = parent_id
    parent.order_number = "OB-001"
    parent.status = "completed"
    parent.service_items = []
    parent.equipment_make = None
    parent.equipment_model = None
    parent.equipment_serial = None
    parent.equipment_version = None
    parent.equipment_type = None
    parent.equipment_subtype = None
    parent.is_wall_mounted = False
    parent.equipment_notes = None
    parent.symptoms = None
    parent.assigned_technician_id = None
    parent.service_location = None
    parent.priority = "medium"
    parent.client_id = uuid.uuid4()

    appt = MagicMock()
    appt.id = appt_id
    appt.status = "redo"
    appt.services = []
    appt.appointment_type = "repair"
    appt.assigned_technician_id = None
    appt.time_window = None
    parent.appointments = [appt]

    child = MagicMock()
    child.id = uuid.uuid4()
    child.order_number = "OB-001-R1"
    mock_create_wo.return_value = child

    db = MagicMock()
    db.query.return_value.options.return_value.filter.return_value.first.side_effect = [
        parent,
        None,
        None,
    ]
    db.query.return_value.filter.return_value.first.return_value = None

    import asyncio

    asyncio.get_event_loop().run_until_complete(
        create_redo_from_appointment(
            db,
            parent_work_order_id=parent_id,
            appointment_id=appt_id,
            user_id=user_id,
            scheduled_start=datetime.utcnow() + timedelta(days=1),
            scheduled_end=datetime.utcnow() + timedelta(days=1, hours=1),
        )
    )

    mock_apply_status.assert_called_once()
    assert mock_apply_status.call_args[0][1] is parent
    assert mock_apply_status.call_args[0][2] == "redo"
