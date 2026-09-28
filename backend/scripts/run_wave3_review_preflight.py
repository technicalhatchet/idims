#!/usr/bin/env python3
"""Read-only Wave 3 human-review preflight (governance gate)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.wave3_new_canonical_knowledge import (
    build_wave3_audit,
    run_wave3_preflight,
    write_wave3_audit,
)


def main() -> int:
    preflight = run_wave3_preflight()
    audit = build_wave3_audit(preflight)
    audit_path = write_wave3_audit(audit)

    print(
        json.dumps(
            {
                "passed": preflight["passed"],
                "waveId": preflight["waveId"],
                "candidateCount": preflight["actualCandidateCount"],
                "expectedCandidateCount": preflight["expectedCandidateCount"],
                "manualCount": preflight["manualCount"],
                "platformIdCount": preflight["platformIdCount"],
                "frozenHashesValid": preflight["frozenHashesValid"],
                "wave1ClosureIntact": preflight["wave1ClosureIntact"],
                "wave2ClosureIntact": preflight["wave2ClosureIntact"],
                "wave3DecisionCount": preflight["wave3DecisionCount"],
                "auditPath": str(audit_path),
                "status": audit["status"],
                "warnings": preflight.get("warnings"),
            },
            indent=2,
        ),
    )

    if not preflight["passed"]:
        print("wave3 preflight: BLOCKED", file=sys.stderr)
        for error in preflight["errors"]:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("wave3 preflight: READY_FOR_HUMAN_REVIEW")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
