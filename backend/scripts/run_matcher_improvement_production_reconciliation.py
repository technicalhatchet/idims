#!/usr/bin/env python3
"""Apply manifest-authorized production candidate reconciliation only."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_improvement_production_reconciliation import (
    run_production_reconciliation_gate,
    write_production_reconciliation_artifacts,
)


def main() -> int:
    payload = run_production_reconciliation_gate(apply_mutations=True)
    paths = write_production_reconciliation_artifacts(payload)
    recon = payload["reconciliation"]
    summary = recon.get("summary") or {}
    print(
        json.dumps(
            {
                "status": recon["status"],
                "reconciliationPath": str(paths[0]),
                "auditPath": str(paths[1]),
                "changesetPath": str(paths[2]),
                "summary": summary,
                "errorCount": len(recon.get("errors") or []),
            },
            indent=2,
        ),
    )
    if recon["status"] != "GREEN":
        for error in recon.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("production candidate reconciliation: GREEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
