"""Platform-scoped range_oven matcher boundaries (CG-pilot P05 — routing only, not canonical change)."""

from __future__ import annotations

import json
from pathlib import Path

from .ontology_resolver import RANGE_IMPLEMENTATION_TEMPLATE_IDS, resolve_ontology_id
from .paths import CANONICAL_RANGE_OVEN_PATH, MANUFACTURER_OVERLAYS_DIR

# Procedure seed componentIds → range_oven canonical ids (pipeline routing only).
RANGE_SEED_COMPONENT_ALIASES: dict[str, str] = {
    "surface_element": "surface_heating_system",
    "main_control": "control_board",
    "display_panel": "user_interface",
    "supply": "power_supply",
    "door_lock": "oven_door_switch",
    "thermistor": "temperature_sensor",
    "bake_element": "bake_heating_element",
    "broil_element": "broil_heating_element",
    "convection_fan": "convection_fan",
}

RANGE_PLATFORM_OVERLAY_FILES: dict[str, str] = {
    "samsung_range_ne58": "samsung_range_ne58.json",
    "samsung_range_ne58h_induction": "samsung_range_ne58.json",
    "samsung_range_ne58r9560": "samsung_range_ne58.json",
}


def is_range_template(template_id: str | None) -> bool:
    return str(template_id or "") in RANGE_IMPLEMENTATION_TEMPLATE_IDS


def resolve_range_canonical_path(template_id: str, platform_id: str | None = None) -> Path | None:
    if not is_range_template(template_id):
        return None
    if resolve_ontology_id(template_id, platform_id) != "range_oven":
        return None
    return CANONICAL_RANGE_OVEN_PATH if CANONICAL_RANGE_OVEN_PATH.is_file() else None


def _normalize_term(value: str) -> str:
    import re

    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _family_applies(family: dict, template_id: str, platform_id: str) -> bool:
    applies = family.get("appliesTo") or {}
    platform_ids = [str(item) for item in applies.get("platformIds") or []]
    if platform_id and platform_id in platform_ids:
        return True
    family_platform = str(family.get("platformId") or "")
    if platform_id and family_platform and platform_id.startswith(family_platform):
        return True
    template_ids = [str(item) for item in applies.get("templateIds") or []]
    return template_id in template_ids and not platform_ids


def _merge_range_manufacturer_aliases(
    registry: dict[str, tuple[str, float, str]],
    overlay_path: Path,
    *,
    template_id: str,
    platform_id: str | None,
) -> None:
    overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
    for family in overlay.get("platformFamilies") or []:
        if not _family_applies(family, template_id, str(platform_id or "")):
            continue
        family_id = str(family.get("platformFamilyId") or family.get("platformId") or "range")
        for term, canonical_id in (family.get("oemTermAliases") or {}).items():
            registry[_normalize_term(term)] = (
                str(canonical_id),
                0.98,
                f"manufacturer_overlay:{family_id}",
            )


def load_range_matchable_canonical_ids(ontology: dict) -> set[str]:
    """Range_oven matchable ids: core components + instance/conditional scopes from frozen graph."""
    ids = {str(comp["id"]) for comp in ontology.get("components", []) if comp.get("id")}
    for key in ("instanceScopes", "conditionalInstanceScopes", "conditionalConcepts"):
        for entry in ontology.get(key) or []:
            entry_id = entry.get("id")
            if entry_id:
                ids.add(str(entry_id))
    return ids


def extend_range_alias_registry_for_platform(
    registry: dict[str, tuple[str, float, str]],
    template_id: str,
    platform_id: str | None,
) -> None:
    """Load range seed aliases and CG-12-approved manufacturer overlay oemTermAliases."""
    if not is_range_template(template_id):
        return

    for seed_id, canonical_id in RANGE_SEED_COMPONENT_ALIASES.items():
        registry[_normalize_term(seed_id)] = (canonical_id, 0.96, "range_seed_alias")

    platform_key = str(platform_id or "")
    overlay_name = RANGE_PLATFORM_OVERLAY_FILES.get(platform_key)
    if overlay_name is None and platform_key.startswith("samsung_range_ne58"):
        overlay_name = "samsung_range_ne58.json"
    if overlay_name and MANUFACTURER_OVERLAYS_DIR.is_dir():
        overlay_path = MANUFACTURER_OVERLAYS_DIR / overlay_name
        if overlay_path.is_file():
            _merge_range_manufacturer_aliases(
                registry,
                overlay_path,
                template_id=template_id,
                platform_id=platform_id,
            )
