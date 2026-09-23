#!/usr/bin/env python3
"""Read-only unresolved candidate pool governance analysis."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.unresolved_pool_analysis import (
    run_unresolved_pool_analysis,
    write_unresolved_pool_analysis,
)


def main() -> int:
    payload = run_unresolved_pool_analysis()
    analysis_path, audit_path = write_unresolved_pool_analysis(payload)
    analysis = payload["analysis"]
    audit = payload["audit"]

    print(
        json.dumps(
            {
                "status": analysis["status"],
                "totalUnresolvedCount": analysis["totalUnresolvedCount"],
                "manualCount": analysis["manualCount"],
                "platformIdCount": analysis["platformIdCount"],
                "topPatternCount": len(analysis["topRepeatedPatterns"]),
                "integrityPassed": audit["integrityChecks"]["passed"],
                "analysisPath": str(analysis_path),
                "auditPath": str(audit_path),
            },
            indent=2,
        ),
    )

    if audit["status"] != "READ_ONLY_ANALYSIS_COMPLETE":
        print("unresolved pool analysis: BLOCKED", file=sys.stderr)
        for error in audit["errors"]:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("unresolved pool analysis: READ_ONLY_ANALYSIS_COMPLETE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
