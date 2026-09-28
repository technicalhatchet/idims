#!/usr/bin/env python3
"""Apply and audit human-approved matcher improvement rules (wave1 only)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_improvement_implementation import (
    run_matcher_improvement_implementation_gate,
    write_implementation_audit,
)


def main() -> int:
    audit = run_matcher_improvement_implementation_gate()
    path = write_implementation_audit(audit)
    print(
        json.dumps(
            {
                "status": audit["status"],
                "implementationStatus": audit["implementationStatus"],
                "approvedCount": len(audit["approvedBacklogIdsImplemented"]),
                "deferredUntouched": len(audit["deferredBacklogIdsUntouched"]),
                "rejectedUntouched": len(audit["rejectedBacklogIdsUntouched"]),
                "frozenHashVerification": audit["frozenHashVerification"],
                "ruleRegression": audit["beforeAfter"]["ruleRegression"],
                "auditPath": str(path),
            },
            indent=2,
        ),
    )
    if audit["status"] != "GREEN":
        print(f"matcher improvement implementation: {audit['status']}", file=sys.stderr)
        for error in audit.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("matcher improvement implementation: GREEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
