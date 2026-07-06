"""Client ETA window computation (portal narrowing batch)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from app.services.portal_scheduling_helpers import format_display_time, parse_hhmm

CLIENT_ETA_MORNING_FLOOR = (8, 45)
CLIENT_ETA_AFTERNOON_FLOOR = (12, 0)


def _round_to_quarter_hour(dt: datetime, direction: str) -> datetime:
    minutes = dt.minute
    if direction == "down":
        rounded = minutes - (minutes % 15)
    elif direction == "up":
        remainder = minutes % 15
        rounded = minutes if remainder == 0 else minutes + (15 - remainder)
    else:
        rounded = minutes
    return dt.replace(minute=rounded, second=0, microsecond=0)


def _apply_eta_floor(
    raw_start: datetime,
    scheduled_start: datetime,
    time_window: str,
    window_cfg: Optional[dict] = None,
) -> datetime:
    if time_window == "afternoon":
        h, m = CLIENT_ETA_AFTERNOON_FLOOR
        floor = scheduled_start.replace(hour=h, minute=m, second=0, microsecond=0)
        return max(raw_start, floor)
    if time_window == "morning":
        h, m = CLIENT_ETA_MORNING_FLOOR
        floor = scheduled_start.replace(hour=h, minute=m, second=0, microsecond=0)
        return max(raw_start, floor)
    if time_window == "evening" and window_cfg:
        eh, em = parse_hhmm(window_cfg.get("start", "17:00"))
        floor = scheduled_start.replace(hour=eh, minute=em, second=0, microsecond=0)
        return max(raw_start, floor)
    return raw_start


def compute_client_eta_window(
    scheduled_start: datetime,
    time_window: str,
    *,
    window_cfg: Optional[dict] = None,
) -> Optional[Dict[str, Any]]:
    """±90 min window with quarter-hour rounding and time-window floors."""
    if not scheduled_start:
        return None

    raw_start = scheduled_start - timedelta(minutes=90)
    raw_end = scheduled_start + timedelta(minutes=90)
    raw_start = _apply_eta_floor(raw_start, scheduled_start, time_window, window_cfg)

    rounded_start = _round_to_quarter_hour(raw_start, "down")
    rounded_end = _round_to_quarter_hour(raw_end, "up")

    return {
        "display": f"{format_display_time(rounded_start)} - {format_display_time(rounded_end)}",
        "eta_start": rounded_start,
        "eta_end": rounded_end,
    }
