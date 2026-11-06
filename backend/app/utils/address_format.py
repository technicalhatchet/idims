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

# Inline unit clause: ", Unit 109," / "/ unit 109" / ", Apt 2B" / ", #3" / ", Ste 4"
# Captures only the unit token — city/state/zip stay in the street.
_UNIT_CLAUSE_RE = re.compile(
    r"(?:,\s*|\s*/\s*)"
    r"(?:"
    r"(?:unit|apt\.?|apartment|ste\.?|suite)\s+([A-Za-z0-9-]+)"
    r"|#\s*([A-Za-z0-9-]+)"
    r")"
    r"(?=\s*[,/]|$)",
    re.IGNORECASE,
)

# Trailing country tokens (case-insensitive) after a comma
_TRAILING_COUNTRY_RE = re.compile(
    r",\s*(?:"
    r"united states of america|"
    r"united states|"
    r"u\.s\.a\.?|"
    r"u\.s\.?|"
    r"usa|"
    r"us"
    r")\s*$",
    re.IGNORECASE,
)


def _collapse_ws_local(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def strip_trailing_country(address: Optional[str]) -> str:
    """Remove a trailing US country suffix; keep the rest as typed."""
    raw = (address or "").strip()
    if not raw:
        return ""
    stripped = _TRAILING_COUNTRY_RE.sub("", raw).strip()
    return stripped.rstrip(",").strip()


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

    Strips a trailing US country (", USA" / ", US" / ", United States") before
    returning the street (storage form: typed address minus country).

    Unit is only the token after Unit/Apt/#/Ste (e.g. "109"), not city/state/zip.
    "3040 Byrnwyck W, Unit 109, Maumee, OH, 43537" →
      street "3040 Byrnwyck W, Maumee, OH, 43537", unit "109".
    """
    raw = strip_trailing_country(formatted)
    if not raw:
        return "", None
    match = _UNIT_CLAUSE_RE.search(raw)
    if not match:
        return raw, None
    unit_number = (match.group(1) or match.group(2) or "").strip() or None
    street = f"{raw[: match.start()]}{raw[match.end():]}"
    street = re.sub(r"\s*,\s*,\s*", ", ", street)
    street = re.sub(r"^\s*,\s*|\s*,\s*$", "", street)
    street = _collapse_ws_local(street)
    return street or raw, unit_number
