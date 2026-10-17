"""US phone normalization and display helpers."""

from __future__ import annotations

import re
from typing import Optional

_DIGITS_RE = re.compile(r"\D+")


def normalize_us_phone_e164(raw: Optional[str]) -> Optional[str]:
    """Return +1XXXXXXXXXX for valid US numbers, else None."""
    if raw is None:
        return None
    trimmed = raw.strip()
    if not trimmed:
        return None
    digits = _DIGITS_RE.sub("", trimmed)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+1{digits[1:]}"
    return None


def phones_equal(a: Optional[str], b: Optional[str]) -> bool:
    na = normalize_us_phone_e164(a)
    nb = normalize_us_phone_e164(b)
    if na and nb:
        return na == nb
    return bool((a or "").strip()) and (a or "").strip() == (b or "").strip()


def format_us_phone_display(raw: Optional[str]) -> str:
    e164 = normalize_us_phone_e164(raw)
    if e164 and len(e164) == 12 and e164.startswith("+1"):
        d = e164[2:]
        return f"({d[0:3]}) {d[3:6]}-{d[6:10]}"
    return (raw or "").strip()


def prefer_dial_phone(mobile: Optional[str], phone: Optional[str]) -> Optional[str]:
    if mobile and str(mobile).strip():
        return mobile.strip()
    if phone and str(phone).strip():
        return phone.strip()
    return None


def client_sms_destination(mobile: Optional[str]) -> Optional[str]:
    """E.164 for outbound SMS when mobile is set."""
    if not mobile or not str(mobile).strip():
        return None
    return normalize_us_phone_e164(mobile) or mobile.strip()


def normalize_phone_field(raw: Optional[str]) -> Optional[str]:
    """Normalize for DB storage; keeps raw if not US-normalizable."""
    if raw is None:
        return None
    trimmed = raw.strip()
    if not trimmed:
        return None
    return normalize_us_phone_e164(trimmed) or trimmed
