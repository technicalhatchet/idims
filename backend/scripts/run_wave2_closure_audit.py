#!/usr/bin/env python3
"""Read-only Wave 2 human-review closure audit (governance gate)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.wave2_closure_audit import (
    run_wave2_closure_audit,
    update_wave2_preflight_audit_status,
    write_closure_audit,
)


def main() -> int:
    audit = run_wave2_closure_audit()
    audit_path = write_closure_audit(audit)
    if audit["status"] == "WAVE2_CLOSED":
        update_wave2_preflight_audit_status("WAVE2_CLOSED")

    print(
        json.dumps(
            {
                "status": audit["status"],
                "expectedCandidateCount": audit["expectedCandidateCount"],
                "reviewedCandidateCount": audit["reviewedCandidateCount"],
                "acceptedCount": audit["acceptedCount"],
                "rejectedCount": audit["rejectedCount"],
                "deferredCount": audit["deferredCount"],
                "missingDecisionCount": audit["missingDecisionCount"],
                "duplicateDecisionCount": audit["duplicateDecisionCount"],
                "outOfWaveDecisionCount": audit["outOfWaveDecisionCount"],
                "canonicalMutationDetected": audit["canonicalMutationDetected"],
                "candidateMutationDetected": audit["candidateMutationDetected"],
                "promotionPerformed": audit["promotionPerformed"],
                "wave1Integrity": audit["wave1Integrity"]["passed"],
                "frozenHashesValid": audit["frozenHashValidation"]["passed"],
                "auditPath": str(audit_path),
                "errors": audit["errors"],
            },
            indent=2,
        ),
    )

    if audit["status"] != "WAVE2_CLOSED":
        print("wave2 closure audit: BLOCKED", file=sys.stderr)
        for error in audit["errors"]:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("wave2 closure audit: WAVE2_CLOSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
