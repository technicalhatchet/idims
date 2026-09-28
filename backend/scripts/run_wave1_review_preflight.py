#!/usr/bin/env python3
"""Fail-closed preflight for Wave 1 existing canonical mapping human review."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.wave1_existing_canonical_mapping import (
    build_wave1_audit,
    run_wave1_preflight,
    write_wave1_audit,
)


def main() -> int:
    preflight = run_wave1_preflight()
    audit = build_wave1_audit(preflight)
    audit_path = write_wave1_audit(audit)

    print(json.dumps(
        {
            "passed": preflight["passed"],
            "waveId": preflight["waveId"],
            "candidateCount": preflight["actualCandidateCount"],
            "manualCount": preflight["manualCount"],
            "canonicalIdCount": preflight["canonicalIdCount"],
            "auditPath": str(audit_path),
            "status": audit["status"],
        },
        indent=2,
    ))

    if not preflight["passed"]:
        print("wave1 preflight: FAILED", file=sys.stderr)
        for error in preflight["errors"]:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("wave1 preflight: READY_FOR_HUMAN_REVIEW")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
