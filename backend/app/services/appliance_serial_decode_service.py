"""Decode manufacture month/year from OEM serial numbers (confidence-gated)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import List, Optional

WHIRLPOOL_FAMILY = frozenset(
    {"whirlpool", "maytag", "kitchenaid", "amana", "jennair", "jenn air", "jenn-air"}
)
ELECTROLUX_FAMILY = frozenset(
    {
        "frigidaire",
        "electrolux",
        "gallery",
        "professional",
        "gibson",
        "kelvinator",
        "tappan",
        "white-westinghouse",
        "white westinghouse",
        "westinghouse",
    }
)
GE_FAMILY = frozenset(
    {"ge", "hotpoint", "cafe", "café", "profile", "monogram", "general electric"}
)
SAMSUNG_FAMILY = frozenset({"samsung"})
LG_FAMILY = frozenset({"lg"})

KENMORE_ELECTROLUX_PREFIXES = frozenset(
    {"119", "253", "336", "417", "587", "622", "628", "719", "790", "791", "970"}
)
KENMORE_WHIRLPOOL_PREFIXES = frozenset({"106", "110"})
KENMORE_LG_PREFIXES = frozenset({"795"})

WHIRLPOOL_YEAR_MAP = {
    **{str(d): 2010 + d for d in range(10)},
    "X": 2020,
    "A": 2021,
    "B": 2022,
    "C": 2023,
    "D": 2024,
    "E": 2025,
    "F": 2026,
}

GE_MONTH = {"A": 1, "D": 2, "F": 3, "G": 4, "H": 5, "L": 6, "M": 7, "R": 8, "S": 9, "T": 10, "V": 11, "Z": 12}
GE_YEAR_CYCLE = {"A": 2001, "D": 2002, "F": 2003, "G": 2004, "H": 2005, "L": 2006, "M": 2007, "R": 2008, "S": 2009, "T": 2010, "V": 2011, "Z": 2000}

SAMSUNG_YEAR_BASE = {
    "R": 2001,
    "T": 2002,
    "W": 2003,
    "X": 2004,
    "Y": 2005,
    "A": 2006,
    "L": 2006,
    "P": 2007,
    "Q": 2008,
    "S": 2009,
    "Z": 2010,
    "B": 2011,
    "C": 2012,
    "D": 2013,
    "F": 2014,
    "G": 2015,
    "H": 2016,
    "J": 2017,
    "K": 2018,
    "M": 2019,
    "N": 2020,
}


def _samsung_year_candidates(yc: str) -> List[int]:
    base = SAMSUNG_YEAR_BASE.get(yc)
    if not base:
        return []
    out = [base]
    if base <= 2010:
        out.append(base + 20)
    return out


@dataclass
class DecodeResult:
    year: int
    month: int
    rule: str
    confidence: str


def _norm_make(make: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (make or "").strip().lower())


def _model_prefix_digits(model: Optional[str]) -> Optional[str]:
    digits = re.sub(r"\D", "", (model or "").strip())
    if len(digits) < 3:
        return None
    return digits[:3]


def _kenmore_route(model: Optional[str]) -> Optional[str]:
    prefix = _model_prefix_digits(model)
    if not prefix:
        return None
    if prefix in KENMORE_ELECTROLUX_PREFIXES:
        return "electrolux"
    if prefix in KENMORE_WHIRLPOOL_PREFIXES:
        return "whirlpool"
    if prefix in KENMORE_LG_PREFIXES:
        return "lg"
    return None


def _pick_year(candidates: List[int], today: date, first_service: Optional[date]) -> Optional[int]:
    cap = today.year
    if first_service:
        cap = min(cap, first_service.year)
    valid = [y for y in candidates if y <= cap]
    return max(valid) if valid else None


def _month_from_iso_week(year: int, week: int) -> int:
    return date.fromisocalendar(year, week, 1).month


def _decode_whirlpool(serial: str, today: date, first_service: Optional[date]) -> Optional[DecodeResult]:
    s = serial.strip().upper()
    if len(s) < 5:
        return None
    for skip in (1, 2):
        if len(s) <= skip + 2:
            continue
        yc = s[skip]
        if yc not in WHIRLPOOL_YEAR_MAP:
            continue
        year = WHIRLPOOL_YEAR_MAP[yc]
        if year < 2010:
            continue
        week_part = s[skip + 1 : skip + 3]
        if not week_part.isdigit():
            continue
        week = int(week_part)
        if week < 1 or week > 53:
            continue
        picked = _pick_year([year], today, first_service)
        if not picked:
            return None
        month = _month_from_iso_week(picked, week)
        return DecodeResult(picked, month, "whirlpool_2010_plus", "high")
    return None


def _decode_electrolux(serial: str, today: date, first_service: Optional[date]) -> Optional[DecodeResult]:
    s = re.sub(r"[^A-Z0-9]", "", serial.upper())
    if len(s) < 5:
        return None
    year_digit = s[2]
    if not year_digit.isdigit():
        return None
    week_part = s[3:5]
    if not week_part.isdigit():
        return None
    week = int(week_part)
    if week < 1 or week > 53:
        return None
    digit = int(year_digit)
    candidates = [2000 + digit, 2010 + digit, 2020 + digit]
    year = _pick_year(candidates, today, first_service)
    if not year:
        return None
    month = _month_from_iso_week(year, week)
    return DecodeResult(year, month, "electrolux_week_year", "medium")


def _decode_ge(serial: str, today: date, first_service: Optional[date]) -> Optional[DecodeResult]:
    s = re.sub(r"[^A-Z]", "", serial.upper())
    if len(s) < 2:
        return None
    m_code, y_code = s[0], s[1]
    month = GE_MONTH.get(m_code)
    base = GE_YEAR_CYCLE.get(y_code)
    if not month or not base:
        return None
    candidates = [base + 12 * n for n in range(0, 4) if base + 12 * n <= today.year + 1]
    year = _pick_year(candidates, today, first_service)
    if not year:
        return None
    return DecodeResult(year, month, "ge_month_year", "high")


def _samsung_month(ch: str) -> Optional[int]:
    if ch.isdigit():
        n = int(ch)
        return n if 1 <= n <= 9 else None
    return {"A": 10, "B": 11, "C": 12}.get(ch.upper())


def _decode_samsung(serial: str, today: date, first_service: Optional[date]) -> Optional[DecodeResult]:
    s = serial.strip().upper()
    if len(s) == 15:
        yc, mc = s[7], s[8]
    elif len(s) == 11:
        yc, mc = s[3], s[4]
    else:
        return None
    month = _samsung_month(mc)
    if not month:
        return None
    year = _pick_year(_samsung_year_candidates(yc), today, first_service)
    if not year:
        return None
    rule = "samsung_15" if len(s) == 15 else "samsung_11"
    return DecodeResult(year, month, rule, "high")


def _decode_lg(serial: str, today: date, first_service: Optional[date]) -> Optional[DecodeResult]:
    s = serial.strip()
    if len(s) < 3 or not s[:3].isdigit():
        return None
    decade_digit = int(s[0])
    month = int(s[1:3])
    if month < 1 or month > 12:
        return None
    current_decade = today.year // 10
    candidates = [current_decade * 10 + decade_digit, (current_decade - 1) * 10 + decade_digit]
    year = _pick_year(candidates, today, first_service)
    if not year:
        return None
    return DecodeResult(year, month, "lg_3digit", "medium")


def _family_match(make: str, family: frozenset) -> bool:
    return any(token in make for token in family)


def decode_appliance_serial(
    make: Optional[str],
    serial: Optional[str],
    *,
    model: Optional[str] = None,
    today: Optional[date] = None,
    first_service_date: Optional[date] = None,
) -> Optional[DecodeResult]:
    if not serial or not (serial := serial.strip()):
        return None
    mk = _norm_make(make)
    today = today or date.today()

    if mk == "kenmore" or mk.startswith("kenmore "):
        route = _kenmore_route(model)
        if route == "electrolux":
            return _decode_electrolux(serial, today, first_service_date)
        if route == "whirlpool":
            return _decode_whirlpool(serial, today, first_service_date)
        if route == "lg":
            return _decode_lg(serial, today, first_service_date)
        return None

    if _family_match(mk, WHIRLPOOL_FAMILY):
        return _decode_whirlpool(serial, today, first_service_date)
    if _family_match(mk, ELECTROLUX_FAMILY):
        return _decode_electrolux(serial, today, first_service_date)
    if _family_match(mk, GE_FAMILY) or mk.startswith("ge"):
        return _decode_ge(serial, today, first_service_date)
    if _family_match(mk, SAMSUNG_FAMILY):
        return _decode_samsung(serial, today, first_service_date)
    if _family_match(mk, LG_FAMILY):
        return _decode_lg(serial, today, first_service_date)
    return None
