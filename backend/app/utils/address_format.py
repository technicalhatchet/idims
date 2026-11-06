"""Format client and property records into a single-line service address."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

_US_COUNTRY_ALIASES = frozenset({
    "usa",
    "us",
    "u.s.",
    "u.s.a.",
    "united states",
    "united states of america",
})

# Reverse of format_property_address trailing ", Unit X" / ", unit X"
_UNIT_SUFFIX_RE = re.compile(r",\s*(unit\s+.+)\s*$", re.IGNORECASE)


def format_client_address(addr: Optional[Dict[str, Any]]) -> Optional[str]:
    if not addr or not isinstance(addr, dict):
        return None

    parts = []
    for key in ("street1", "street2", "city", "state", "zip"):
        value = (addr.get(key) or "").strip()
        if value:
            parts.append(value)

    country = (addr.get("country") or "").strip()
    if country and country.lower() not in _US_COUNTRY_ALIASES:
        parts.append(country)

    return ", ".join(parts) if parts else None


def format_property_address(
    address: Optional[str],
    unit_number: Optional[str] = None,
) -> Optional[str]:
    street = (address or "").strip()
    if not street:
        return None
    unit = (unit_number or "").strip()
    if unit:
        if unit.lower().startswith("unit"):
            return f"{street}, {unit}"
        return f"{street}, Unit {unit}"
    return street


def parse_formatted_service_address(
    formatted: Optional[str],
) -> Tuple[str, Optional[str]]:
    """
    Split a service-location line into (street, unit) for property matching.

    Reverses format_property_address: trailing ", Unit 4" → unit "4".
    Client mailing lines from format_client_address have no unit suffix and
    are returned unchanged as the street with unit=None.
    """
    raw = (formatted or "").strip()
    if not raw:
        return "", None
    match = _UNIT_SUFFIX_RE.search(raw)
    if not match:
        return raw, None
    street = raw[: match.start()].strip()
    unit_token = match.group(1).strip()
    # Strip leading "unit " so stored unit_number round-trips with format_property_address
    unit_number = re.sub(r"^unit\s+", "", unit_token, flags=re.IGNORECASE).strip() or None
    return street or raw, unit_number
