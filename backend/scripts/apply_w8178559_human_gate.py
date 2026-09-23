#!/usr/bin/env python3
"""Apply W8178559 human gate decisions from overlay mapping table v1."""

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
    / "W8178559_overlay_mapping_table_v1.json"
)
MANUAL_ID = "W8178559"
REVIEWER = "human_gate"


def _collect_approve_ids(table: dict) -> dict[str, str | None]:
    """candidateId -> resolvedCanonicalId (optional)."""
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
            reason="W8178559 overlay mapping table v1",
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
            reason="TEST title / procedural identifier — bind by procedureId only",
            manual_id=MANUAL_ID,
        )
        rejected_count += 1

    package = materialize_review_package(MANUAL_ID, load_ledger())
    summary = package.get("summary") or {}
    print(f"Approved {approved_count} candidate(s)")
    print(f"Rejected {rejected_count} procedural title candidate(s)")
    print(f"Review package: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
