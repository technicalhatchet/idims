#!/usr/bin/env python3
"""Read-only Wave 1 human-review closure audit (governance gate)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.wave1_closure_audit import (
    run_wave1_closure_audit,
    update_wave_preflight_audit_status,
    write_closure_audit,
    write_closure_summary,
)


def main() -> int:
    audit = run_wave1_closure_audit()
    audit_path = write_closure_audit(audit)
    summary_path = write_closure_summary(audit)
    if audit["status"] == "WAVE1_CLOSED":
        update_wave_preflight_audit_status("WAVE1_CLOSED")

    print(
        json.dumps(
            {
                "status": audit["status"],
                "reviewedCount": audit["reviewedCount"],
                "acceptedCount": audit["acceptedCount"],
                "deferredCount": audit["deferredCount"],
                "rejectedCount": audit["rejectedCount"],
                "deferredPatternGroupCount": audit["deferredPatternAnalysis"]["patternGroupCount"],
                "auditPath": str(audit_path),
                "summaryPath": str(summary_path),
                "errors": audit["errors"],
            },
            indent=2,
        ),
    )

    if audit["status"] != "WAVE1_CLOSED":
        print("wave1 closure audit: BLOCKED", file=sys.stderr)
        for error in audit["errors"]:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("wave1 closure audit: WAVE1_CLOSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
