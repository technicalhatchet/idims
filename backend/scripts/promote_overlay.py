#!/usr/bin/env python3
"""CG-4 — Publish an approved promotion plan to manufacturer overlay (explicit promotion)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.promotion.publish import publish_promotion


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promotion", required=True, help="promotionId from plan_promotion.py")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Publish even when plan is blocked (not recommended)",
    )
    args = parser.parse_args()

    result = publish_promotion(args.promotion, force=args.force)
    print(f"Published {args.promotion} → {result.get('overlayFile')}")
    print(f"Candidates promoted: {len(result.get('approvedCandidateIds') or [])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
