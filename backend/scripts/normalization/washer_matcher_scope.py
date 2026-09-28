"""Platform-scoped washer matcher boundaries (CG-6.7 WP1.1 — routing only, not canonical change)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .ontology_resolver import resolve_ontology_id
from .paths import (
    CANONICAL_TOP_LOAD_WASHER_PATH,
    CANONICAL_WASHER_PATH,
    PLATFORM_OVERLAY_PATH,
    TOP_LOAD_PLATFORM_OVERLAY_PATH,
    WHIRLPOOL_OVERLAY_PATH,
    WHIRLPOOL_TL_OVERLAY_PATH,
)

WHIRLPOOL_TL_PLATFORM_PREFIXES = ("whirlpool_tl", "whirlpool_mvw")

TL_CANONICAL_REMAP: dict[str, str] = {
    "door_lock": "lid_lock",
}

TL_TEST_TARGET_REMAP: dict[str, str] = {
    "door_lock_test": "lid_lock_test",
}

TL_GLOBAL_HINT_REMAP: dict[str, str] = {
    "door_lock": "lid_lock",
    "door_lock": "lid_lock",
}


def is_top_load_washer_platform(platform_id: str | None) -> bool:
    return resolve_ontology_id("washer", platform_id) == "top_load_washer"


def resolve_washer_canonical_path(template_id: str, platform_id: str | None = None) -> Path | None:
    if template_id != "washer":
        return None
    if is_top_load_washer_platform(platform_id):
        return CANONICAL_TOP_LOAD_WASHER_PATH if CANONICAL_TOP_LOAD_WASHER_PATH.is_file() else None
    return CANONICAL_WASHER_PATH if CANONICAL_WASHER_PATH.is_file() else None


def resolve_platform_reference_overlay_path(platform_id: str | None) -> Path | None:
    if is_top_load_washer_platform(platform_id):
        return TOP_LOAD_PLATFORM_OVERLAY_PATH if TOP_LOAD_PLATFORM_OVERLAY_PATH.is_file() else None
    return PLATFORM_OVERLAY_PATH if PLATFORM_OVERLAY_PATH.is_file() else None


def is_whirlpool_top_load_platform(platform_id: str | None) -> bool:
    platform = str(platform_id or "")
    return any(platform.startswith(prefix) for prefix in WHIRLPOOL_TL_PLATFORM_PREFIXES)


@lru_cache(maxsize=1)
def load_top_load_functional_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    if not TOP_LOAD_PLATFORM_OVERLAY_PATH.is_file():
        return aliases
    overlay_file = json.loads(TOP_LOAD_PLATFORM_OVERLAY_PATH.read_text(encoding="utf-8"))
    for platform in overlay_file.get("platforms", []):
        for seed_id, canonical_id in (platform.get("componentAliases") or {}).items():
            aliases[str(seed_id)] = str(canonical_id)
    return aliases


def remap_canonical_for_platform(
    canonical_id: str,
    template_id: str,
    platform_id: str | None,
) -> str:
    if resolve_ontology_id(template_id, platform_id) != "top_load_washer":
        return canonical_id
    aliases = load_top_load_functional_aliases()
    return aliases.get(canonical_id, TL_CANONICAL_REMAP.get(canonical_id, canonical_id))


def remap_seed_canonical_id(
    seed_component_id: str,
    registry_canonical_id: str,
    template_id: str,
    platform_id: str | None,
) -> str:
    if resolve_ontology_id(template_id, platform_id) != "top_load_washer":
        return registry_canonical_id
    aliases = load_top_load_functional_aliases()
    if seed_component_id in aliases:
        return aliases[seed_component_id]
    return remap_canonical_for_platform(registry_canonical_id, template_id, platform_id)


def remap_test_target_for_platform(test_target: str, platform_id: str | None) -> str:
    if not is_top_load_washer_platform(platform_id):
        return test_target
    return TL_TEST_TARGET_REMAP.get(test_target, test_target)


def _merge_overlay_aliases(
    registry: dict[str, tuple[str, float, str]],
    overlay_path: Path,
    *,
    template_id: str,
    platform_id: str | None,
    layer_prefix: str,
) -> None:
    overlay_file = json.loads(overlay_path.read_text(encoding="utf-8"))
    for platform in overlay_file.get("platforms", []):
        platform_key = str(platform.get("platformId") or layer_prefix)
        for seed_id, canonical_id in (platform.get("componentAliases") or {}).items():
            remapped = remap_canonical_for_platform(str(canonical_id), template_id, platform_id)
            registry[_normalize_term(seed_id)] = (
                remapped,
                0.96,
                f"platform_overlay:{platform_key}",
            )


def _merge_manufacturer_aliases(
    registry: dict[str, tuple[str, float, str]],
    overlay_path: Path,
    *,
    template_id: str,
    platform_id: str | None,
) -> None:
    overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
    for family in overlay.get("platformFamilies", []):
        family_id = str(family.get("platformFamilyId") or "manufacturer")
        for term, canonical_id in (family.get("oemTermAliases") or {}).items():
            remapped = remap_canonical_for_platform(str(canonical_id), template_id, platform_id)
            registry[_normalize_term(term)] = (
                remapped,
                0.98,
                f"manufacturer_overlay:{family_id}",
            )


def _normalize_term(value: str) -> str:
    import re

    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _merge_top_load_functional_aliases(
    registry: dict[str, tuple[str, float, str]],
    *,
    template_id: str,
    platform_id: str | None,
) -> None:
    """Rev1 functional seed-id remaps — not Whirlpool OEM vocabulary."""
    for seed_id, canonical_id in load_top_load_functional_aliases().items():
        remapped = remap_canonical_for_platform(str(canonical_id), template_id, platform_id)
        registry[_normalize_term(seed_id)] = (remapped, 0.96, "top_load_functional_alias")


def extend_alias_registry_for_platform(
    registry: dict[str, tuple[str, float, str]],
    template_id: str,
    platform_id: str | None,
) -> None:
    """Load platform/manufacturer overlay aliases scoped to washer topology."""
    if template_id != "washer":
        return

    if is_top_load_washer_platform(platform_id):
        _merge_top_load_functional_aliases(
            registry,
            template_id=template_id,
            platform_id=platform_id,
        )
        if is_whirlpool_top_load_platform(platform_id):
            reference_path = resolve_platform_reference_overlay_path(platform_id)
            if reference_path is not None:
                _merge_overlay_aliases(
                    registry,
                    reference_path,
                    template_id=template_id,
                    platform_id=platform_id,
                    layer_prefix="reference",
                )
            if WHIRLPOOL_TL_OVERLAY_PATH.is_file():
                _merge_manufacturer_aliases(
                    registry,
                    WHIRLPOOL_TL_OVERLAY_PATH,
                    template_id=template_id,
                    platform_id=platform_id,
                )
        return

    reference_path = resolve_platform_reference_overlay_path(platform_id)
    if reference_path is not None:
        _merge_overlay_aliases(
            registry,
            reference_path,
            template_id=template_id,
            platform_id=platform_id,
            layer_prefix="reference",
        )

    if WHIRLPOOL_OVERLAY_PATH.is_file():
        _merge_manufacturer_aliases(
            registry,
            WHIRLPOOL_OVERLAY_PATH,
            template_id=template_id,
            platform_id=platform_id,
        )
