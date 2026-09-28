#!/usr/bin/env python3
"""Apply W11480208 human gate from overlay mapping table v1 (compounding, no publish)."""

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
    / "W11480208_overlay_mapping_table_v1.json"
)
MANUAL_ID = "W11480208"
REVIEWER = "human_gate"


def _collect_approve_ids(table: dict) -> dict[str, str | None]:
    approved: dict[str, str | None] = {}
    for mapping in table.get("mappings", []):
        action = mapping.get("gateAction")
        if action not in {"approve_auto", "approve_human"}:
            continue
        resolved = mapping.get("candidate")
        for cid in mapping.get("candidateIds") or []:
            approved[cid] = resolved
    return approved


def _collect_reject_ids(table: dict) -> set[str]:
    rejected: set[str] = set()
    for entry in table.get("rejectedProceduralTitles") or []:
        if entry.get("gateAction") == "reject_alias":
            rejected.update(entry.get("candidateIds") or [])
    for entry in table.get("rejectedOverlayBindings") or []:
        if entry.get("gateAction") == "reject_binding":
            rejected.update(entry.get("candidateIds") or [])
    return rejected


def _load_overlay_candidate_index(manual_id: str) -> dict[str, str]:
    overlay_path = CANDIDATES_DIR / manual_id / "overlay_candidates.json"
    candidates = json.loads(overlay_path.read_text(encoding="utf-8")).get("candidates", [])
    index: dict[str, str] = {}
    for candidate in candidates:
        candidate_id = candidate.get("id")
        if not candidate_id:
            continue
        if candidate.get("candidateType") == "procedureTestBinding":
            proc_id = candidate.get("procedureId")
            target = candidate.get("canonicalTestTarget")
            if proc_id and target:
                index[f"procedure:{proc_id}:{target}"] = candidate_id
                index[f"procedure:{proc_id}"] = candidate_id
        if candidate.get("candidateType") == "measurementBinding":
            proc_id = candidate.get("procedureId")
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
                reason="W11480208 overlay mapping table v1",
                manual_id=manual_id,
                resolved_test_target_id=test_target_id,
                resolution_classification="human_gate_approved",
            )
            approved += 1
    return approved


def main() -> int:
    table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
    approve_map = _collect_approve_ids(table)
    reject_ids = _collect_reject_ids(table)

    overlap = set(approve_map) & reject_ids
    if overlap:
        print(f"Note: canonical approve wins over reject for {len(overlap)} candidate(s)")
        reject_ids -= overlap

    approved_count = 0
    rejected_count = 0
    for cid, resolved in sorted(approve_map.items()):
        layer = "canonical_reuse"
        for mapping in table.get("mappings", []):
            if cid in (mapping.get("candidateIds") or []):
                layer = mapping.get("layer", layer)
                break
        update_candidate_status(
            cid,
            "approved",
            reviewer=REVIEWER,
            reason=f"W11480208 overlay mapping table v1 ({layer})",
            manual_id=MANUAL_ID,
            resolved_canonical_id=resolved if isinstance(resolved, str) else None,
            resolution_classification="human_gate_approved",
        )
        approved_count += 1

    for cid in sorted(reject_ids):
        update_candidate_status(
            cid,
            "rejected",
            reviewer=REVIEWER,
            reason="W11480208 gate — procedural title, model surface, or bad overlay binding",
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
    summary = package.get("summary") or {}

    gate_summary = table.get("gateSummary") or {}
    evidence = table.get("compoundingEvidence") or {}
    gate_summary["approved"] = approved_count
    gate_summary["rejected"] = rejected_count
    gate_summary["deferred"] = len(table.get("deferredMappings") or [])
    approved_procedures = sum(
        1
        for r in package.get("records") or []
        if r.get("candidateType") == "procedureTestBinding" and r.get("status") == "approved"
    )
    approved_measurements = sum(
        1
        for r in package.get("records") or []
        if r.get("candidateType") == "measurementBinding" and r.get("status") == "approved"
    )
    gate_summary["procedureBindingsApproved"] = approved_procedures
    gate_summary["measurementBindingsApproved"] = approved_measurements
    gate_summary["overlayBindingsRejected"] = len(table.get("rejectedOverlayBindings") or [])
    gate_summary["gatedAt"] = datetime.now(timezone.utc).isoformat()
    table["gateSummary"] = gate_summary
    table["status"] = "gated"
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    ledger_out = ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
    ledger_report = {
        "manualId": MANUAL_ID,
        "priorManualId": evidence.get("priorManualId"),
        "gatedAt": gate_summary["gatedAt"],
        "mappingApprovals": approved_count,
        "mappingRejections": rejected_count,
        "mappingDeferred": gate_summary["deferred"],
        "procedureBindingsApproved": approved_procedures,
        "measurementBindingsApproved": approved_measurements,
        "overlayBindingsRejected": gate_summary["overlayBindingsRejected"],
        "newHumanSemanticDecisions": evidence.get("newHumanSemanticDecisions"),
        "inheritedReuseAtGate": evidence.get("inheritedReuseAtGate"),
        "inheritedWhirlpoolDishwasherAliases": evidence.get("inheritedWhirlpoolDishwasherAliases"),
        "newPlatformKnowledge": evidence.get("newPlatformKnowledge"),
        "newModelSpecificKnowledge": evidence.get("newModelSpecificKnowledge"),
        "inheritedMatcherCorrections": evidence.get("inheritedMatcherCorrections"),
        "newCanonicalConcepts": evidence.get("newCanonicalConcepts"),
        "teachingCostComparison": table.get("compoundingAccounting", {}).get("teachingCostCurve"),
        "reviewPackageSummary": summary,
        "publishBlocked": True,
    }
    ledger_out.mkdir(parents=True, exist_ok=True)
    (ledger_out / "W11480208_gate_decision_ledger_v1.json").write_text(
        json.dumps(ledger_report, indent=2),
        encoding="utf-8",
    )

    print(f"Approved {approved_count} mapping candidate(s)")
    print(f"Approved {approved_procedures} procedure binding candidate(s)")
    print(f"Approved {approved_measurements} measurement binding candidate(s)")
    print(f"Rejected {rejected_count} mapping/overlay candidate(s)")
    print(f"Deferred: {gate_summary['deferred']} (documented in table — not ledger-approved)")
    print(f"New human semantic decisions: {evidence.get('newHumanSemanticDecisions')} (baseline W11633848: 11)")
    print(f"Inherited reuse at gate: {evidence.get('inheritedReuseAtGate')}")
    print(f"New platform knowledge: {evidence.get('newPlatformKnowledge')}")
    print(f"New canonical concepts: {evidence.get('newCanonicalConcepts')}")
    print(f"Review package: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
