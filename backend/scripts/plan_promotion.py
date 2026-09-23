#!/usr/bin/env python3
"""CG-4 — Plan deterministic overlay promotion diff from approved candidates."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.promotion.planner import format_promotion_diff, plan_promotion


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manual", required=True)
    args = parser.parse_args()

    plan = plan_promotion(args.manual)
    print(format_promotion_diff(plan))
    print(f"\npromotionId: {plan['promotionId']}")
    if plan.get("blocked"):
        print("status: BLOCKED (resolve conflicts before publish)")
        return 1
    print("status: ready to publish")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
