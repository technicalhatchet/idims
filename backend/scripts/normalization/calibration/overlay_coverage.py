from __future__ import annotations

import json
from typing import Any

from ..paths import MANUFACTURER_OVERLAYS_DIR, WHIRLPOOL_OVERLAY_PATH


def _normalize_term(value: str) -> str:
    return str(value or "").strip().lower()


def load_all_overlay_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}

    for overlay_path in MANUFACTURER_OVERLAYS_DIR.glob("*.json"):
        overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
        for family in overlay.get("platformFamilies", []):
            for term, canonical_id in (family.get("oemTermAliases") or {}).items():
                aliases[_normalize_term(term)] = canonical_id

    if WHIRLPOOL_OVERLAY_PATH.is_file():
        overlay = json.loads(WHIRLPOOL_OVERLAY_PATH.read_text(encoding="utf-8"))
        for family in overlay.get("platformFamilies", []):
            for term, canonical_id in (family.get("oemTermAliases") or {}).items():
                aliases[_normalize_term(term)] = canonical_id

    return aliases


def load_all_overlay_procedure_bindings() -> set[str]:
    bindings: set[str] = set()
    for overlay_path in MANUFACTURER_OVERLAYS_DIR.glob("*.json"):
        overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
        for family in overlay.get("platformFamilies", []):
            for binding in family.get("procedureBindings") or []:
                proc_id = binding.get("procedureId")
                if proc_id:
                    bindings.add(proc_id)

    if WHIRLPOOL_OVERLAY_PATH.is_file():
        overlay = json.loads(WHIRLPOOL_OVERLAY_PATH.read_text(encoding="utf-8"))
        for family in overlay.get("platformFamilies", []):
            for binding in family.get("procedureBindings") or []:
                proc_id = binding.get("procedureId")
                if proc_id:
                    bindings.add(proc_id)

    return bindings


def load_all_overlay_measurement_bindings() -> set[str]:
    bindings: set[str] = set()
    for overlay_path in MANUFACTURER_OVERLAYS_DIR.glob("*.json"):
        overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
        for family in overlay.get("platformFamilies", []):
            for binding in family.get("measurementBindings") or []:
                proc_id = binding.get("procedureId")
                knowledge_id = binding.get("measurementKnowledgeId")
                if proc_id and knowledge_id:
                    bindings.add(f"{proc_id}:{knowledge_id}")

    if WHIRLPOOL_OVERLAY_PATH.is_file():
        overlay = json.loads(WHIRLPOOL_OVERLAY_PATH.read_text(encoding="utf-8"))
        for family in overlay.get("platformFamilies", []):
            for binding in family.get("measurementBindings") or []:
                proc_id = binding.get("procedureId")
                knowledge_id = binding.get("measurementKnowledgeId")
                if proc_id and knowledge_id:
                    bindings.add(f"{proc_id}:{knowledge_id}")

    return bindings


def candidate_overlay_state(
    candidate: dict[str, Any],
    overlay_aliases: dict[str, str],
    overlay_procedures: set[str],
    overlay_measurements: set[str],
) -> str:
    candidate_type = candidate.get("candidateType")
    if candidate_type == "canonicalMapping":
        term = _normalize_term(candidate.get("sourceTerm") or "")
        canonical_id = candidate.get("canonicalId")
        if term and term in overlay_aliases:
            if overlay_aliases[term] == canonical_id:
                return "already_published"
            return "overlay_conflict"
        if candidate.get("status") in {"UNRESOLVED_TERM", "COMPOUND_TERM_CANDIDATE"}:
            return "not_promotion_ready"
        return "promotion_ready"

    if candidate_type == "procedureTestBinding":
        proc_id = candidate.get("procedureId")
        if proc_id in overlay_procedures:
            return "already_published"
        if candidate.get("status") == "UNRESOLVED_TERM":
            return "not_promotion_ready"
        return "promotion_ready"

    if candidate_type == "measurementBinding":
        proc_id = candidate.get("procedureId")
        knowledge_id = candidate.get("measurementKnowledgeId")
        key = f"{proc_id}:{knowledge_id}"
        if key in overlay_measurements:
            return "already_published"
        if candidate.get("status") == "UNRESOLVED_TERM":
            return "not_promotion_ready"
        return "promotion_ready"

    return "unknown"
