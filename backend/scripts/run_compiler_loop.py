#!/usr/bin/env python3
"""CG-5.2 — Prove full knowledge compiler loop for W8178558 (CG-3 → CG-5.2 → CG-4 → promote)."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, MANUFACTURER_OVERLAYS_DIR, PROMOTIONS_DIR
from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization
from normalization.promotion.equivalence import compare_promotion_equivalence
from normalization.promotion.planner import find_platform_family, plan_promotion, resolve_overlay_target
from normalization.promotion.publish import apply_promotion_diff, publish_promotion, validate_overlay
from normalization.review.ledger import load_ledger, update_candidate_status
from normalization.review.review_package import materialize_review_package


MANUAL_ID = "W8178558"


def _approve_compiler_candidates(manual_id: str) -> list[str]:
    """Approve mapping/binding candidates suitable for compiler promotion."""
    package = materialize_review_package(manual_id, load_ledger())
    approved: list[str] = []
    for record in package.get("records", []):
        if record.get("status") in {"approved", "promoted"}:
            continue
        level = record.get("approvalLevel")
        ctype = record.get("candidateType")
        if level in {"easy", "normal", "careful"} and ctype in {
            "canonicalMapping",
            "procedureTestBinding",
            "measurementBinding",
        }:
            cid = record.get("candidateId")
            if not cid:
                continue
            update_candidate_status(cid, "approved", reviewer="compiler_loop", manual_id=manual_id)
            approved.append(cid)
    materialize_review_package(manual_id, load_ledger())
    return approved


def run_compiler_loop(
    manual_id: str = MANUAL_ID,
    publish: bool = False,
    *,
    auto_approve: bool = True,
) -> dict:
    manifest = load_manifest()
    entry = find_manual_entry(manifest, manual_id)
    target = resolve_overlay_target(manual_id, entry.get("platformId"))

    print(f"==> CG-3 normalize {manual_id}")
    run_manual_normalization(entry)

    print("==> CG-4 materialize review")
    package = materialize_review_package(manual_id, load_ledger())
    print(f"    {package['summary']['total']} review records")

    approved_ids: list[str] = []
    if auto_approve:
        print("==> CG-4 approve compiler-suitable candidates")
        approved_ids = _approve_compiler_candidates(manual_id)
        print(f"    approved {len(approved_ids)} candidates")
    else:
        print("==> CG-4 skip auto-approve (compounding measurement mode)")

    print("==> CG-4 plan promotion")
    plan = plan_promotion(manual_id)
    if plan.get("blocked"):
        raise RuntimeError(f"Promotion blocked: {plan.get('blockReasons')}")

    overlay_path = MANUFACTURER_OVERLAYS_DIR / target["overlayFile"]
    reference_overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
    reference_family = find_platform_family(reference_overlay, target["platformFamilyId"])

    simulated_overlay = apply_promotion_diff(
        json.loads(json.dumps(reference_overlay)),
        target["platformFamilyId"],
        plan.get("diff") or {},
    )
    generated_family = find_platform_family(simulated_overlay, target["platformFamilyId"])

    print("==> promotion_equivalence (pre-publish)")
    equivalence = compare_promotion_equivalence(
        reference_family,
        generated_family,
        manual_id=manual_id,
    )
    equivalence["promotionId"] = plan.get("promotionId")
    equivalence["approvedCandidateCount"] = len(approved_ids)

    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    equiv_path = CALIBRATION_DIR / f"promotion_equivalence_{manual_id}.json"
    equiv_path.write_text(json.dumps(equivalence, indent=2), encoding="utf-8")
    print(f"    equivalent={equivalence['equivalent']} -> {equiv_path}")

    if not equivalence.get("equivalent"):
        raise RuntimeError(
            "Promotion equivalence failed — compiler would alter CG-2 reference behavior. "
            f"Checks: {equivalence.get('checks')}",
        )

    promotion_id = plan["promotionId"]
    if publish:
        print("==> CG-4 publish promotion")
        publish_promotion(promotion_id)
        validate_overlay()
    else:
        print("==> dry-run publish (writing overlay_after to promotion folder only)")
        promo_dir = PROMOTIONS_DIR / promotion_id
        promo_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(overlay_path, promo_dir / "overlay_before.json")
        (promo_dir / "overlay_after.json").write_text(
            json.dumps(simulated_overlay, indent=2),
            encoding="utf-8",
        )

    result = {
        "manualId": manual_id,
        "promotionId": promotion_id,
        "published": publish,
        "equivalence": equivalence,
        "approvedCandidateIds": approved_ids,
    }
    report_path = CALIBRATION_DIR / f"compiler_loop_{manual_id}.json"
    report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"==> compiler loop report -> {report_path}")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manual", default=MANUAL_ID)
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Apply promotion to production overlay (default: dry-run)",
    )
    parser.add_argument(
        "--run-ds7",
        action="store_true",
        help="Run npm test:diagnostic-session after loop",
    )
    parser.add_argument(
        "--no-auto-approve",
        action="store_true",
        help="Do not auto-approve candidates (measure corpus compounding)",
    )
    args = parser.parse_args()

    run_compiler_loop(
        args.manual,
        publish=args.publish,
        auto_approve=not args.no_auto_approve,
    )

    if args.run_ds7:
        print("==> DS-7 / CG-2 regression harness")
        proc = subprocess.run(
            ["npm", "run", "test:diagnostic-session"],
            cwd=ROOT / "frontend",
            check=False,
            shell=sys.platform == "win32",
        )
        if proc.returncode != 0:
            return proc.returncode

    print("\nCompiler loop OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
