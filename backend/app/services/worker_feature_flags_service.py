"""Celery worker job toggles (settings.worker_feature_flags, default OFF)."""

from __future__ import annotations

import copy
import json
import logging
import time
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SETTING_KEY = "worker_feature_flags"
CACHE_TTL_SECONDS = 30

WORKER_FLAG_DEFINITIONS: Dict[str, str] = {
    "deploy_reminders": "Staff deploy nudge web pushes (en_route timer)",
    "morning_summaries": "Staff morning schedule briefing pushes",
    "appointment_reminders": "Customer appointment reminder emails (~24h before)",
    "portal_narrowing_batch": "Customer ETA narrowing SMS/email batch",
    "portal_scheduling_deadlines": "Auto-deny stale portal scheduling requests + customer notices",
    "delayed_review_requests": "Customer review requests after payment (review_due_at + beat)",
    "maintenance_reminder_emails": "Monthly-cap maintenance summary emails for due items",
}

ALL_WORKER_FLAG_IDS = set(WORKER_FLAG_DEFINITIONS.keys())

_cache_flags: Optional[Dict[str, Dict[str, Any]]] = None
_cache_at: float = 0.0


def invalidate_worker_feature_flags_cache() -> None:
    global _cache_flags, _cache_at
    _cache_flags = None
    _cache_at = 0.0


def default_worker_feature_flags() -> Dict[str, Dict[str, Any]]:
    return {flag_id: {"enabled": False} for flag_id in WORKER_FLAG_DEFINITIONS}


def get_worker_feature_flags(db: Session) -> Dict[str, Dict[str, Any]]:
    defaults = default_worker_feature_flags()
    row = db.execute(
        text("SELECT value FROM settings WHERE key = :key"),
        {"key": SETTING_KEY},
    ).fetchone()
    if not row or not row[0]:
        return defaults
    value = row[0]
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return defaults
    if not isinstance(value, dict):
        return defaults
    out = copy.deepcopy(defaults)
    for key, entry in value.items():
        if key not in ALL_WORKER_FLAG_IDS:
            continue
        if isinstance(entry, dict) and "enabled" in entry:
            out[key] = {**out[key], "enabled": bool(entry["enabled"])}
    return out


def get_worker_feature_flags_cached(db: Session) -> Dict[str, Dict[str, Any]]:
    global _cache_flags, _cache_at
    now = time.monotonic()
    if _cache_flags is not None and (now - _cache_at) < CACHE_TTL_SECONDS:
        return _cache_flags
    _cache_flags = get_worker_feature_flags(db)
    _cache_at = now
    return _cache_flags


def worker_feature_enabled(db: Session, flag: str) -> bool:
    if flag not in ALL_WORKER_FLAG_IDS:
        return False
    cfg = get_worker_feature_flags_cached(db).get(flag) or {}
    return bool(cfg.get("enabled", False))


def validate_worker_feature_flags_value(value: Any) -> None:
    if not isinstance(value, dict):
        raise ValueError("worker_feature_flags must be an object")
    for key, entry in value.items():
        if key not in ALL_WORKER_FLAG_IDS:
            raise ValueError(f"Unknown worker feature flag: {key}")
        if not isinstance(entry, dict):
            raise ValueError(f"worker_feature_flags.{key} must be an object")
        if "enabled" in entry and not isinstance(entry["enabled"], bool):
            raise ValueError(f"worker_feature_flags.{key}.enabled must be boolean")
