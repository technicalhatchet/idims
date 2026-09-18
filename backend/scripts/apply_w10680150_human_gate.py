#!/usr/bin/env python3
"""Apply W10680150 human gate — native cohort only (w10680150-* authoritative)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

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
    / "W10680150_overlay_mapping_table_v1.json"
)
MANUAL_ID = "W10680150"
NATIVE_PREFIX = "w10680150-"
REVIEWER = "human_gate"
SUPPLEMENTAL_REVIEWER = "deferred_supplemental_cohort"


def _is_native_candidate_id(candidate_id: str) -> bool:
    return NATIVE_PREFIX in candidate_id.lower()


def _collect_native_approve_ids(table: dict) -> dict[str, str | None]:
    approved: dict[str, str | None] = {}
    for mapping in table.get("mappings", []):
        if mapping.get("cohort") not in {None, "native"}:
            continue
        action = mapping.get("gateAction")
        if action not in {"approve_auto", "approve_human"}:
            continue
        resolved = mapping.get("candidate")
        for cid in mapping.get("candidateIds") or []:
            if _is_native_candidate_id(cid) or cid.startswith("map-W10680150"):
                approved[cid] = resolved
    return approved


def _collect_native_reject_ids(table: dict) -> set[str]:
    rejected: set[str] = set()
    for entry in table.get("rejectedProceduralTitles") or []:
        if entry.get("cohort") != "native":
            continue
        if entry.get("gateAction") == "reject_alias":
            for cid in entry.get("candidateIds") or []:
                if _is_native_candidate_id(cid) or cid.startswith("map-W10680150"):
                    rejected.add(cid)
    return rejected


def _defer_supplemental_candidates(table: dict) -> int:
    """Leave supplemental cohort untouched in review surface — mark deferred in ledger."""
    deferred = 0
    supplemental_ids: set[str] = set()
    for mapping in table.get("supplementalPlatformMappings") or []:
        for cid in mapping.get("candidateIds") or []:
            supplemental_ids.add(cid)
    for entry in table.get("rejectedProceduralTitles") or []:
        if entry.get("cohort") == "supplemental":
            supplemental_ids.update(entry.get("candidateIds") or [])
    for binding in table.get("supplementalProcedureBindings") or []:
        proc_id = binding.get("procedureId") or ""
        if proc_id:
            supplemental_ids.add(f"overlay-W10680150-{proc_id}")

    for cid in sorted(supplemental_ids):
        if not cid or _is_native_candidate_id(cid):
            continue
        update_candidate_status(
            cid,
            "candidate",
            reviewer=SUPPLEMENTAL_REVIEWER,
            reason="Supplemental whirlpool_ccu_dryer cohort — out of native CG-6.4 metric",
            manual_id=MANUAL_ID,
        )
        deferred += 1
    return deferred


def main() -> int:
    table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
    approve_map = _collect_native_approve_ids(table)
    reject_ids = _collect_native_reject_ids(table)

    overlap = set(approve_map) & reject_ids
    if overlap:
        print(f"Note: canonical approve wins over title reject for {len(overlap)} candidate(s)")
        reject_ids -= overlap

    approved_count = 0
    rejected_count = 0
    for cid, resolved in sorted(approve_map.items()):
        layer = "inherited_corpus"
        for mapping in table.get("mappings", []):
            if cid in (mapping.get("candidateIds") or []):
                layer = mapping.get("layer", layer)
                break
        update_candidate_status(
            cid,
            "approved",
            reviewer=REVIEWER,
            reason=f"W10680150 overlay mapping table v1 ({layer})",
            manual_id=MANUAL_ID,
            resolved_canonical_id=resolved if isinstance(resolved, str) and "->" not in resolved else None,
            resolution_classification="human_gate_approved",
        )
        approved_count += 1

    for cid in sorted(reject_ids):
        update_candidate_status(
            cid,
            "rejected",
            reviewer=REVIEWER,
            reason="TEST title / procedural identifier — bind by procedureId only",
            manual_id=MANUAL_ID,
        )
        rejected_count += 1

    deferred = _defer_supplemental_candidates(table)
    package = materialize_review_package(MANUAL_ID, load_ledger())
    summary = package.get("summary") or {}

    table["status"] = "gate_applied"
    table["gateAppliedAt"] = package.get("materializedAt")
    table["gateSummary"] = {
        "nativeApproved": approved_count,
        "nativeRejected": rejected_count,
        "supplementalDeferred": deferred,
        "authoritativeCohort": table.get("compoundingAccounting", {})
        .get("authoritativeCohort", {})
        .get("label"),
    }
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    print(f"Approved {approved_count} native candidate(s)")
    print(f"Rejected {rejected_count} native procedural title candidate(s)")
    print(f"Deferred {deferred} supplemental candidate(s) (unchanged review surface)")
    print(f"Review package: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
