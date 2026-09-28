from __future__ import annotations

import json
from typing import Any

from .paths import NORMALIZATION_DIR

SEED_REGISTRY_PATH = NORMALIZATION_DIR / "seed_component_registry.json"


def load_seed_registry() -> dict[str, Any]:
    if not SEED_REGISTRY_PATH.is_file():
        return {"entries": {}}
    return json.loads(SEED_REGISTRY_PATH.read_text(encoding="utf-8"))


def _scope_matches(entry: dict[str, Any], template_id: str, platform_id: str | None) -> bool:
    scope = str(entry.get("scope") or "")
    if scope in {"", "global"}:
        return True
    if scope == "washer":
        return template_id == "washer"
    if scope == "front_load_washer":
        return template_id == "washer" and platform_id not in {
            None,
            "",
        } and "tl_" not in str(platform_id or "")
    return scope == template_id


def resolve_seed_component_id(
    seed_component_id: str,
    template_id: str,
    platform_id: str | None = None,
) -> dict[str, Any] | None:
    registry = load_seed_registry()
    entry = (registry.get("entries") or {}).get(str(seed_component_id))
    if not entry:
        return None
    if not _scope_matches(entry, template_id, platform_id):
        return None
    return {
        "seedComponentId": seed_component_id,
        "canonicalId": entry.get("canonicalId"),
        "confidence": float(entry.get("confidence") or 0),
        "reviewLevel": entry.get("reviewLevel") or "normal",
        "scope": entry.get("scope"),
        "notes": entry.get("notes"),
        "registryLayer": "seed_component_registry",
    }
