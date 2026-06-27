"""Tests for portal estimate availability gating."""

from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from app.utils.portal_estimate import (
    ESTIMATE_VALIDITY_DAYS,
    completed_diagnostic_date,
    portal_estimate_meta,
)


def _wo(status="in_progress"):
    return SimpleNamespace(id=uuid4(), status=status)


def _appt(*, status="completed", appt_type="diagnostic", scheduled_start=None, actual_start=None, actual_end=None):
    return SimpleNamespace(
        appointment_type=appt_type,
        status=status,
        scheduled_start=scheduled_start or datetime(2026, 1, 1, 10, 0),
        actual_start=actual_start,
        actual_end=actual_end,
    )


def test_no_estimate_without_completed_diagnostic():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    meta = portal_estimate_meta(_wo(), db, now=datetime(2026, 1, 15))
    assert meta["estimate_available"] is False
    assert meta["estimate_expires_at"] is None


def test_estimate_available_within_30_days_of_diagnostic():
    diagnostic_end = datetime(2026, 1, 1, 12, 0)
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = _appt(
        actual_end=diagnostic_end,
    )
    wo = _wo()
    now = diagnostic_end + timedelta(days=ESTIMATE_VALIDITY_DAYS)
    meta = portal_estimate_meta(wo, db, now=now)
    assert meta["estimate_available"] is True
    assert meta["estimate_expires_at"] == (diagnostic_end + timedelta(days=30)).isoformat()


def test_estimate_expired_after_30_days():
    diagnostic_end = datetime(2026, 1, 1, 12, 0)
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = _appt(
        actual_end=diagnostic_end,
    )
    now = diagnostic_end + timedelta(days=ESTIMATE_VALIDITY_DAYS, seconds=1)
    meta = portal_estimate_meta(_wo(), db, now=now)
    assert meta["estimate_available"] is False


def test_canceled_work_order_blocks_estimate():
    diagnostic_end = datetime(2026, 1, 1, 12, 0)
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = _appt(
        actual_end=diagnostic_end,
    )
    meta = portal_estimate_meta(_wo(status="canceled"), db, now=datetime(2026, 1, 10))
    assert meta["estimate_available"] is False


def test_completed_diagnostic_prefers_actual_end():
    appt = _appt(
        actual_start=datetime(2026, 1, 1, 9, 0),
        actual_end=datetime(2026, 1, 1, 11, 30),
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = appt
    assert completed_diagnostic_date(db, uuid4()) == datetime(2026, 1, 1, 11, 30)
