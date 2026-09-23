#!/usr/bin/env python3
"""Fail-closed preflight for Wave 2 new platform knowledge human review."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.wave2_new_platform_knowledge import (
    build_wave2_audit,
    run_wave2_preflight,
    write_wave2_audit,
)


def main() -> int:
    preflight = run_wave2_preflight()
    audit = build_wave2_audit(preflight)
    audit_path = write_wave2_audit(audit)

    print(
        json.dumps(
            {
                "passed": preflight["passed"],
                "waveId": preflight["waveId"],
                "candidateCount": preflight["actualCandidateCount"],
                "manualCount": preflight["manualCount"],
                "platformIdCount": preflight["platformIdCount"],
                "frozenHashesValid": preflight["frozenHashesValid"],
                "wave1ClosureIntact": preflight["wave1ClosureIntact"],
                "wave2DecisionCount": preflight["wave2DecisionCount"],
                "auditPath": str(audit_path),
                "status": audit["status"],
            },
            indent=2,
        ),
    )

    if not preflight["passed"]:
        print("wave2 preflight: FAILED", file=sys.stderr)
        for error in preflight["errors"]:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("wave2 preflight: READY_FOR_HUMAN_REVIEW")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
