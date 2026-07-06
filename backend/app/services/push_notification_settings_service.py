"""Load and validate push notification settings from the settings table."""

from __future__ import annotations

import copy
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings as app_settings
from app.schemas.push_notification_settings import PushNotificationSettings

logger = logging.getLogger(__name__)

SETTING_KEY = "push_notifications"


def default_push_notifications() -> Dict[str, Any]:
    model = PushNotificationSettings()
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _deep_merge(base: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(base)
    for key, value in (patch or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def get_push_notification_settings(db: Session) -> Dict[str, Any]:
    defaults = default_push_notifications()
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
        env_hour = int(getattr(app_settings, "MORNING_BRIEFING_HOUR", 7) or 7)
        merged["morning_briefing"]["hour"] = env_hour

    try:
        PushNotificationSettings(**merged)
    except Exception as exc:
        logger.warning("push_notifications settings invalid, using defaults: %s", exc)
        return defaults

    return merged


def get_push_rule(db: Session, rule_key: str) -> Dict[str, Any]:
    config = get_push_notification_settings(db)
    return config.get(rule_key) or {}


def _shop_timezone() -> ZoneInfo:
    try:
        return ZoneInfo(app_settings.SHOP_TIMEZONE or "America/Detroit")
    except Exception:
        return ZoneInfo("America/Detroit")


def is_morning_briefing_due_now(db: Session, now: Optional[datetime] = None) -> bool:
    """True when morning briefing is enabled and shop-local time matches configured send time."""
    rule = get_push_rule(db, "morning_briefing")
    if not rule.get("enabled", True):
        return False

    now_local = now or datetime.now(_shop_timezone())
    if now_local.tzinfo is None:
        now_local = now_local.replace(tzinfo=_shop_timezone())
    else:
        now_local = now_local.astimezone(_shop_timezone())

    target_hour = int(rule.get("hour", 7))
    target_minute = int(rule.get("minute", 0))
    return now_local.hour == target_hour and now_local.minute >= target_minute and now_local.minute < target_minute + 15
