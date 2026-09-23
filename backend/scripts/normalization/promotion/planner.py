from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from ..paths import MANUFACTURER_OVERLAYS_DIR, PROMOTIONS_DIR, WHIRLPOOL_OVERLAY_PATH
from ..review.review_package import load_review_package


MANUAL_TO_OVERLAY: dict[str, dict[str, str]] = {
    "W8178559": {
        "overlayFile": "whirlpool_vented_dryer.json",
        "platformFamilyId": "whirlpool_duet_sport_mce_dryer",
        "manufacturer": "Whirlpool",
    },
    "W10680150": {
        "overlayFile": "whirlpool_vented_dryer.json",
        "platformFamilyId": "whirlpool_ccu_dryer",
        "manufacturer": "Whirlpool",
    },
    "W8178558": {
        "overlayFile": "whirlpool_front_load_washer.json",
        "platformFamilyId": "whirlpool_duet_sport_ccu_mcu",
        "manufacturer": "Whirlpool",
    },
    "W11169652": {
        "overlayFile": "whirlpool_front_load_washer.json",
        "platformFamilyId": "whirlpool_fl_dd_direct_drive",
        "manufacturer": "Whirlpool",
    },
    "W10864849": {
        "overlayFile": "whirlpool_top_load_washer.json",
        "platformFamilyId": "whirlpool_tl_dd_direct_drive",
        "manufacturer": "Whirlpool",
    },
    "W11697231": {
        "overlayFile": "whirlpool_top_load_washer.json",
        "platformFamilyId": "whirlpool_tl_dd_direct_drive",
        "manufacturer": "Whirlpool",
    },
    "W11416787": {
        "overlayFile": "whirlpool_top_load_washer.json",
        "platformFamilyId": "whirlpool_tl_dd_5100_direct_drive",
        "manufacturer": "Whirlpool",
    },
    "SAMSUNG-FL-BB8700-WASHER": {
        "overlayFile": "samsung_front_load_washer.json",
        "platformFamilyId": "samsung_fl_bb8700_direct_drive",
        "manufacturer": "Samsung",
    },
    "SAMSUNG-FL-WF6000R-WASHER": {
        "overlayFile": "samsung_front_load_washer.json",
        "platformFamilyId": "samsung_fl_wf6000r_direct_drive",
        "manufacturer": "Samsung",
    },
    "SAMSUNG-FL-BB8700-DRYER": {
        "overlayFile": "samsung_vented_dryer.json",
        "platformFamilyId": "samsung_fl_dryer_bb8700",
        "manufacturer": "Samsung",
    },
    "SAMSUNG-FL-DV6000-DRYER": {
        "overlayFile": "samsung_vented_dryer.json",
        "platformFamilyId": "samsung_fl_dryer_dv6000",
        "manufacturer": "Samsung",
    },
    "SAMSUNG-TL-DV50-DRYER": {
        "overlayFile": "samsung_vented_dryer.json",
        "platformFamilyId": "samsung_tl_dryer_dv50",
        "manufacturer": "Samsung",
    },
    "W11633848": {
        "overlayFile": "whirlpool_dishwasher.json",
        "platformFamilyId": "whirlpool_dishwasher_acu",
        "manufacturer": "Whirlpool",
    },
    "W11480208": {
        "overlayFile": "whirlpool_dishwasher.json",
        "platformFamilyId": "whirlpool_dishwasher_acu",
        "manufacturer": "Whirlpool",
    },
    "W11499711": {
        "overlayFile": "whirlpool_dishwasher.json",
        "platformFamilyId": "whirlpool_dishwasher_acu",
        "manufacturer": "Whirlpool",
    },
    "SAMSUNG-DISHWASHER": {
        "overlayFile": "samsung_dishwasher.json",
        "platformFamilyId": "samsung_dishwasher",
        "manufacturer": "Samsung",
    },
    "SAMSUNG-DISHWASHER-M9": {
        "overlayFile": "samsung_dishwasher.json",
        "platformFamilyId": "samsung_dishwasher",
        "manufacturer": "Samsung",
    },
}

TOP_LOAD_PLATFORM_PREFIXES = ("whirlpool_tl", "whirlpool_mvw")

TL_ALIAS_REMAP = {
    "door_lock": "lid_lock",
}
TL_TEST_TARGET_REMAP = {
    "door_lock_test": "lid_lock_test",
}


def _normalize_promotion_value(
    value: dict[str, Any],
    *,
    overlay_section: str,
    ontology_id: str | None,
) -> dict[str, Any]:
    if ontology_id != "top_load_washer":
        return value

    if overlay_section == "oemTermAliases":
        return {
            term: TL_ALIAS_REMAP.get(str(canonical_id), canonical_id)
            for term, canonical_id in value.items()
        }

    if overlay_section in {"procedureBindings", "measurementBindings"}:
        target = value.get("testTargetId")
        if target in TL_TEST_TARGET_REMAP:
            return {**value, "testTargetId": TL_TEST_TARGET_REMAP[target]}

    return value


def resolve_overlay_target(manual_id: str, platform_id: str | None) -> dict[str, str]:
    if manual_id in MANUAL_TO_OVERLAY:
        return MANUAL_TO_OVERLAY[manual_id]
    if platform_id and any(platform_id.startswith(prefix) for prefix in TOP_LOAD_PLATFORM_PREFIXES):
        return {
            "overlayFile": "whirlpool_top_load_washer.json",
            "platformFamilyId": f"{platform_id}_direct_drive",
            "manufacturer": "Whirlpool",
        }
    if platform_id and "dryer" in platform_id and platform_id.startswith("samsung_"):
        return {
            "overlayFile": "samsung_vented_dryer.json",
            "platformFamilyId": platform_id,
            "manufacturer": "Samsung",
        }
    if platform_id and platform_id.startswith("samsung_fl_"):
        return {
            "overlayFile": "samsung_front_load_washer.json",
            "platformFamilyId": f"{platform_id}_direct_drive",
            "manufacturer": "Samsung",
        }
    if platform_id and "whirlpool" in platform_id:
        return {
            "overlayFile": "whirlpool_front_load_washer.json",
            "platformFamilyId": platform_id,
            "manufacturer": "Whirlpool",
        }
    raise ValueError(
        f"No overlay publish target configured for manual {manual_id}. "
        "Add MANUAL_TO_OVERLAY mapping before promotion.",
    )


def load_overlay_file(filename: str) -> dict[str, Any]:
    path = MANUFACTURER_OVERLAYS_DIR / filename
    if not path.is_file():
        raise FileNotFoundError(f"Overlay file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def find_platform_family(overlay: dict[str, Any], platform_family_id: str) -> dict[str, Any] | None:
    for family in overlay.get("platformFamilies", []):
        if family.get("platformFamilyId") == platform_family_id:
            return family
    return None


def _existing_alias_keys(family: dict[str, Any]) -> set[str]:
    return {str(k).lower() for k in (family.get("oemTermAliases") or {}).keys()}


def _existing_procedure_ids(family: dict[str, Any]) -> set[str]:
    return {
        binding.get("procedureId")
        for binding in (family.get("procedureBindings") or [])
        if binding.get("procedureId")
    }


def _existing_measurement_keys(family: dict[str, Any]) -> set[str]:
    keys: set[str] = set()
    for binding in family.get("measurementBindings") or []:
        proc = binding.get("procedureId")
        knowledge = binding.get("measurementKnowledgeId")
        if proc and knowledge:
            keys.add(f"{proc}:{knowledge}")
    return keys


def plan_promotion(
    manual_id: str,
    include_statuses: tuple[str, ...] = ("approved",),
) -> dict[str, Any]:
    package = load_review_package(manual_id)
    platform_id = package.get("platformId")
    ontology_id = package.get("ontologyId")
    target = resolve_overlay_target(manual_id, platform_id)
    overlay = load_overlay_file(target["overlayFile"])
    family = find_platform_family(overlay, target["platformFamilyId"])
    if not family:
        raise ValueError(f"Platform family {target['platformFamilyId']} not found in overlay")

    approved = [
        record for record in package.get("records", [])
        if record.get("status") in include_statuses
    ]

    block_reasons: list[str] = []
    for record in approved:
        if record.get("approvalLevel") == "blocked" and not record.get("mapsTo"):
            block_reasons.append(
                f"{record.get('candidateId')}: blocked approval level",
            )
            continue

        candidate_type = record.get("candidateType")
        term = str(record.get("what") or "").lower()

        for conflict in record.get("conflicts") or []:
            if conflict.get("status") != "CONFLICT_REQUIRES_REVIEW":
                continue

            conflict_type = conflict.get("conflictType")
            if conflict_type == "RELATIONSHIP_CONFLICT":
                if candidate_type in {
                    "relationshipOverride",
                    "relationshipAddition",
                    "canonicalOverride",
                }:
                    block_reasons.append(
                        "PROMOTION BLOCKED — RELATIONSHIP_CONFLICT: "
                        f"{conflict.get('description')}",
                    )
                continue

            if conflict_type == "ALIAS_CONFLICT" and candidate_type == "canonicalMapping":
                for assertion in conflict.get("assertions") or []:
                    if str(assertion.get("sourceTerm") or "").lower() == term:
                        block_reasons.append(
                            f"PROMOTION BLOCKED — ALIAS_CONFLICT for '{record.get('what')}'",
                        )
                        break
                continue

            if conflict_type == "TEST_TARGET_CONFLICT":
                if candidate_type == "procedureTestBinding":
                    block_reasons.append(
                        f"PROMOTION BLOCKED — TEST_TARGET_CONFLICT: {conflict.get('id')}",
                    )

    diff: dict[str, Any] = {
        "oemTermAliases": {"add": {}, "skip": {}},
        "displayTerms": {"add": {}, "skip": {}},
        "procedureBindings": {"add": [], "skip": []},
        "measurementBindings": {"add": [], "skip": []},
    }

    existing_aliases = _existing_alias_keys(family)
    existing_procedures = _existing_procedure_ids(family)
    existing_measurements = _existing_measurement_keys(family)

    for record in approved:
        proposed = record.get("proposedChange") or {}
        section = proposed.get("overlaySection")
        value = _normalize_promotion_value(
            dict(proposed.get("value") or {}),
            overlay_section=str(section or ""),
            ontology_id=ontology_id,
        )

        if section == "oemTermAliases":
            for term, canonical_id in value.items():
                if str(term).lower() in existing_aliases:
                    diff["oemTermAliases"]["skip"][term] = canonical_id
                else:
                    diff["oemTermAliases"]["add"][term] = canonical_id

        elif section == "procedureBindings":
            proc_id = value.get("procedureId")
            binding = {
                "procedureId": proc_id,
                "testTargetId": value.get("testTargetId"),
                "displayTitle": value.get("displayTitle"),
            }
            if proc_id in existing_procedures:
                diff["procedureBindings"]["skip"].append(binding)
            else:
                diff["procedureBindings"]["add"].append(binding)

        elif section == "measurementBindings":
            proc_id = value.get("procedureId")
            knowledge_id = value.get("measurementKnowledgeId")
            key = f"{proc_id}:{knowledge_id}"
            binding = {
                "procedureId": proc_id,
                "measurementKnowledgeId": knowledge_id,
                "testTargetId": value.get("testTargetId"),
            }
            if key in existing_measurements:
                diff["measurementBindings"]["skip"].append(binding)
            else:
                diff["measurementBindings"]["add"].append(binding)

    promotion_id = f"promo-{manual_id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    plan = {
        "promotionId": promotion_id,
        "manualId": manual_id,
        "platformId": platform_id,
        "overlayFile": target["overlayFile"],
        "platformFamilyId": target["platformFamilyId"],
        "status": "planned",
        "blocked": bool(block_reasons),
        "blockReasons": block_reasons,
        "approvedCandidateIds": [record.get("candidateId") for record in approved],
        "diff": diff,
        "plannedAt": datetime.now(timezone.utc).isoformat(),
    }

    PROMOTIONS_DIR.mkdir(parents=True, exist_ok=True)
    plan_path = PROMOTIONS_DIR / f"{promotion_id}.json"
    plan_path.write_text(json.dumps(plan, indent=2), encoding="utf-8")
    return plan


def format_promotion_diff(plan: dict[str, Any]) -> str:
    lines: list[str] = []
    if plan.get("blocked"):
        lines.append("PROMOTION BLOCKED")
        for reason in plan.get("blockReasons") or []:
            lines.append(f"  - {reason}")
        lines.append("")

    diff = plan.get("diff") or {}
    alias_add = diff.get("oemTermAliases", {}).get("add") or {}
    if alias_add:
        lines.append("+ oemTermAliases:")
        for term, canonical_id in sorted(alias_add.items()):
            lines.append(f"    {term} -> {canonical_id}")

    proc_add = diff.get("procedureBindings", {}).get("add") or []
    if proc_add:
        lines.append("+ procedureBindings:")
        for binding in proc_add:
            lines.append(
                f"    {binding.get('procedureId')} -> {binding.get('testTargetId')}",
            )

    meas_add = diff.get("measurementBindings", {}).get("add") or []
    if meas_add:
        lines.append("+ measurementBindings:")
        for binding in meas_add:
            lines.append(
                f"    {binding.get('measurementKnowledgeId')} "
                f"({binding.get('procedureId')}) -> {binding.get('testTargetId')}",
            )

    alias_skip = diff.get("oemTermAliases", {}).get("skip") or {}
    if alias_skip:
        lines.append("= oemTermAliases (already present):")
        for term, canonical_id in sorted(alias_skip.items()):
            lines.append(f"    {term} -> {canonical_id}")

    if not lines:
        lines.append("No overlay mutations in plan (all approved items already published).")
    return "\n".join(lines)
