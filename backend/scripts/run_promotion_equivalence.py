#!/usr/bin/env python3
"""CG-5.2 — Compare CG-2 reference overlay vs compiler-generated promotion result."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, PROMOTIONS_DIR
from normalization.promotion.equivalence import (
    apply_plan_to_overlay_copy,
    compare_promotion_equivalence,
)
from normalization.promotion.planner import MANUAL_TO_OVERLAY, find_platform_family, load_overlay_file
from normalization.promotion.publish import load_promotion_plan


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--promotion", help="promotionId from plan_promotion.py")
    parser.add_argument("--manual", default="W8178558")
    parser.add_argument(
        "--write-report",
        action="store_true",
        help="Write promotion_equivalence_{manual}.json to calibration/",
    )
    args = parser.parse_args()

    target = MANUAL_TO_OVERLAY.get(args.manual)
    if not target:
        print(f"No overlay target for manual {args.manual}", file=sys.stderr)
        return 1

    if args.promotion:
        plan = load_promotion_plan(args.promotion)
    else:
        plans = sorted(PROMOTIONS_DIR.glob(f"promo-{args.manual}-*.json"))
        if not plans:
            print(f"No promotion plan found for {args.manual}", file=sys.stderr)
            return 1
        plan = json.loads(plans[-1].read_text(encoding="utf-8"))

    reference_overlay = load_overlay_file(target["overlayFile"])
    reference_family = find_platform_family(reference_overlay, target["platformFamilyId"])
    if not reference_family:
        print("Reference platform family not found", file=sys.stderr)
        return 1

    generated_overlay = apply_plan_to_overlay_copy(
        target["overlayFile"],
        target["platformFamilyId"],
        plan,
    )
    generated_family = find_platform_family(generated_overlay, target["platformFamilyId"])

    report = compare_promotion_equivalence(
        reference_family,
        generated_family,
        manual_id=args.manual,
    )
    report["promotionId"] = plan.get("promotionId")
    report["overlayFile"] = target["overlayFile"]
    report["platformFamilyId"] = target["platformFamilyId"]

    print("=== Promotion Equivalence ===")
    print(f"Manual:      {args.manual}")
    print(f"Promotion:   {plan.get('promotionId')}")
    print(f"Equivalent:  {report['equivalent']}")
    for key, value in (report.get("checks") or {}).items():
        print(f"  {key}: {'OK' if value else 'FAIL'}")

    alias = report.get("aliasComparison") or {}
    if alias.get("mismatches"):
        print("\nAlias mismatches:")
        for item in alias["mismatches"][:10]:
            print(f"  {item['term']}: ref={item['reference']} gen={item['generated']}")

    if args.write_report:
        CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
        out_path = CALIBRATION_DIR / f"promotion_equivalence_{args.manual}.json"
        out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nWrote {out_path}")

    return 0 if report.get("equivalent") else 1


if __name__ == "__main__":
    raise SystemExit(main())
