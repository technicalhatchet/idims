#!/usr/bin/env python3
"""Read-only matcher improvement review gate preflight (governance only)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_improvement_review import (
    run_matcher_improvement_preflight,
    write_matcher_improvement_review_artifacts,
)


def main() -> int:
    preflight = run_matcher_improvement_preflight()
    review_path, audit_path = write_matcher_improvement_review_artifacts(preflight)

    print(
        json.dumps(
            {
                "passed": preflight["passed"],
                "gateId": preflight["gateId"],
                "reviewItemCount": preflight["actualReviewItemCount"],
                "integrityPassed": preflight["integrityChecks"]["passed"],
                "reviewPath": str(review_path),
                "auditPath": str(audit_path),
                "status": (
                    "READY_FOR_HUMAN_MATCHER_IMPROVEMENT_REVIEW"
                    if preflight["passed"]
                    else "BLOCKED"
                ),
                "warnings": preflight.get("warnings"),
            },
            indent=2,
        ),
    )

    if not preflight["passed"]:
        print("matcher improvement preflight: BLOCKED", file=sys.stderr)
        for error in preflight["errors"]:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("matcher improvement preflight: READY_FOR_HUMAN_MATCHER_IMPROVEMENT_REVIEW")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
