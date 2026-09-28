#!/usr/bin/env python3
"""Human delta reconciliation preflight — builds queue, does not swap production."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_improvement_delta_reconciliation import (
    run_delta_reconciliation_gate,
    write_delta_reconciliation_artifacts,
)


def main() -> int:
    payload = run_delta_reconciliation_gate(initialize_decisions=True)
    queue_path, recon_path, audit_path = write_delta_reconciliation_artifacts(payload)
    recon = payload["reconciliation"]
    print(
        json.dumps(
            {
                "status": recon["status"],
                "queuePath": str(queue_path),
                "reconciliationPath": str(recon_path),
                "auditPath": str(audit_path),
                "populationA": recon["populationSummary"]["populationA"],
                "populationBUnique": recon["populationSummary"]["populationBUnique"],
                "errorCount": len(recon.get("errors") or []),
            },
            indent=2,
        ),
    )
    if not recon["status"].startswith("GREEN"):
        for error in recon.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("delta reconciliation preflight: GREEN — DELTA RECONCILIATION READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
