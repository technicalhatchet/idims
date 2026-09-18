#!/usr/bin/env python3
"""Apply SAMSUNG-FL-DV6000-DRYER human gate from overlay mapping table v1."""

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
    / "SAMSUNG_FL_DV6000_DRYER_overlay_mapping_table_v1.json"
)
MANUAL_ID = "SAMSUNG-FL-DV6000-DRYER"
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
            reason="SAMSUNG-FL-DV6000-DRYER overlay mapping table v1",
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
            reason="§4-1 / §4-6 procedure title — bind by procedureId only",
            manual_id=MANUAL_ID,
        )
        rejected_count += 1

    package = materialize_review_package(MANUAL_ID, load_ledger())
    summary = package.get("summary") or {}

    gate_summary = table.get("gateSummary") or {}
    gate_summary["approved"] = approved_count
    gate_summary["rejected"] = rejected_count
    gate_summary["gatedAt"] = datetime.now(timezone.utc).isoformat()
    table["gateSummary"] = gate_summary
    table["status"] = "gated"
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    evidence = table.get("compoundingEvidence") or {}
    print(f"Approved {approved_count} candidate(s)")
    print(f"Rejected {rejected_count} procedural title candidate(s)")
    print(
        f"Compounding: {evidence.get('reaffirmedInheritedDecisions', '?')} inherited, "
        f"{evidence.get('genuinelyNewHumanDecisions', '?')} genuinely new"
    )
    print(f"Review package: {summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
