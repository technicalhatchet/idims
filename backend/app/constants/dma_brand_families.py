"""Canonical appliance brands and field aliases for DMA error code lookup."""

from __future__ import annotations

CANONICAL_MANUFACTURERS = (
    "Whirlpool",
    "Samsung",
    "LG",
    "GE",
    "Frigidaire",
    "Bosch",
)

# Alias make (as stored on work orders) -> canonical reference brand
MANUFACTURER_ALIASES: dict[str, str] = {
    "Maytag": "Whirlpool",
    "KitchenAid": "Whirlpool",
    "Amana": "Whirlpool",
    "JennAir": "Whirlpool",
    "Jennair": "Whirlpool",
    "Hotpoint": "GE",
    "Cafe": "GE",
    "Café": "GE",
    "Electrolux": "Frigidaire",
}

APPLIANCE_SECTION_TO_SUBTYPE: dict[str, str] = {
    "Washer": "washing_machine",
    "Top-Load Washer Specific": "washing_machine",
    "Dryer": "dryer",
    "Refrigerator": "refrigerator",
    "Dishwasher": "dishwasher",
    "Oven / Range": "oven",
    "Microwave": "microwave",
}


def resolve_canonical_manufacturer(make: str | None) -> str | None:
    if not make:
        return None
    trimmed = make.strip()
    if not trimmed:
        return None
    if trimmed in CANONICAL_MANUFACTURERS:
        return trimmed
    return MANUFACTURER_ALIASES.get(trimmed, trimmed)


def manufacturers_for_lookup(make: str | None) -> list[str]:
    """Return canonical brand(s) to query for a work-order make."""
    if not make or not make.strip():
        return list(CANONICAL_MANUFACTURERS)
    canonical = resolve_canonical_manufacturer(make)
    if canonical in CANONICAL_MANUFACTURERS:
        return [canonical]
    return [canonical] if canonical else []
