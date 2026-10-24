"""Map appliance makes and CPSC manufacturers to matching families."""

from __future__ import annotations

import re
from typing import Optional, Set

CPSC_FETCH_MANUFACTURERS = [
    "Whirlpool",
    "Maytag",
    "KitchenAid",
    "Amana",
    "JennAir",
    "GE",
    "Hotpoint",
    "Samsung",
    "LG",
    "Frigidaire",
    "Electrolux",
    "Bosch",
    "Kenmore",
]

_FAMILY_ALIASES = {
    "whirlpool_family": {
        "whirlpool",
        "maytag",
        "kitchenaid",
        "amana",
        "jennair",
        "jenn air",
        "jenn-air",
    },
    "ge_family": {
        "ge",
        "g e",
        "hotpoint",
        "cafe",
        "café",
        "profile",
        "monogram",
        "general electric",
    },
    "samsung_family": {"samsung"},
    "lg_family": {"lg", "l g"},
    "frigidaire_family": {"frigidaire", "electrolux"},
    "electrolux_family": {"electrolux", "frigidaire"},
    "bosch_family": {"bosch"},
    "kenmore_family": {"kenmore"},
}

# Kenmore-built units often appear under Whirlpool-family CPSC manufacturers.
_APPLIANCE_EXTRA_FAMILIES = {
    "kenmore": {"whirlpool_family"},
}


def _normalize_make(value: Optional[str]) -> str:
    if not value:
        return ""
    text = value.strip().lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def manufacturer_family(manufacturer: Optional[str]) -> Optional[str]:
    key = _normalize_make(manufacturer)
    if not key:
        return None
    for family, aliases in _FAMILY_ALIASES.items():
        if key in aliases or any(key.startswith(a) for a in aliases):
            return family
    for family, aliases in _FAMILY_ALIASES.items():
        for alias in aliases:
            if alias in key:
                return family
    return None


def appliance_families(make: Optional[str]) -> Set[str]:
    key = _normalize_make(make)
    if not key:
        return set()
    found: Set[str] = set()
    for family, aliases in _FAMILY_ALIASES.items():
        if key in aliases or any(key.startswith(a) for a in aliases):
            found.add(family)
        else:
            for alias in aliases:
                if alias in key:
                    found.add(family)
                    break
    for prefix, extras in _APPLIANCE_EXTRA_FAMILIES.items():
        if key == prefix or key.startswith(prefix):
            found.update(extras)
    return found


def families_compatible(appliance_make: Optional[str], recall_manufacturer: Optional[str]) -> bool:
    recall_fam = manufacturer_family(recall_manufacturer)
    if not recall_fam:
        return False
    return recall_fam in appliance_families(appliance_make)
