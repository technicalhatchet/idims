"""TechDeck dashboard stats helpers."""

from datetime import date, datetime, timedelta

from app.services.work_order_dashboard_stats_service import (
    _local_day_bounds,
    work_order_eligible_for_parts_waiting,
)


def test_local_day_bounds_uses_timezone_offset():
    local = date(2026, 10, 24)
    start, end = _local_day_bounds(local, tz_offset_minutes=240)
    assert start == datetime(2026, 10, 24, 4, 0, 0)
    assert end == start + timedelta(days=1)


def test_parts_waiting_excludes_closed_flag():
    assert work_order_eligible_for_parts_waiting(is_closed=True, status="waiting_on_parts") is False


def test_parts_waiting_excludes_completed_and_closed_status():
    assert work_order_eligible_for_parts_waiting(is_closed=False, status="completed") is False
    assert work_order_eligible_for_parts_waiting(is_closed=False, status="closed") is False
    assert work_order_eligible_for_parts_waiting(is_closed=False, status="refunded") is False


def test_parts_waiting_includes_open_parts_hold():
    assert work_order_eligible_for_parts_waiting(is_closed=False, status="waiting_on_parts") is True
    assert work_order_eligible_for_parts_waiting(is_closed=False, status="parts_on_order") is True


def test_parts_waiting_excludes_completed_pending_payment():
    assert work_order_eligible_for_parts_waiting(is_closed=False, status="completed_pending_payment") is False
