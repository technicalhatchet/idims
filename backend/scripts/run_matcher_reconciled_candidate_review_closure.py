#!/usr/bin/env python3
"""Closure audit for matcher-reconciled candidate review (after human review)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_reconciled_candidate_review import (
    closure_audit_path,
    closure_path,
    run_closure_gate,
)


def main() -> int:
    payload = run_closure_gate(write_artifacts=True)
    closure = payload["closure"]
    print(json.dumps(closure, indent=2))
    if closure["status"] not in {"GREEN", "HOLD"}:
        return 1
    return 0 if closure["status"] == "GREEN" else 2


if __name__ == "__main__":
    raise SystemExit(main())
