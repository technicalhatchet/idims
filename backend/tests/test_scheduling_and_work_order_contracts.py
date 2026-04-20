"""
Contract tests for scheduling preview + composite work-order payloads.

These validate Pydantic models only (no FastAPI app import) so `pytest` stays reliable
across environments; use the API manually or add full-stack tests when all deps match production.
"""
import uuid

import pytest
from pydantic import ValidationError

from app.schemas.scheduling import AppointmentPreviewResponse
from app.schemas.work_order import WorkOrderWithInitialAppointmentCreate


def test_work_order_with_initial_appointment_create_parses():
    cid = uuid.uuid4()
    payload = {
        "client_id": str(cid),
        "description": "Install and test",
        "priority": "medium",
        "service_location": {"address": "100 Oak St"},
        "initial_appointment": {
            "appointment_type": "diagnostic",
            "scheduled_start": "2026-07-10T14:00:00+00:00",
            "service_ids": [],
        },
    }
    m = WorkOrderWithInitialAppointmentCreate.model_validate(payload)
    assert m.client_id == cid
    assert m.initial_appointment.appointment_type == "diagnostic"


def test_work_order_with_initial_appointment_rejects_bad_appointment_type():
    cid = str(uuid.uuid4())
    payload = {
        "client_id": cid,
        "description": "x",
        "priority": "medium",
        "service_location": {"address": "1 Main"},
        "initial_appointment": {
            "appointment_type": "not-a-real-type",
            "scheduled_start": "2026-07-10T14:00:00+00:00",
        },
    }
    with pytest.raises(ValidationError):
        WorkOrderWithInitialAppointmentCreate.model_validate(payload)


def test_appointment_preview_response_shape():
    data = {
        "date": "2026-08-01",
        "duration_minutes": 60,
        "business_hours": {"start": "08:00", "end": "17:00"},
        "slot_interval_minutes": 30,
        "slots": [
            {
                "start_time": "2026-08-01T08:00:00",
                "end_time": "2026-08-01T09:00:00",
                "technician_id": str(uuid.uuid4()),
                "technician_name": "Test Tech",
            }
        ],
    }
    r = AppointmentPreviewResponse.model_validate(data)
    assert r.date == "2026-08-01"
    assert len(r.slots) == 1
    assert r.slots[0].technician_name == "Test Tech"
