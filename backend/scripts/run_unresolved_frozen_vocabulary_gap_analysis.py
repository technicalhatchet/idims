#!/usr/bin/env python3
"""Read-only frozen vocabulary / matcher gap analysis for unresolved canonicalMapping records."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.unresolved_frozen_vocabulary_gap_analysis import (
    run_unresolved_frozen_vocabulary_gap_analysis,
    write_unresolved_frozen_vocabulary_gap_analysis,
)


def main() -> int:
    payload = run_unresolved_frozen_vocabulary_gap_analysis()
    analysis_path, audit_path = write_unresolved_frozen_vocabulary_gap_analysis(payload)
    analysis = payload["analysis"]
    audit = payload["audit"]

    print(
        json.dumps(
            {
                "status": analysis["status"],
                "canonicalMappingGapCount": analysis["canonicalMappingGapCount"],
                "procedureTestBindingUnresolvedCount": analysis["procedureTestBindingUnresolvedCount"],
                "analysisCategoryCounts": analysis["analysisCategoryCounts"],
                "existingFrozenMappingMissedCount": analysis["existingFrozenMappingMissedCount"],
                "acceptedSiblingEvidenceCount": analysis["acceptedSiblingEvidenceCount"],
                "integrityPassed": audit["integrityChecks"]["passed"],
                "analysisPath": str(analysis_path),
                "auditPath": str(audit_path),
            },
            indent=2,
        ),
    )

    if audit["status"] != "READ_ONLY_MATCHER_GAP_ANALYSIS_COMPLETE":
        print("matcher gap analysis: BLOCKED", file=sys.stderr)
        for error in audit["errors"]:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("matcher gap analysis: READ_ONLY_MATCHER_GAP_ANALYSIS_COMPLETE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
