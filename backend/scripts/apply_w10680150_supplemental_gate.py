#!/usr/bin/env python3
"""Apply W10680150 supplemental cohort gate (w10881701-* / shared platform deltas)."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
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
REVIEWER = "human_gate_supplemental"


def _is_supplemental_candidate_id(candidate_id: str) -> bool:
    cid = candidate_id.lower()
    if NATIVE_PREFIX in cid:
        return False
    return "w10881701" in cid or "w11169659" in cid or cid.startswith("map-w10680150-")


def _collect_supplemental_approve_ids(table: dict) -> dict[str, str | None]:
    approved: dict[str, str | None] = {}
    for mapping in table.get("supplementalPlatformMappings") or []:
        action = mapping.get("gateAction")
        if action not in {"approve_auto", "approve_human"}:
            continue
        resolved = mapping.get("candidate")
        for cid in mapping.get("candidateIds") or []:
            approved[cid] = resolved
    return approved


def _collect_supplemental_reject_ids(table: dict) -> set[str]:
    rejected: set[str] = set()
    for entry in table.get("rejectedProceduralTitles") or []:
        if entry.get("cohort") != "supplemental":
            continue
        if entry.get("gateAction") == "reject_alias":
            rejected.update(entry.get("candidateIds") or [])
    return rejected


def main() -> int:
    table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
    approve_map = _collect_supplemental_approve_ids(table)
    reject_ids = _collect_supplemental_reject_ids(table)

    overlap = set(approve_map) & reject_ids
    if overlap:
        print(f"Note: supplemental approve wins over title reject for {len(overlap)} candidate(s)")
        reject_ids -= overlap

    approved_count = 0
    rejected_count = 0
    for cid, resolved in sorted(approve_map.items()):
        layer = "supplemental_platform"
        for mapping in table.get("supplementalPlatformMappings") or []:
            if cid in (mapping.get("candidateIds") or []):
                layer = mapping.get("layer", layer)
                break
        update_candidate_status(
            cid,
            "approved",
            reviewer=REVIEWER,
            reason=f"W10680150 supplemental cohort ({layer})",
            manual_id=MANUAL_ID,
            resolved_canonical_id=resolved if isinstance(resolved, str) and "->" not in resolved else None,
            resolution_classification="human_gate_supplemental_approved",
        )
        approved_count += 1

    for cid in sorted(reject_ids):
        update_candidate_status(
            cid,
            "rejected",
            reviewer=REVIEWER,
            reason="Supplemental TEST title — bind by procedureId only",
            manual_id=MANUAL_ID,
        )
        rejected_count += 1

    package = materialize_review_package(MANUAL_ID, load_ledger())
    summary = package.get("summary") or {}

    gate_summary = table.get("gateSummary") or {}
    gate_summary["supplementalApproved"] = approved_count
    gate_summary["supplementalRejected"] = rejected_count
    gate_summary["supplementalGatedAt"] = datetime.now(timezone.utc).isoformat()
    table["gateSummary"] = gate_summary
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    print(f"Approved {approved_count} supplemental candidate(s)")
    print(f"Rejected {rejected_count} supplemental procedural title candidate(s)")
    print(f"Review package: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
