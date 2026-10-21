"""Portal Google review request settings."""

from __future__ import annotations

import copy
import json
import logging
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SETTING_KEY = "portal_reviews"


def default_portal_reviews() -> Dict[str, Any]:
    return {
        "enabled": False,
        "google_review_url": "",
        "delay_hours": 2,
    }


def _deep_merge(base: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(base)
    for key, value in (patch or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def get_portal_reviews_settings(db: Session) -> Dict[str, Any]:
    defaults = default_portal_reviews()
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
            value = {}
    return _deep_merge(defaults, value or {})
