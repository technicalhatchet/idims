#!/usr/bin/env python3
"""Refresh delta reconciliation tallies from human decision store (read-only on production)."""

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
    payload = run_delta_reconciliation_gate(initialize_decisions=False)
    write_delta_reconciliation_artifacts(payload)
    recon = payload["reconciliation"]
    print(json.dumps(recon.get("reconciliation") or {}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
