from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .planner import find_platform_family, load_overlay_file


def _normalize_alias_map(aliases: dict[str, Any]) -> dict[str, str]:
    return {
        str(key).lower(): str(value)
        for key, value in (aliases or {}).items()
        if key and value
    }


def _procedure_binding_map(bindings: list[dict[str, Any]]) -> dict[str, str]:
    result: dict[str, str] = {}
    for binding in bindings or []:
        proc_id = binding.get("procedureId")
        target = binding.get("testTargetId")
        if proc_id and target:
            result[str(proc_id)] = str(target)
    return result


def _measurement_binding_map(bindings: list[dict[str, Any]]) -> dict[str, str]:
    result: dict[str, str] = {}
    for binding in bindings or []:
        proc_id = binding.get("procedureId")
        knowledge_id = binding.get("measurementKnowledgeId")
        target = binding.get("testTargetId")
        if proc_id and knowledge_id and target:
            result[f"{proc_id}:{knowledge_id}"] = str(target)
    return result


def extract_family_semantics(family: dict[str, Any]) -> dict[str, Any]:
    return {
        "platformFamilyId": family.get("platformFamilyId"),
        "oemTermAliases": _normalize_alias_map(family.get("oemTermAliases")),
        "procedureBindings": _procedure_binding_map(family.get("procedureBindings")),
        "measurementBindings": _measurement_binding_map(family.get("measurementBindings")),
        "relationshipOverrides": family.get("overrides") or [],
        "relationshipAdditions": (family.get("add") or {}).get("relationships") or [],
    }


def compare_alias_maps(
    reference: dict[str, str],
    generated: dict[str, str],
) -> dict[str, Any]:
    mismatches = []
    for term, canonical_id in reference.items():
        generated_id = generated.get(term)
        if generated_id != canonical_id:
            mismatches.append(
                {
                    "term": term,
                    "reference": canonical_id,
                    "generated": generated_id,
                },
            )
    return {
        "equivalent": not mismatches,
        "referenceCount": len(reference),
        "generatedCount": len(generated),
        "mismatches": mismatches,
        "extraGenerated": sorted(set(generated) - set(reference)),
    }


def compare_binding_maps(
    reference: dict[str, str],
    generated: dict[str, str],
    label: str,
) -> dict[str, Any]:
    mismatches = []
    for key, value in reference.items():
        generated_value = generated.get(key)
        if generated_value != value:
            mismatches.append(
                {
                    "key": key,
                    "reference": value,
                    "generated": generated_value,
                },
            )
    return {
        "label": label,
        "equivalent": not mismatches,
        "referenceCount": len(reference),
        "generatedCount": len(generated),
        "mismatches": mismatches,
        "extraGenerated": sorted(set(generated) - set(reference)),
    }


def compare_promotion_equivalence(
    reference_family: dict[str, Any],
    generated_family: dict[str, Any],
    *,
    manual_id: str | None = None,
) -> dict[str, Any]:
    ref = extract_family_semantics(reference_family)
    gen = extract_family_semantics(generated_family)

    alias_compare = compare_alias_maps(ref["oemTermAliases"], gen["oemTermAliases"])
    proc_compare = compare_binding_maps(
        ref["procedureBindings"],
        gen["procedureBindings"],
        "procedureBindings",
    )
    meas_compare = compare_binding_maps(
        ref["measurementBindings"],
        gen["measurementBindings"],
        "measurementBindings",
    )

    topology_preserved = (
        ref["relationshipOverrides"] == gen["relationshipOverrides"]
        and ref["relationshipAdditions"] == gen["relationshipAdditions"]
    )

    checks = {
        "canonicalAliases": alias_compare["equivalent"],
        "procedureBindings": proc_compare["equivalent"],
        "measurementBindings": meas_compare["equivalent"],
        "topologyOverrides": topology_preserved,
    }

    return {
        "manualId": manual_id,
        "equivalent": all(checks.values()),
        "checks": checks,
        "aliasComparison": alias_compare,
        "procedureBindingComparison": proc_compare,
        "measurementBindingComparison": meas_compare,
        "provenance": "generated",
        "notes": [
            "Semantic equivalence: reference CG-2 mappings must be preserved.",
            "Extra generated aliases/bindings are allowed.",
            "Topology overrides remain hand-authored and must not drift.",
        ],
    }


def compare_overlay_files(
    overlay_file: str,
    platform_family_id: str,
    generated_overlay_path: Path,
    *,
    manual_id: str | None = None,
) -> dict[str, Any]:
    reference_overlay = load_overlay_file(overlay_file)
    reference_family = find_platform_family(reference_overlay, platform_family_id)
    if not reference_family:
        raise ValueError(f"Reference family {platform_family_id} not found")

    generated_overlay = json.loads(generated_overlay_path.read_text(encoding="utf-8"))
    generated_family = find_platform_family(generated_overlay, platform_family_id)
    if not generated_family:
        raise ValueError(f"Generated family {platform_family_id} not found")

    return compare_promotion_equivalence(
        reference_family,
        generated_family,
        manual_id=manual_id,
    )


def apply_plan_to_overlay_copy(
    overlay_file: str,
    platform_family_id: str,
    plan: dict[str, Any],
) -> dict[str, Any]:
    from .publish import apply_promotion_diff

    overlay = load_overlay_file(overlay_file)
    return apply_promotion_diff(overlay, platform_family_id, plan.get("diff") or {})
