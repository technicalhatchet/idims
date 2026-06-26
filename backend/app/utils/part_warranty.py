"""Part-level warranty defaults and date helpers."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

OEM_WARRANTY_DAYS = 365
AFTERMARKET_WARRANTY_DAYS = 0
ALLOWED_PART_SOURCES = frozenset({"oem", "aftermarket"})

# Statuses that clear install / warranty tracking
WARRANTY_RESET_STATUSES = frozenset({"needed", "ordered", "received", "not_installed"})


def effective_warranty_days(
    part_source: str,
    warranty_days_override: Optional[int] = None,
) -> int:
    if warranty_days_override is not None:
        return max(0, int(warranty_days_override))
    if part_source == "oem":
        return OEM_WARRANTY_DAYS
    return AFTERMARKET_WARRANTY_DAYS


def apply_part_warranty_fields(part, *, previous_status: Optional[str] = None) -> None:
    """Set installed_at and warranty_expires_at from status, source, and overrides."""
    if part.status in WARRANTY_RESET_STATUSES:
        part.installed_at = None
        part.warranty_expires_at = None
        return

    if part.status == "installed":
        if previous_status != "installed" or not part.installed_at:
            part.installed_at = datetime.utcnow()
        days = effective_warranty_days(part.part_source, part.warranty_days_override)
        if days > 0 and part.installed_at:
            part.warranty_expires_at = part.installed_at + timedelta(days=days)
        else:
            part.warranty_expires_at = None
