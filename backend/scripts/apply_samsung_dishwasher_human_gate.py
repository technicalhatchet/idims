#!/usr/bin/env python3
"""Apply SAMSUNG-DISHWASHER human gate from overlay mapping table v1 (no publish)."""

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
    / "SAMSUNG_DISHWASHER_overlay_mapping_table_v1.json"
)
MANUAL_ID = "SAMSUNG-DISHWASHER"
REVIEWER = "human_gate"
NATIVE_PROCEDURE_PREFIX = "samsungdw-"


def _collect_mapping_actions(table: dict) -> tuple[dict[str, str | None], set[str], set[str]]:
    approved: dict[str, str | None] = {}
    rejected: set[str] = set()
    deferred: set[str] = set()
    for mapping in table.get("mappings") or []:
        action = mapping.get("gateAction")
        candidate_ids = mapping.get("candidateIds") or []
        if not candidate_ids:
            continue
        if action in {"approve_auto", "approve_human"}:
            resolved = mapping.get("candidate")
            for cid in candidate_ids:
                approved[cid] = resolved
        elif action == "reject_mapping":
            rejected.update(candidate_ids)
        elif action.startswith("defer"):
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
        if binding.get("gateAction") != "approve_human":
            continue
        procedure_id = binding.get("procedureId")
        if procedure_id and not str(procedure_id).startswith(NATIVE_PROCEDURE_PREFIX):
            raise ValueError(f"Non-native procedure blocked at gate: {procedure_id}")
        test_target_id = binding.get("testTargetId")
        for cid in _resolve_binding_candidate_ids(
            binding,
            section=section,
            candidate_index=candidate_index,
        ):
            update_candidate_status(
                cid,
                "approved",
                reviewer=reviewer,
                reason="SAMSUNG-DISHWASHER overlay mapping table v1",
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
        layer = "canonical_reuse"
        for mapping in table.get("mappings") or []:
            if cid in (mapping.get("candidateIds") or []):
                layer = mapping.get("layer", layer)
                break
        update_candidate_status(
            cid,
            "approved",
            reviewer=REVIEWER,
            reason=f"SAMSUNG-DISHWASHER overlay mapping table v1 ({layer})",
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
            reason="SAMSUNG-DISHWASHER gate — wrong matcher mapping or overlay binding",
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
    gate_summary = table.get("gateSummary") or {}
    gate_summary["approved"] = approved_count
    gate_summary["rejected"] = rejected_count
    gate_summary["deferred"] = len(mapping_deferred)
    gate_summary["procedureBindingsApproved"] = sum(
        1
        for r in records
        if r.get("candidateType") == "procedureTestBinding" and r.get("status") == "approved"
    )
    gate_summary["measurementBindingsApproved"] = sum(
        1
        for r in records
        if r.get("candidateType") == "measurementBinding" and r.get("status") == "approved"
    )
    gate_summary["overlayBindingsRejected"] = sum(
        1 for r in records if r.get("status") == "rejected"
    )
    gate_summary["gatedAt"] = datetime.now(timezone.utc).isoformat()
    table["gateSummary"] = gate_summary
    table["status"] = "gated"
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    ledger_report = {
        "manualId": MANUAL_ID,
        "gateKind": "manufacturer_boundary_first_manual",
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
        "procedureBindingsApprovedLedger": gate_summary["procedureBindingsApproved"],
        "procedureBindingsApprovedGateTable": sum(
            1
            for b in table.get("procedureBindings") or []
            if b.get("gateAction") == "approve_human"
        ),
        "procedureBindingsDeferred": sum(
            1
            for b in table.get("procedureBindings") or []
            if b.get("gateAction") == "defer_procedure_binding"
        ),
        "measurementBindingsApprovedLedger": gate_summary["measurementBindingsApproved"],
        "measurementBindingsApprovedGateTable": sum(
            1
            for b in table.get("measurementBindings") or []
            if b.get("gateAction") == "approve_human"
        ),
        "overlayBindingsRejected": gate_summary["overlayBindingsRejected"],
        "newHumanSemanticDecisions": evidence.get("newHumanSemanticDecisions"),
        "canonicalAutoReuse": evidence.get("canonicalAutoReuse"),
        "newSamsungManufacturerVocabulary": evidence.get("newSamsungManufacturerVocabulary"),
        "newSamsungPlatformKnowledge": evidence.get("newSamsungPlatformKnowledge"),
        "newSamsungModelSpecificKnowledge": evidence.get("newSamsungModelSpecificKnowledge"),
        "matcherBindingCorrections": evidence.get("matcherBindingCorrections"),
        "matcherMappingRejections": evidence.get("matcherMappingRejections"),
        "deferredProceduralTitles": evidence.get("deferredProceduralTitles"),
        "deferredPlatformConcepts": evidence.get("deferredPlatformConcepts"),
        "deferredProcedureBindings": evidence.get("deferredProcedureBindings"),
        "newCanonicalConcepts": evidence.get("newCanonicalConcepts"),
        "whirlpoolIsolationVerdict": evidence.get("whirlpoolIsolationVerdict"),
        "crossTemplateLeakCount": evidence.get("crossTemplateLeakCount"),
        "conflicts": 0,
        "publishBlocked": True,
        "reviewPackageSummary": summary,
        "matcherEvidencePreserved": [
            {
                "procedureId": entry.get("procedureId"),
                "matcherOutput": entry.get("matcherOutput"),
                "expectedCorrection": entry.get("expectedCorrection"),
            }
            for entry in table.get("rejectedOverlayBindings") or []
        ],
        "deferredMappings": sorted(
            {
                mapping.get("manualConcept")
                for mapping in table.get("mappings") or []
                if str(mapping.get("gateAction", "")).startswith("defer")
            }
        ),
    }
    ledger_path = (
        ROOT
        / "frontend/components/diagnostics/knowledge/normalization/calibration"
        / "SAMSUNG_DISHWASHER_gate_decision_ledger_v1.json"
    )
    ledger_path.write_text(json.dumps(ledger_report, indent=2), encoding="utf-8")

    print(f"Approved {approved_count} mapping candidate(s)")
    print(f"Approved {gate_summary['procedureBindingsApproved']} procedure binding(s) in ledger")
    print(
        f"Approved {gate_summary['measurementBindingsApproved']} measurement binding(s) in ledger"
    )
    print(f"Rejected {rejected_count} mapping/overlay candidate(s)")
    print(f"Deferred mappings: {len(mapping_deferred)}")
    print(f"New human semantic decisions: {evidence.get('newHumanSemanticDecisions')}")
    print(f"Whirlpool isolation: {evidence.get('whirlpoolIsolationVerdict')}")
    print(f"Ledger: {ledger_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
