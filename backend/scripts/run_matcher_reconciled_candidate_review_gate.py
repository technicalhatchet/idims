#!/usr/bin/env python3
"""Preflight and scope definition for matcher-reconciled candidate review (52 records)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_reconciled_candidate_review import (
    review_audit_path,
    review_path,
    run_review_gate,
)


def main() -> int:
    payload = run_review_gate(write_artifacts=True)
    review = payload["review"]
    print(
        json.dumps(
            {
                "status": review["status"],
                "reviewPath": str(review_path()),
                "auditPath": str(review_audit_path()),
                "expectedScope": review["expectedScopeCount"],
                "scopeCount": len(review.get("scopeRecords") or []),
                "errorCount": len(review.get("errors") or []),
            },
            indent=2,
        ),
    )
    if review["status"] != "GREEN":
        for error in review.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("matcher-reconciled candidate review gate: GREEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
