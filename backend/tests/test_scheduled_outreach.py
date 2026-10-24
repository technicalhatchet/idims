"""Beat-driven scheduled outreach (due_at, no double-send)."""

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.background.tasks.scheduled_outreach import (
    _process_due_appointment_reminders,
    _process_due_review_requests,
    process_scheduled_outreach_tick,
)
from app.utils.datetime_utils import utcnow_naive


def test_tick_exits_when_flags_off():
    db = MagicMock()
    with patch(
        "app.background.tasks.scheduled_outreach.SessionLocal",
        return_value=db,
    ):
        with patch(
            "app.services.worker_feature_flags_service.worker_feature_enabled",
            return_value=False,
        ):
            result = process_scheduled_outreach_tick()
    assert result == {"reviews_sent": 0, "appointment_reminders_sent": 0}


def test_review_due_not_cleared_on_test_mode_skip():
    db = MagicMock()
    wo = MagicMock()
    wo.id = uuid.uuid4()
    wo.review_due_at = utcnow_naive() - timedelta(minutes=1)
    db.query.return_value.filter.return_value.all.return_value = [wo]

    with patch(
        "app.services.portal_review_request_service.review_request_eligibility",
        return_value=None,
    ):
        with patch(
            "app.services.portal_review_request_service.send_portal_review_request",
            new_callable=AsyncMock,
            return_value={"sent": False, "reason": "test_mode"},
        ):
            sent = _process_due_review_requests(db)

    assert sent == 0
    assert wo.review_due_at is not None
    db.commit.assert_called_once()


def test_appointment_reminder_marks_sent_once():
    db = MagicMock()
    fixed_now = datetime(2026, 10, 23, 12, 0, 0)
    appt = MagicMock()
    appt.id = uuid.uuid4()
    appt.scheduled_start = fixed_now + timedelta(hours=24)
    appt.appointment_reminder_sent_at = None
    appt.status = "scheduled"
    appt.work_order = MagicMock()
    appt.work_order.client = MagicMock()

    filt = MagicMock()
    filt.all.return_value = [appt]
    db.query.return_value.options.return_value.filter.return_value = filt

    with patch(
        "app.background.tasks.scheduled_outreach.joinedload",
        return_value=MagicMock(),
    ):
        with patch(
            "app.utils.datetime_utils.utcnow_naive",
            return_value=fixed_now,
        ):
            with patch(
                "app.services.appointment_reminder_service.send_appointment_reminder_email",
                new_callable=AsyncMock,
                return_value=True,
            ):
                count = _process_due_appointment_reminders(db)

    assert count == 1
    assert appt.appointment_reminder_sent_at == fixed_now
    db.commit.assert_called_once()


def test_appointment_reminder_no_double_send_when_email_fails():
    db = MagicMock()
    fixed_now = datetime(2026, 10, 23, 12, 0, 0)
    appt = MagicMock()
    appt.scheduled_start = fixed_now + timedelta(hours=24)
    appt.appointment_reminder_sent_at = None
    appt.status = "scheduled"
    appt.work_order = MagicMock()

    filt = MagicMock()
    filt.all.return_value = [appt]
    db.query.return_value.options.return_value.filter.return_value = filt

    with patch(
        "app.background.tasks.scheduled_outreach.joinedload",
        return_value=MagicMock(),
    ):
        with patch(
            "app.utils.datetime_utils.utcnow_naive",
            return_value=fixed_now,
        ):
            with patch(
                "app.services.appointment_reminder_service.send_appointment_reminder_email",
                new_callable=AsyncMock,
                return_value=False,
            ):
                count = _process_due_appointment_reminders(db)

    assert count == 0
    assert appt.appointment_reminder_sent_at is None
    db.commit.assert_not_called()
