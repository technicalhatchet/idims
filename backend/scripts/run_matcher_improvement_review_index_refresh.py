#!/usr/bin/env python3
"""Targeted production review-index refresh after matcher-improvement reconciliation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_improvement_review_index_refresh import (
    run_matcher_improvement_review_index_refresh_gate,
    write_matcher_improvement_review_index_refresh_artifacts,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Preflight and analysis only; do not write index")
    args = parser.parse_args()

    payload = run_matcher_improvement_review_index_refresh_gate(apply_mutations=not args.dry_run)
    paths = write_matcher_improvement_review_index_refresh_artifacts(payload)
    refresh = payload["refresh"]
    print(
        json.dumps(
            {
                "status": refresh["status"],
                "dryRun": args.dry_run,
                "refreshPath": str(paths[0]),
                "auditPath": str(paths[1]),
                "changesetPath": str(paths[2]),
                "summary": refresh.get("summary"),
                "historicalDecisionReconciliation": refresh.get("summary", {}).get(
                    "historicalDecisionReconciliation",
                ),
                "errorCount": len(refresh.get("errors") or []),
            },
            indent=2,
        ),
    )
    if refresh["status"] != "GREEN":
        for error in refresh.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("matcher improvement review index refresh: GREEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
