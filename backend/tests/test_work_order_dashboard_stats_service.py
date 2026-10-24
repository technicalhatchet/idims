"""TechDeck dashboard stats helpers."""

from datetime import date, datetime, timedelta

from app.services.work_order_dashboard_stats_service import _local_day_bounds


def test_local_day_bounds_uses_timezone_offset():
    local = date(2026, 10, 24)
    start, end = _local_day_bounds(local, tz_offset_minutes=240)
    assert start == datetime(2026, 10, 24, 4, 0, 0)
    assert end == start + timedelta(days=1)
