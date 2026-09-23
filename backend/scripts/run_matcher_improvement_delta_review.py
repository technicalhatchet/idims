#!/usr/bin/env python3
"""Targeted delta review: staging vs production baseline (read-only, no promotion)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_improvement_delta_review import (
    run_delta_review_gate,
    write_delta_review,
)


def main() -> int:
    payload = run_delta_review_gate()
    review_path, audit_path = write_delta_review(payload)
    review = payload["review"]
    counts = review.get("counts") or {}
    print(
        json.dumps(
            {
                "status": review["status"],
                "reviewPath": str(review_path),
                "auditPath": str(audit_path),
                "allDeltas": counts.get("allDeltas"),
                "matcherImprovementMappings": counts.get("matcherImprovementMappings"),
                "nonAuthorizedProposedChanges": counts.get("nonAuthorizedProposedChanges"),
                "addedToUnresolved": counts.get("addedToUnresolved"),
                "removedFromUnresolved": counts.get("removedFromUnresolved"),
                "reconciliation": review.get("reconciliation", {}).get("arithmetic"),
                "holdReasons": review.get("holdReasons"),
                "errorCount": len(review.get("errors") or []),
            },
            indent=2,
        ),
    )
    if not review["status"].startswith("GREEN"):
        print(f"delta review gate: {review['status']}", file=sys.stderr)
        for error in review.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        for reason in review.get("holdReasons") or []:
            print(f"  - hold: {reason}", file=sys.stderr)
        return 1
    print("delta review gate: GREEN — DELTA REVIEW READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
