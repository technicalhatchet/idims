"""Shop hours as the gate for portal scheduling windows (intersect with portal_scheduling)."""

from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SETTING_KEY = "shop_hours"

DAYS_OF_WEEK = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
]


def _period_enabled(period: Optional[dict]) -> bool:
    if not period:
        return False
    enabled = period.get("enabled")
    if enabled is True or enabled == 1 or enabled == "true":
        return True
    return False


def _normalize_day_hours(day_data: Optional[dict]) -> dict:
    day_data = day_data or {}
    regular_enabled = day_data.get("regular", {}).get("enabled")
    if regular_enabled is None:
        if day_data.get("enabled") is not None:
            regular_enabled = bool(day_data.get("enabled"))
        elif day_data.get("open") or day_data.get("close"):
            regular_enabled = True
        else:
            regular_enabled = False
    else:
        regular_enabled = bool(regular_enabled)

    regular_start = (
        (day_data.get("regular") or {}).get("start")
        or day_data.get("open")
        or "09:00"
    )
    regular_end = (
        (day_data.get("regular") or {}).get("end")
        or day_data.get("close")
        or "17:00"
    )
    evening = day_data.get("evening") or {}
    return {
        "regular": {
            "enabled": regular_enabled,
            "start": regular_start,
            "end": regular_end,
        },
        "evening": {
            "enabled": bool(evening.get("enabled")),
            "start": evening.get("start") or "17:00",
            "end": evening.get("end") or "21:00",
        },
    }


def get_shop_hours(db: Session) -> Dict[str, dict]:
    """Load shop hours from settings; normalized per weekday."""
    row = db.execute(
        text("SELECT value FROM settings WHERE key = :key"),
        {"key": SETTING_KEY},
    ).fetchone()
    raw: dict = {}
    if row and row[0]:
        value = row[0]
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = {}
        raw = value if isinstance(value, dict) else {}

    normalized: Dict[str, dict] = {}
    for day in DAYS_OF_WEEK:
        normalized[day] = _normalize_day_hours(raw.get(day))
    return normalized


def _weekday_name(on_date: date) -> str:
    # Python weekday: Mon=0 .. Sun=6; JS getDay(): Sun=0 .. Sat=6
    return DAYS_OF_WEEK[(on_date.weekday() + 1) % 7]


def shop_hours_for_date(shop_hours: Dict[str, dict], on_date: date) -> dict:
    day_name = _weekday_name(on_date)
    return shop_hours.get(day_name) or _normalize_day_hours({})


def _parse_hhmm(value: str) -> Tuple[int, int]:
    parts = (value or "00:00").split(":")
    return int(parts[0]), int(parts[1])


def _minutes_since_midnight(hhmm: str) -> int:
    h, m = _parse_hhmm(hhmm)
    return h * 60 + m


def _hhmm_from_minutes(total: int) -> str:
    h, m = divmod(max(0, total), 60)
    return f"{h:02d}:{m:02d}"


def _intersect_ranges(start_a: str, end_a: str, start_b: str, end_b: str) -> Optional[Tuple[str, str]]:
    a0, a1 = _minutes_since_midnight(start_a), _minutes_since_midnight(end_a)
    b0, b1 = _minutes_since_midnight(start_b), _minutes_since_midnight(end_b)
    start = max(a0, b0)
    end = min(a1, b1)
    if start >= end:
        return None
    return _hhmm_from_minutes(start), _hhmm_from_minutes(end)


def portal_window_names_for_date(shop_hours: Dict[str, dict], on_date: date) -> List[str]:
    """
    Which named portal windows (morning/afternoon/evening) shop hours allow on this date.
    Mirrors frontend/hooks/useShopHours.js getAvailableWindowsForDate.
    """
    day_hours = shop_hours_for_date(shop_hours, on_date)
    windows: List[str] = []

    regular = day_hours.get("regular") or {}
    if _period_enabled(regular):
        start_h = _parse_hhmm(regular.get("start") or "09:00")[0]
        end_h = _parse_hhmm(regular.get("end") or "17:00")[0]
        if start_h < 13 and end_h > 9:
            windows.append("morning")
        if start_h < 17 and end_h > 12:
            windows.append("afternoon")

    evening = day_hours.get("evening") or {}
    if _period_enabled(evening):
        windows.append("evening")

    return windows


def is_shop_open_on_date(shop_hours: Dict[str, dict], on_date: date) -> bool:
    return bool(portal_window_names_for_date(shop_hours, on_date))


def resolve_effective_portal_window(
    shop_hours: Dict[str, dict],
    on_date: date,
    window_name: str,
    portal_window_cfg: dict,
) -> Optional[dict]:
    """
    Intersect portal window times with shop hours for on_date.
    Returns a copy of portal_window_cfg with clipped start/end, or None if unavailable.
    """
    if window_name not in ("morning", "afternoon", "evening"):
        return None
    if not portal_window_cfg.get("enabled"):
        return None
    if window_name not in portal_window_names_for_date(shop_hours, on_date):
        return None

    portal_start = portal_window_cfg.get("start") or "08:00"
    portal_end = portal_window_cfg.get("end") or "12:00"
    day_hours = shop_hours_for_date(shop_hours, on_date)

    if window_name == "evening":
        period = day_hours.get("evening") or {}
        if not _period_enabled(period):
            return None
        clipped = _intersect_ranges(
            portal_start,
            portal_end,
            period.get("start") or "17:00",
            period.get("end") or "21:00",
        )
    else:
        period = day_hours.get("regular") or {}
        if not _period_enabled(period):
            return None
        clipped = _intersect_ranges(
            portal_start,
            portal_end,
            period.get("start") or "09:00",
            period.get("end") or "17:00",
        )

    if not clipped:
        return None

    return {
        **portal_window_cfg,
        "start": clipped[0],
        "end": clipped[1],
    }


def resolve_effective_portal_window_from_db(
    db: Session,
    on_date: date,
    window_name: str,
    portal_window_cfg: dict,
) -> Optional[dict]:
    shop_hours = get_shop_hours(db)
    return resolve_effective_portal_window(shop_hours, on_date, window_name, portal_window_cfg)
