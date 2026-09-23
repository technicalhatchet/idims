#!/usr/bin/env python3
"""Final delta reconciliation report + production reconciliation manifest (read-only on production)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_improvement_delta_reconciliation_final import (
    run_final_delta_reconciliation_report,
    write_final_artifacts,
)


def main() -> int:
    payload = run_final_delta_reconciliation_report()
    final_path, audit_path, manifest_path = write_final_artifacts(payload)
    final = payload["final"]
    totals = final.get("totals") or {}
    print(
        json.dumps(
            {
                "status": final["status"],
                "finalPath": str(final_path),
                "auditPath": str(audit_path),
                "manifestPath": str(manifest_path),
                "totals": totals,
                "historicalConflicts": final.get("historicalDecisionConflicts", {}).get("count"),
                "historicalReconciled": final.get("historicalDecisionConflicts", {}).get(
                    "explicitlyReconciledViaAcceptStaged",
                ),
                "errorCount": len(final.get("errors") or []),
            },
            indent=2,
        ),
    )
    if final["status"] != "GREEN":
        for error in final.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("final delta reconciliation report: GREEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
