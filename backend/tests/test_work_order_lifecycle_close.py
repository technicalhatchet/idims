"""Close readiness: visits must be canceled or completed (not pending payment)."""

from unittest.mock import MagicMock

from app.services.work_order_lifecycle_service import (
    CLOSE_ELIGIBLE_APPOINTMENT_STATUSES,
    all_appointments_close_eligible,
)


def _appt(status: str):
    a = MagicMock()
    a.status = status
    return a


def test_close_eligible_when_all_visits_done_or_canceled():
    wo = MagicMock()
    wo.appointments = [
        _appt("completed"),
        _appt("canceled"),
        _appt("redo"),
    ]
    assert all_appointments_close_eligible(wo) is True


def test_close_blocked_when_visit_still_scheduled():
    wo = MagicMock()
    wo.appointments = [_appt("completed"), _appt("scheduled")]
    assert all_appointments_close_eligible(wo) is False


def test_earlier_apr_visit_does_not_block_close():
    # An APR ("failed") visit followed by a completed return visit must not trap the job
    # open. Close still separately requires the job completed, paid and an outcome logged.
    wo = MagicMock()
    wo.appointments = [_appt("failed"), _appt("completed")]
    assert all_appointments_close_eligible(wo) is True


def test_close_blocked_when_visit_completed_pending_payment():
    wo = MagicMock()
    wo.appointments = [_appt("completed_pending_payment")]
    assert all_appointments_close_eligible(wo) is False
    assert "completed_pending_payment" not in CLOSE_ELIGIBLE_APPOINTMENT_STATUSES


def test_close_blocked_when_visit_phone_payment():
    wo = MagicMock()
    wo.appointments = [_appt("phone_payment")]
    assert all_appointments_close_eligible(wo) is False
    assert "phone_payment" not in CLOSE_ELIGIBLE_APPOINTMENT_STATUSES
