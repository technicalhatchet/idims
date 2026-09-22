#!/usr/bin/env python3
"""Preflight (default) or authorized apply for matcher-reconciled candidate production stamp."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_reconciled_candidate_production_apply import (
    apply_audit_path,
    apply_path,
    lock_path,
    run_production_apply_gate,
    write_production_apply_artifacts,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute production candidate stamp mutations (requires --authorize)",
    )
    parser.add_argument(
        "--authorize",
        action="store_true",
        help="Grant apply authorization for this run only",
    )
    args = parser.parse_args()

    payload = run_production_apply_gate(
        apply_mutations=args.apply,
        apply_authorization_granted=args.authorize and args.apply,
    )
    paths = write_production_apply_artifacts(payload)
    apply_report = payload["apply"]
    lock = payload["lock"]
    print(
        json.dumps(
            {
                "status": apply_report["status"],
                "applyState": apply_report.get("applyState"),
                "applyPath": str(paths[0]),
                "auditPath": str(paths[1]),
                "lockPath": str(paths[2]),
                "applyAuthorizationGranted": lock.get("applyAuthorizationGranted"),
                "productionMutationsExecuted": lock.get("productionMutationsExecuted"),
                "summary": apply_report.get("summary"),
                "errorCount": len(apply_report.get("errors") or []),
            },
            indent=2,
        ),
    )
    if apply_report["status"] != "GREEN":
        for error in apply_report.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        return 1
    if not args.apply:
        print("matcher-reconciled production apply: GREEN (preflight only; no production mutation)")
    else:
        print("matcher-reconciled production apply: GREEN (mutations executed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
