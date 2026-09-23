#!/usr/bin/env python3
"""Scoped corpus validation for human-approved matcher improvements (read-only)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_improvement_scoped_validation import (
    run_scoped_validation,
    write_scoped_validation,
)


def main() -> int:
    payload = run_scoped_validation()
    validation_path, audit_path = write_scoped_validation(payload)
    validation = payload["validation"]
    aggregate = validation.get("aggregate") or {}
    print(
        json.dumps(
            {
                "status": validation["status"],
                "validationPath": str(validation_path),
                "auditPath": str(audit_path),
                "cohortManuals": validation.get("cohort", {}).get("manualIds"),
                "matcherImprovementCount": aggregate.get("deltas", {}).get("matcherImprovementCount"),
                "unresolvedDelta": aggregate.get("deltas", {}).get("unresolvedCount"),
                "existingCanonicalDelta": aggregate.get("deltas", {}).get("existingCanonicalMappingCount"),
                "frozenHashVerification": validation.get("frozenHashVerification"),
                "productionUnchanged": validation.get("productionIntegrity", {}).get("unchanged"),
                "errorCount": len(validation.get("errors") or []),
            },
            indent=2,
        ),
    )
    if validation["status"] != "GREEN":
        print(f"matcher improvement scoped validation: {validation['status']}", file=sys.stderr)
        for error in validation.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("matcher improvement scoped validation: GREEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
