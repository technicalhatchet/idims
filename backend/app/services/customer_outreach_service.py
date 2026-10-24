"""Test-mode gating for automatic customer-facing outreach (not manual staff sends)."""

from __future__ import annotations

import json
import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.client import Client

logger = logging.getLogger(__name__)

SETTING_KEY = "customer_outreach_test_mode"
SKIP_LOG_MESSAGE = "skipped: test mode"

_cache_enabled: Optional[bool] = None


def invalidate_customer_outreach_test_mode_cache() -> None:
    global _cache_enabled
    _cache_enabled = None


def customer_outreach_test_mode_enabled(db: Session) -> bool:
    """Default ON when setting is missing (safe for production rollout)."""
    global _cache_enabled
    if _cache_enabled is not None:
        return _cache_enabled
    row = db.execute(
        text("SELECT value FROM settings WHERE key = :key"),
        {"key": SETTING_KEY},
    ).fetchone()
    if not row or not row[0]:
        _cache_enabled = True
        return True
    value = row[0]
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            _cache_enabled = True
            return True
    if isinstance(value, bool):
        _cache_enabled = value
        return value
    if isinstance(value, dict):
        _cache_enabled = bool(value.get("enabled", True))
        return _cache_enabled
    _cache_enabled = True
    return True


def validate_customer_outreach_test_mode_value(value: object) -> None:
    if isinstance(value, bool):
        return
    if isinstance(value, dict) and "enabled" in value:
        if not isinstance(value["enabled"], bool):
            raise ValueError("customer_outreach_test_mode.enabled must be boolean")
        return
    raise ValueError("customer_outreach_test_mode must be { enabled: bool } or boolean")


def _load_client(db: Session, client_id: UUID) -> Optional[Client]:
    return (
        db.query(Client)
        .filter(Client.id == client_id, Client.merged_into_client_id.is_(None))
        .first()
    )


def automatic_outreach_allowed_for_client(db: Session, client: Optional[Client]) -> bool:
    if not customer_outreach_test_mode_enabled(db):
        return True
    if not client:
        return False
    return bool(getattr(client, "is_test_client", False))


def automatic_outreach_allowed(db: Session, client_id: Optional[UUID]) -> bool:
    if not client_id:
        return not customer_outreach_test_mode_enabled(db)
    if not customer_outreach_test_mode_enabled(db):
        return True
    client = _load_client(db, client_id)
    return automatic_outreach_allowed_for_client(db, client)


def log_skipped_test_mode(
    *,
    channel: str,
    client_id: Optional[UUID],
    detail: str = "",
) -> None:
    logger.info(
        "%s channel=%s client_id=%s %s",
        SKIP_LOG_MESSAGE,
        channel,
        client_id,
        detail.strip(),
    )
