"""Status helpers shared across services.

The database enums only store "canceled", but older code, payloads and
frontend strings also use "cancelled". Python-side checks should accept both.

Do NOT put "cancelled" into SQL filters against the Postgres enums
(e.g. ``WorkOrder.status.notin_([...])``): Postgres rejects a value that
isn't in the enum and the whole query errors.
"""

from __future__ import annotations

from typing import Any

CANCELED_STATUSES = frozenset({"canceled", "cancelled"})


def status_key(status: Any) -> str:
    """Enum or string → lowercase string ('' for None)."""
    if status is None:
        return ""
    value = status.value if hasattr(status, "value") else status
    return str(value).strip().lower()


def is_canceled_status(status: Any) -> bool:
    return status_key(status) in CANCELED_STATUSES
