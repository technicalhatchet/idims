#!/usr/bin/env python3
"""Apply SAMSUNG-DISHWASHER-M9 human gate from overlay mapping table v1 (no publish)."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CANDIDATES_DIR
from normalization.review.ledger import load_ledger, update_candidate_status
from normalization.review.review_package import materialize_review_package

TABLE_PATH = (
    ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "knowledge"
    / "normalization"
    / "calibration"
    / "SAMSUNG_DISHWASHER_M9_overlay_mapping_table_v1.json"
)
MANUAL_ID = "SAMSUNG-DISHWASHER-M9"
PRIOR_MANUAL_ID = "SAMSUNG-DISHWASHER"
REVIEWER = "human_gate"
NATIVE_PROCEDURE_PREFIX = "samsungdwm9-"

APPROVE_MAPPING_ACTIONS = frozenset(
    {"approve_inherit", "approve_inherit_semantic", "approve_mechanical_alias"}
)
APPROVE_PROCEDURE_ACTIONS = frozenset({"approve_mechanical", "approve_platform_delta"})
APPROVE_MEASUREMENT_ACTIONS = frozenset({"approve_mechanical", "approve_platform_delta"})


def _collect_mapping_actions(table: dict) -> tuple[dict[str, str | None], set[str], set[str]]:
    approved: dict[str, str | None] = {}
    rejected: set[str] = set()
    deferred: set[str] = set()
    for mapping in table.get("mappings") or []:
        action = mapping.get("gateAction")
        candidate_ids = mapping.get("candidateIds") or []
        if not candidate_ids:
            continue
        if action in APPROVE_MAPPING_ACTIONS:
            resolved = mapping.get("candidate")
            for cid in candidate_ids:
                approved[cid] = resolved
        elif action == "reject_mapping":
            rejected.update(candidate_ids)
        elif str(action).startswith("defer"):
            deferred.update(candidate_ids)
    return approved, rejected, deferred


def _collect_reject_ids(table: dict) -> set[str]:
    rejected: set[str] = set()
    for entry in table.get("rejectedOverlayBindings") or []:
        if entry.get("gateAction") == "reject_binding":
            rejected.update(entry.get("overlayCandidateIds") or [])
    return rejected


def _load_overlay_candidate_index(manual_id: str) -> dict[str, str]:
    overlay_path = CANDIDATES_DIR / manual_id / "overlay_candidates.json"
    candidates = json.loads(overlay_path.read_text(encoding="utf-8")).get("candidates", [])
    index: dict[str, str] = {}
    for candidate in candidates:
        candidate_id = candidate.get("id")
        if not candidate_id:
            continue
        proc_id = candidate.get("procedureId")
        if not proc_id or not str(proc_id).startswith(NATIVE_PROCEDURE_PREFIX):
            continue
        if candidate.get("candidateType") == "procedureTestBinding":
            target = candidate.get("canonicalTestTarget")
            if proc_id and target:
                index[f"procedure:{proc_id}:{target}"] = candidate_id
                index[f"procedure:{proc_id}"] = candidate_id
        if candidate.get("candidateType") == "measurementBinding":
            knowledge_id = candidate.get("measurementKnowledgeId")
            if proc_id and knowledge_id:
                index[f"measurement:{proc_id}:{knowledge_id}"] = candidate_id
    return index


def _resolve_binding_candidate_ids(
    binding: dict,
    *,
    section: str,
    candidate_index: dict[str, str],
) -> list[str]:
    explicit = list(binding.get("overlayCandidateIds") or [])
    if explicit:
        return explicit

    procedure_id = binding.get("procedureId")
    if not procedure_id:
        return []

    if section == "measurementBindings":
        knowledge_id = binding.get("measurementKnowledgeId")
        if knowledge_id:
            resolved = candidate_index.get(f"measurement:{procedure_id}:{knowledge_id}")
            return [resolved] if resolved else []

    if section == "procedureBindings":
        resolved = candidate_index.get(f"procedure:{procedure_id}")
        return [resolved] if resolved else []

    return []


def _approve_binding_candidates(
    table: dict,
    *,
    section: str,
    reviewer: str,
    manual_id: str,
    candidate_index: dict[str, str],
) -> int:
    approved = 0
    for binding in table.get(section) or []:
        if binding.get("gateAction") not in APPROVE_PROCEDURE_ACTIONS | APPROVE_MEASUREMENT_ACTIONS:
            continue
        procedure_id = binding.get("procedureId")
        if procedure_id and not str(procedure_id).startswith(NATIVE_PROCEDURE_PREFIX):
            raise ValueError(f"Non-native procedure blocked at gate: {procedure_id}")
        test_target_id = binding.get("testTargetId")
        layer = binding.get("layer", "mechanical_inherited_registration")
        for cid in _resolve_binding_candidate_ids(
            binding,
            section=section,
            candidate_index=candidate_index,
        ):
            update_candidate_status(
                cid,
                "approved",
                reviewer=reviewer,
                reason=f"SAMSUNG-DISHWASHER-M9 overlay mapping table v1 ({layer})",
                manual_id=manual_id,
                resolved_test_target_id=test_target_id,
                resolution_classification="human_gate_approved",
            )
            approved += 1
    return approved


def main() -> int:
    table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
    approve_map, mapping_rejected, mapping_deferred = _collect_mapping_actions(table)
    overlay_reject_ids = _collect_reject_ids(table)

    overlap = (set(approve_map) & mapping_rejected) | (set(approve_map) & overlay_reject_ids)
    if overlap:
        print(f"FAIL: candidate in both approve and reject: {sorted(overlap)}", file=sys.stderr)
        return 1

    approved_count = 0
    for cid, resolved in sorted(approve_map.items()):
        layer = "mechanical_inherited_registration"
        for mapping in table.get("mappings") or []:
            if cid in (mapping.get("candidateIds") or []):
                layer = mapping.get("layer", layer)
                break
        update_candidate_status(
            cid,
            "approved",
            reviewer=REVIEWER,
            reason=f"SAMSUNG-DISHWASHER-M9 overlay mapping table v1 ({layer})",
            manual_id=MANUAL_ID,
            resolved_canonical_id=resolved if isinstance(resolved, str) else None,
            resolution_classification="human_gate_approved",
        )
        approved_count += 1

    rejected_count = 0
    for cid in sorted(mapping_rejected | overlay_reject_ids):
        update_candidate_status(
            cid,
            "rejected",
            reviewer=REVIEWER,
            reason="SAMSUNG-DISHWASHER-M9 gate — wrong matcher or carry-forward overlay binding",
            manual_id=MANUAL_ID,
        )
        rejected_count += 1

    candidate_index = _load_overlay_candidate_index(MANUAL_ID)
    procedure_approved = _approve_binding_candidates(
        table,
        section="procedureBindings",
        reviewer=REVIEWER,
        manual_id=MANUAL_ID,
        candidate_index=candidate_index,
    )
    measurement_approved = _approve_binding_candidates(
        table,
        section="measurementBindings",
        reviewer=REVIEWER,
        manual_id=MANUAL_ID,
        candidate_index=candidate_index,
    )

    package = materialize_review_package(MANUAL_ID, load_ledger())
    records = package.get("records") or []
    summary = package.get("summary") or {}

    evidence = table.get("compoundingEvidence") or {}
    carry_forward = table.get("carryForwardMatcherDefects") or []
    gate_summary = table.get("gateSummary") or {}
    gate_summary["approved"] = approved_count
    gate_summary["rejected"] = rejected_count
    gate_summary["deferred"] = len(mapping_deferred)
    gate_summary["procedureBindingsApproved"] = sum(
        1
        for b in table.get("procedureBindings") or []
        if b.get("gateAction") in APPROVE_PROCEDURE_ACTIONS
    )
    gate_summary["measurementBindingsApproved"] = sum(
        1
        for b in table.get("measurementBindings") or []
        if b.get("gateAction") in APPROVE_MEASUREMENT_ACTIONS
    )
    gate_summary["carryForwardMatcherDefects"] = len(carry_forward)
    gate_summary["genuineNewHumanSemanticDecisions"] = evidence.get(
        "genuineNewHumanSemanticDecisions", 0
    )
    gate_summary["gatedAt"] = datetime.now(timezone.utc).isoformat()
    table["gateSummary"] = gate_summary
    table["status"] = "gated"
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    ledger_report = {
        "manualId": MANUAL_ID,
        "priorManualId": PRIOR_MANUAL_ID,
        "gateKind": "manufacturer_compounding_second_manual",
        "gatedAt": gate_summary["gatedAt"],
        "classificationCounts": {
            "approved": approved_count
            + gate_summary["procedureBindingsApproved"]
            + gate_summary["measurementBindingsApproved"],
            "rejected": rejected_count,
            "deferred": len(mapping_deferred),
        },
        "mappingApprovals": approved_count,
        "mappingRejections": len(mapping_rejected),
        "mappingDeferred": len(mapping_deferred),
        "procedureBindingsApprovedGateTable": gate_summary["procedureBindingsApproved"],
        "measurementBindingsApprovedGateTable": gate_summary["measurementBindingsApproved"],
        "carryForwardMatcherDefects": carry_forward,
        "carryForwardMatcherDefectThemes": evidence.get("carryForwardMatcherDefectThemes", 0),
        "genuineNewHumanSemanticDecisions": evidence.get("genuineNewHumanSemanticDecisions"),
        "genuineNewKnowledgeThemes": evidence.get("genuineNewKnowledgeThemes"),
        "rawProjectedTeachingUnits": evidence.get("rawProjectedTeachingUnits"),
        "deduplicatedTeachingThemes": evidence.get("deduplicatedTeachingThemes"),
        "inheritedExact": evidence.get("inheritedExact"),
        "inheritedSemantic": evidence.get("inheritedSemantic"),
        "inheritanceRate": evidence.get("inheritanceRate"),
        "mechanicalProcedureRegistrations": evidence.get("mechanicalProcedureRegistrations"),
        "mechanicalMeasurementRegistrations": evidence.get("mechanicalMeasurementRegistrations"),
        "newCanonicalConcepts": evidence.get("newCanonicalConcepts"),
        "whirlpoolImports": evidence.get("whirlpoolImports"),
        "publishBlocked": True,
        "reviewPackageSummary": summary,
        "teachingCostAccounting": {
            "priorManualHumanDecisions": evidence.get("priorHumanSemanticDecisions", 15),
            "genuineNewHumanSemanticDecisions": evidence.get("genuineNewHumanSemanticDecisions", 0),
            "carryForwardMatcherDefectThemes": evidence.get("carryForwardMatcherDefectThemes", 0),
            "rawProjectedTeachingUnits": evidence.get("rawProjectedTeachingUnits", 0),
            "note": (
                "M9 gate separates genuine new knowledge (leak_sensor defer, vane_motor platform) "
                "from carry-forward matcher defects (power_supply_routing, communication_routing)."
            ),
        },
        "matcherEvidencePreserved": [
            {
                "theme": entry.get("carryForwardTheme") or entry.get("theme"),
                "procedureId": entry.get("procedureId"),
                "matcherOutput": entry.get("matcherOutput"),
                "expectedCorrection": entry.get("expectedCorrection"),
            }
            for entry in (table.get("rejectedOverlayBindings") or []) + carry_forward
        ],
    }
    ledger_path = (
        ROOT
        / "frontend/components/diagnostics/knowledge/normalization/calibration"
        / "SAMSUNG_DISHWASHER_M9_gate_decision_ledger_v1.json"
    )
    ledger_path.write_text(json.dumps(ledger_report, indent=2), encoding="utf-8")

    print(f"Approved {approved_count} mapping candidate(s) (inherit)")
    print(f"Approved {gate_summary['procedureBindingsApproved']} procedure binding(s) in gate table")
    print(
        f"Approved {gate_summary['measurementBindingsApproved']} measurement binding(s) in gate table"
    )
    print(f"Rejected {rejected_count} mapping/overlay candidate(s)")
    print(f"Deferred mappings: {len(mapping_deferred)}")
    print(f"Carry-forward matcher defects: {len(carry_forward)}")
    print(f"Genuine new human decisions: {evidence.get('genuineNewHumanSemanticDecisions')}")
    print(f"Ledger: {ledger_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
