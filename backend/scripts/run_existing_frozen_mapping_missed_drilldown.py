#!/usr/bin/env python3
"""Read-only drill-down of EXISTING_FROZEN_MAPPING_MISSED unresolved records."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.existing_frozen_mapping_missed_drilldown import (
    run_existing_frozen_mapping_missed_drilldown,
    write_existing_frozen_mapping_missed_drilldown,
)


def main() -> int:
    payload = run_existing_frozen_mapping_missed_drilldown()
    drilldown_path, audit_path = write_existing_frozen_mapping_missed_drilldown(payload)
    drilldown = payload["drilldown"]
    audit = payload["audit"]

    print(
        json.dumps(
            {
                "status": drilldown["status"],
                "analyzedRecordCount": drilldown["analyzedRecordCount"],
                "matchingFailureModeCounts": drilldown["matchingFailureModeCounts"],
                "backlogItemCount": drilldown["backlogItemCount"],
                "smallestSafeBacklogItemCount": drilldown["executiveAnswers"]["smallestSafeBacklogItemCount"],
                "integrityPassed": audit["integrityChecks"]["passed"],
                "drilldownPath": str(drilldown_path),
                "auditPath": str(audit_path),
            },
            indent=2,
        ),
    )

    if audit["status"] != "READ_ONLY_FROZEN_MAPPING_MISSED_DRILLDOWN_COMPLETE":
        print("frozen mapping missed drilldown: BLOCKED", file=sys.stderr)
        for error in audit["errors"]:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("frozen mapping missed drilldown: READ_ONLY_FROZEN_MAPPING_MISSED_DRILLDOWN_COMPLETE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
