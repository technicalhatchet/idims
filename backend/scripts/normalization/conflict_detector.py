from __future__ import annotations

from collections import defaultdict
from typing import Any


def topology_signature(manual_entry: dict[str, Any], procedures: list[dict[str, Any]]) -> str:
    """Coarse motor-path architecture hint for conflict detection."""
    platform_id = str(manual_entry.get("platformId") or "")
    component_set = {
        component
        for procedure in procedures
        for component in procedure.get("componentIds") or []
    }
    text_blob = " ".join(
        [
            str(procedure.get("title") or "")
            for procedure in procedures
        ],
    ).lower()

    platform_ccu_mcu = {
        "whirlpool_duet_sport",
        "samsung_fl_washer_wf6000r",
    }
    platform_direct_drive = {
        "whirlpool_fl_dd",
        "samsung_fl_washer_bb8700",
    }

    if platform_id in platform_ccu_mcu:
        return "ccu_mcu_motor"
    if platform_id in platform_direct_drive:
        return "direct_drive_motor"

    if "motor_controller" in component_set or "inverter" in component_set:
        return "ccu_mcu_motor"
    if "mcu" in text_blob:
        return "ccu_mcu_motor"
    if "drive_belt" in component_set or platform_id == "whirlpool_duet_sport":
        return "belt_drive_motor"
    if "drive_motor" in component_set:
        return "motor_present_unknown_path"
    return "unknown"


def detect_alias_conflicts(
    all_mapping_candidates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_term: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for candidate in all_mapping_candidates:
        if candidate.get("status") == "UNRESOLVED_TERM":
            continue
        term = str(candidate.get("sourceTerm") or "").strip().lower()
        if not term:
            continue
        by_term[term].append(candidate)

    conflicts: list[dict[str, Any]] = []
    for term, entries in by_term.items():
        canonical_ids = {entry.get("canonicalId") for entry in entries}
        if len(canonical_ids) <= 1:
            continue
        conflicts.append(
            {
                "id": f"conflict-alias-{term.replace(' ', '-')}",
                "status": "CONFLICT_REQUIRES_REVIEW",
                "conflictType": "ALIAS_CONFLICT",
                "description": (
                    f"OEM term '{term}' maps to multiple canonical ids across manuals"
                ),
                "assertions": [
                    {
                        "manualId": entry.get("provenance", {}).get("manualId"),
                        "canonicalId": entry.get("canonicalId"),
                        "confidence": entry.get("confidence"),
                        "sourceTerm": entry.get("sourceTerm"),
                    }
                    for entry in entries
                ],
            },
        )
    return conflicts


def detect_topology_conflicts(
    manual_runs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Flag washer manuals whose inferred motor architecture differs."""
    washer_runs = [
        run for run in manual_runs if run.get("templateId") == "washer"
    ]
    signatures: dict[str, list[str]] = defaultdict(list)
    for run in washer_runs:
        signature = run.get("topologySignature")
        manual_id = run.get("manualId")
        if signature and manual_id:
            signatures[signature].append(manual_id)

    if len(signatures) <= 1:
        return []

    if len(signatures) <= 1:
        return []

    return [
        {
            "id": "conflict-topology-washer-family-mix",
            "status": "CONFLICT_REQUIRES_REVIEW",
            "conflictType": "RELATIONSHIP_CONFLICT",
            "description": (
                "Canonical graph assumes shared FL washer concepts, but manuals "
                "imply different motor control paths (CCU→MCU vs direct drive). "
                "Do not auto-merge topology into canonical layer."
            ),
            "assertions": [
                {"topologySignature": sig, "manualIds": ids}
                for sig, ids in signatures.items()
            ],
        },
    ]


def detect_test_target_conflicts(
    all_overlay_candidates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_proc: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for candidate in all_overlay_candidates:
        if candidate.get("candidateType") != "procedureTestBinding":
            continue
        proc_id = candidate.get("procedureId")
        if proc_id:
            by_proc[proc_id].append(candidate)

    conflicts: list[dict[str, Any]] = []
    for proc_id, entries in by_proc.items():
        targets = {entry.get("canonicalTestTarget") for entry in entries}
        if len(targets) <= 1:
            continue
        conflicts.append(
            {
                "id": f"conflict-test-target-{proc_id}",
                "status": "CONFLICT_REQUIRES_REVIEW",
                "conflictType": "TEST_TARGET_CONFLICT",
                "description": f"Procedure {proc_id} mapped to multiple canonical test targets",
                "assertions": entries,
            },
        )
    return conflicts


def merge_conflicts(*groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for group in groups:
        for conflict in group:
            merged[conflict["id"]] = conflict
    return list(merged.values())
