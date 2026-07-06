"""Shared helpers for comparing DB timestamps safely."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


def as_utc_naive(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalize aware/naive datetimes to naive UTC for comparisons."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def utcnow_naive() -> datetime:
    """Current UTC time as a naive datetime (matches legacy DB columns)."""
    return datetime.utcnow()
