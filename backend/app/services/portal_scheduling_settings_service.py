"""Portal self-scheduling settings — load, defaults, merge."""

from __future__ import annotations

import copy
import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.settings import PortalSchedulingSettings, SchedulingWindowPeriod

logger = logging.getLogger(__name__)

SETTING_KEY = "portal_scheduling"
LEGACY_KEY = "portal_self_scheduling"


def default_portal_scheduling() -> Dict[str, Any]:
    return PortalSchedulingSettings().model_dump()


def _deep_merge(base: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(base)
    for key, value in (patch or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def get_portal_scheduling_settings(db: Session) -> Dict[str, Any]:
    """Merged portal scheduling config with defaults."""
    defaults = default_portal_scheduling()
    row = db.execute(
        text("SELECT value FROM settings WHERE key = :key"),
        {"key": SETTING_KEY},
    ).fetchone()

    if row and row[0]:
        value = row[0]
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = {}
        merged = _deep_merge(defaults, value or {})
    else:
        merged = defaults
        legacy = db.execute(
            text("SELECT value FROM settings WHERE key = :key"),
            {"key": LEGACY_KEY},
        ).fetchone()
        if legacy and isinstance(legacy[0], dict):
            merged["self_scheduling_enabled"] = bool(legacy[0].get("enabled", True))

    try:
        PortalSchedulingSettings(**merged)
    except Exception as exc:
        logger.warning("portal_scheduling settings invalid, using defaults: %s", exc)
        return defaults

    return merged


def is_self_scheduling_globally_enabled(db: Session) -> bool:
    return bool(get_portal_scheduling_settings(db).get("self_scheduling_enabled", True))


def get_enabled_scheduling_windows(db: Session) -> List[Dict[str, Any]]:
    settings = get_portal_scheduling_settings(db)
    windows = settings.get("scheduling_windows") or {}
    result = []
    for name in ("morning", "afternoon", "evening"):
        window = windows.get(name) or {}
        if window.get("enabled"):
            result.append({
                "name": name,
                "start": window.get("start"),
                "end": window.get("end"),
            })
    return result


def get_scheduling_window_bounds(db: Session, window_name: str) -> Optional[SchedulingWindowPeriod]:
    settings = get_portal_scheduling_settings(db)
    windows = settings.get("scheduling_windows") or {}
    raw = windows.get(window_name)
    if not raw or not raw.get("enabled"):
        return None
    return SchedulingWindowPeriod(**raw)
