#!/usr/bin/env python3
"""Apply W11633848 human gate from overlay mapping table v1."""

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
    / "W11633848_overlay_mapping_table_v1.json"
)
MANUAL_ID = "W11633848"
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
                reason="W11633848 overlay mapping table v1",
                manual_id=manual_id,
                resolved_test_target_id=test_target_id,
                resolution_classification="human_gate_approved",
            )
            approved += 1
    return approved


def _collect_reject_ids(table: dict) -> set[str]:
    rejected: set[str] = set()
    for entry in table.get("rejectedProceduralTitles") or []:
        if entry.get("gateAction") == "reject_alias":
            rejected.update(entry.get("candidateIds") or [])
    return rejected


def main() -> int:
    table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
    approve_map = _collect_approve_ids(table)
    reject_ids = _collect_reject_ids(table)

    overlap = set(approve_map) & reject_ids
    if overlap:
        print(f"Note: canonical approve wins over title reject for {len(overlap)} candidate(s)")
        reject_ids -= overlap

    approved_count = 0
    rejected_count = 0
    for cid, resolved in sorted(approve_map.items()):
        update_candidate_status(
            cid,
            "approved",
            reviewer=REVIEWER,
            reason="W11633848 overlay mapping table v1",
            manual_id=MANUAL_ID,
            resolved_canonical_id=resolved,
            resolution_classification="human_gate_approved",
        )
        approved_count += 1

    for cid in sorted(reject_ids):
        update_candidate_status(
            cid,
            "rejected",
            reviewer=REVIEWER,
            reason="§3 procedural title or ambiguous token — bind by procedureId only",
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
    gate_summary["approved"] = approved_count
    gate_summary["rejected"] = rejected_count
    gate_summary["procedureBindingsApproved"] = procedure_approved
    gate_summary["measurementBindingsApproved"] = measurement_approved
    gate_summary["gatedAt"] = datetime.now(timezone.utc).isoformat()
    table["gateSummary"] = gate_summary
    table["status"] = "gated"
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    evidence = table.get("compoundingEvidence") or {}
    print(f"Approved {approved_count} mapping candidate(s)")
    print(f"Approved {procedure_approved} procedure binding candidate(s)")
    print(f"Approved {measurement_approved} measurement binding candidate(s)")
    print(f"Rejected {rejected_count} procedural/ambiguous candidate(s)")
    print(f"Deferred platform/model: {len(table.get('deferredMappings') or [])} (documented in table — not ledger-approved)")
    print(f"New human semantic decisions: {evidence.get('newHumanSemanticDecisions')}")
    print(f"New canonical concepts: {evidence.get('newCanonicalConcepts')}")
    print(f"Review package: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
