"""Format client and property records into a single-line service address."""

from typing import Any, Dict, Optional

_US_COUNTRY_ALIASES = frozenset({
    "usa",
    "us",
    "u.s.",
    "u.s.a.",
    "united states",
    "united states of america",
})


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
