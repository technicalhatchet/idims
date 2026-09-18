#!/usr/bin/env python3
"""Apply W11499711 mechanical-only gate — overlay registration under published SSM (no publish)."""

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
    / "W11499711_overlay_mapping_table_v1.json"
)
MANUAL_ID = "W11499711"
REVIEWER = "mechanical_gate"
NATIVE_PROCEDURE_PREFIX = "w11499711-"


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
            if target:
                index[f"procedure:{proc_id}:{target}"] = candidate_id
                index[f"procedure:{proc_id}"] = candidate_id
        if candidate.get("candidateType") == "measurementBinding":
            knowledge_id = candidate.get("measurementKnowledgeId")
            if knowledge_id:
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
        if binding.get("gateAction") != "approve_mechanical":
            continue
        procedure_id = binding.get("procedureId")
        if procedure_id and not str(procedure_id).startswith(NATIVE_PROCEDURE_PREFIX):
            raise ValueError(f"Non-native procedure blocked at mechanical gate: {procedure_id}")
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
                reason="W11499711 mechanical overlay registration (published SSM semantics)",
                manual_id=manual_id,
                resolved_test_target_id=test_target_id,
                resolution_classification="mechanical_gate_approved",
            )
            approved += 1
    return approved


def main() -> int:
    table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
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

    deferred_mappings = [
        m for m in table.get("mappings") or [] if m.get("gateAction") == "defer_provenance"
    ]
    if len(deferred_mappings) != 2:
        print("WARN: expected 2 provenance-only mapping deferrals", file=sys.stderr)

    package = materialize_review_package(MANUAL_ID, load_ledger())
    records = package.get("records") or []
    approved_mappings = [
        r for r in records if r.get("candidateType") == "canonicalMapping" and r.get("status") == "approved"
    ]
    approved_procedures = [
        r for r in records if r.get("candidateType") == "procedureTestBinding" and r.get("status") == "approved"
    ]
    approved_measurements = [
        r for r in records if r.get("candidateType") == "measurementBinding" and r.get("status") == "approved"
    ]

    if approved_mappings:
        print(f"FAIL: {len(approved_mappings)} mapping(s) approved — mechanical gate forbids alias promotion")
        return 1
    if len(approved_procedures) != 1 or len(approved_measurements) != 1:
        print(
            f"FAIL: expected 1 procedure + 1 measurement binding, got "
            f"{len(approved_procedures)} / {len(approved_measurements)}",
            file=sys.stderr,
        )
        return 1

    gate_summary = table.get("gateSummary") or {}
    evidence = table.get("compoundingEvidence") or {}
    gate_summary["procedureBindingsApproved"] = len(approved_procedures)
    gate_summary["measurementBindingsApproved"] = len(approved_measurements)
    gate_summary["mappingApprovals"] = 0
    gate_summary["gatedAt"] = datetime.now(timezone.utc).isoformat()
    table["gateSummary"] = gate_summary
    table["status"] = "gated"
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    ledger_out = ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
    ledger_report = {
        "manualId": MANUAL_ID,
        "gateKind": "mechanical_only",
        "priorManualIds": evidence.get("priorManualIds"),
        "gatedAt": gate_summary["gatedAt"],
        "procedureBindingsApproved": len(approved_procedures),
        "measurementBindingsApproved": len(approved_measurements),
        "mappingApprovals": 0,
        "mappingDeferredProvenanceOnly": len(deferred_mappings),
        "newHumanSemanticDecisions": 0,
        "mechanicalRegistrations": evidence.get("mechanicalRegistrations"),
        "inheritanceValidation": evidence.get("inheritanceValidation"),
        "documentation": evidence.get("documentation"),
        "publishBlocked": True,
    }
    (ledger_out / "W11499711_gate_decision_ledger_v1.json").write_text(
        json.dumps(ledger_report, indent=2),
        encoding="utf-8",
    )

    print(f"Mechanical gate: {procedure_approved} procedure + {measurement_approved} measurement binding(s)")
    print(f"Mapping approvals: 0 (provenance-only deferrals: {len(deferred_mappings)})")
    print(f"New human semantic decisions: 0")
    print(f"Inheritance validation: {evidence.get('inheritanceValidation')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
