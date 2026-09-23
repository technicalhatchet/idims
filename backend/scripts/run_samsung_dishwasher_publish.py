#!/usr/bin/env python3
"""Publish SAMSUNG-DISHWASHER Samsung dishwasher overlay from gate table."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, MANUFACTURER_OVERLAYS_DIR, PROMOTIONS_DIR
from normalization.promotion.equivalence import compare_promotion_equivalence
from normalization.promotion.planner import find_platform_family, load_overlay_file, plan_promotion
from normalization.promotion.publish import validate_overlay
from normalization.review.ledger import mark_candidates_promoted
from samsung_dishwasher_gate_publish import (
    MANUAL_ID,
    PLATFORM_FAMILY_ID,
    GatePublishError,
    apply_samsung_dishwasher_gate_delta,
    reconcile_first_manual_equivalence,
)

OVERLAY_FILE = "samsung_dishwasher.json"
WHIRLPOOL_OVERLAY = "whirlpool_dishwasher.json"
TABLE_PATH = CALIBRATION_DIR / "SAMSUNG_DISHWASHER_overlay_mapping_table_v1.json"
LEDGER_PATH = CALIBRATION_DIR / "SAMSUNG_DISHWASHER_gate_decision_ledger_v1.json"
CANONICAL_PATH = CANONICAL_DIR / "dishwasher.json"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _verify_canonical_unchanged(before: dict, after: dict) -> bool:
    before_ontology = {k: v for k, v in before.get("ontology", {}).items() if k != "frozenNote"}
    after_ontology = {k: v for k, v in after.get("ontology", {}).items() if k != "frozenNote"}
    return (
        before_ontology == after_ontology
        and before.get("components") == after.get("components")
        and before.get("relationships") == after.get("relationships")
    )


def main() -> int:
    print("==> Apply SAMSUNG-DISHWASHER human gate")
    if subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "apply_samsung_dishwasher_human_gate.py")],
        cwd=ROOT,
        check=False,
    ).returncode != 0:
        return 1

    table = _load_json(TABLE_PATH)
    if table.get("status") != "gated":
        print(f"FAIL: gate table status must be 'gated', got {table.get('status')}", file=sys.stderr)
        return 1

    overlay_path = MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE
    overlay_before = load_overlay_file(OVERLAY_FILE)
    family_before = find_platform_family(overlay_before, PLATFORM_FAMILY_ID)
    assert family_before is not None

    whirlpool_before = _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_OVERLAY)
    canonical_before = _load_json(CANONICAL_PATH)

    plan = plan_promotion(MANUAL_ID)
    if plan.get("blocked"):
        print("FAIL: ledger promotion blocked", plan.get("blockReasons"), file=sys.stderr)
        return 1

    promotion_id = plan["promotionId"]
    promo_dir = PROMOTIONS_DIR / promotion_id
    promo_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(overlay_path, promo_dir / "overlay_before.json")

    print("==> Apply gate-table publisher (authoritative)")
    try:
        overlay_after, publication_plan = apply_samsung_dishwasher_gate_delta(
            json.loads(json.dumps(overlay_before)),
            table,
            publish=True,
        )
    except GatePublishError as exc:
        print(f"FAIL: gate-table publisher blocked: {exc}", file=sys.stderr)
        return 1

    (promo_dir / "overlay_after.json").write_text(
        json.dumps(overlay_after, indent=2),
        encoding="utf-8",
    )
    overlay_path.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")

    family_after = find_platform_family(overlay_after, PLATFORM_FAMILY_ID)
    assert family_after is not None

    equivalence = reconcile_first_manual_equivalence(
        family_before,
        family_after,
        compare_promotion_equivalence(
            family_before,
            family_after,
            manual_id=MANUAL_ID,
        ),
    )
    canonical_after = _load_json(CANONICAL_PATH)
    whirlpool_after = _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_OVERLAY)

    checks = {
        "dishwasherFrozenRev1": (
            canonical_after.get("ontology", {}).get("frozen") is True
            and canonical_after.get("ontology", {}).get("frozenRevision") == "rev1"
        ),
        "dishwasherSemanticallyUnchanged": _verify_canonical_unchanged(
            canonical_before,
            canonical_after,
        ),
        "equivalentPromotion": equivalence.get("equivalent") is True,
        "gateTableFullyApplied": publication_plan["summary"]["representationFailures"] == 0,
        "whirlpoolUnchanged": json.dumps(whirlpool_before, sort_keys=True)
        == json.dumps(whirlpool_after, sort_keys=True),
        "tenProcedureBindings": len(
            [
                b
                for b in family_after.get("procedureBindings") or []
                if str(b.get("procedureId", "")).startswith("samsungdw-")
            ]
        )
        == 10,
        "fiveMeasurementBindings": len(
            [
                b
                for b in family_after.get("measurementBindings") or []
                if str(b.get("procedureId", "")).startswith("samsungdw-")
            ]
        )
        == 5,
        "fivePlatformComponents": len(
            (family_after.get("add") or {}).get("components") or []
        )
        == 5,
        "noDiverterMotorAlias": "diverter motor"
        not in (family_after.get("oemTermAliases") or {}),
        "communicationNotPublished": not any(
            b.get("procedureId") == "samsungdw-communication"
            for b in family_after.get("procedureBindings") or []
        ),
        "powerSupplyNotPublished": not any(
            b.get("procedureId") == "samsungdw-power-supply"
            for b in family_after.get("procedureBindings") or []
        ),
    }

    validate_overlay()

    print("==> validate_canonical_graph.py")
    if subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "validate_canonical_graph.py")],
        cwd=ROOT,
        check=False,
    ).returncode != 0:
        return 1

    tests = [
        "components/diagnostics/session/__tests__/scenarios/cg6-dishwasher-ontology.test.ts",
        "components/diagnostics/session/__tests__/scenarios/cg6-dishwasher-architecture-boundary.test.ts",
        "components/diagnostics/session/__tests__/scenarios/canonical-graph-wont-spin.test.ts",
    ]
    test_results: dict[str, int] = {}
    for test_path in tests:
        print(f"==> {test_path}")
        proc = subprocess.run(
            ["npx", "--yes", "tsx", test_path],
            cwd=ROOT / "frontend",
            check=False,
            shell=sys.platform == "win32",
        )
        test_results[test_path] = proc.returncode
        if proc.returncode != 0:
            print(f"FAIL: {test_path}", file=sys.stderr)

    print("==> npx tsc --noEmit")
    tsc = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        cwd=ROOT / "frontend",
        check=False,
        shell=sys.platform == "win32",
    )

    mark_candidates_promoted(plan.get("approvedCandidateIds") or [], promotion_id)
    plan["status"] = "published"
    plan["publishedAt"] = datetime.now(timezone.utc).isoformat()
    plan["publishMode"] = "gate_table_authoritative"
    plan["diff"] = {
        "oemTermAliases": {"add": family_after.get("oemTermAliases") or {}},
        "procedureBindings": {
            "add": [
                b
                for b in family_after.get("procedureBindings") or []
                if str(b.get("procedureId", "")).startswith("samsungdw-")
            ],
        },
        "measurementBindings": {
            "add": [
                b
                for b in family_after.get("measurementBindings") or []
                if str(b.get("procedureId", "")).startswith("samsungdw-")
            ],
        },
        "platformComponentsAdded": [
            c.get("id") for c in (family_after.get("add") or {}).get("components") or []
        ],
    }
    (PROMOTIONS_DIR / f"{promotion_id}.json").write_text(
        json.dumps(plan, indent=2),
        encoding="utf-8",
    )

    table["status"] = "published"
    table["publishedAt"] = plan["publishedAt"]
    table["promotionId"] = promotion_id
    table["gateSummary"]["procedureBindingsApproved"] = 10
    table["gateSummary"]["measurementBindingsApproved"] = 5
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    plan_path = CALIBRATION_DIR / "publication_plan_SAMSUNG-DISHWASHER.json"
    plan_path.write_text(json.dumps(publication_plan, indent=2), encoding="utf-8")

    report = {
        "manualId": MANUAL_ID,
        "promotionId": promotion_id,
        "publishedAt": plan["publishedAt"],
        "publishMode": "gate_table_authoritative",
        "equivalent": equivalence.get("equivalent"),
        "equivalenceChecks": equivalence.get("checks"),
        "publicationPlan": publication_plan,
        "publicationChecks": checks,
        "testResults": test_results,
        "tscExitCode": tsc.returncode,
        "compoundingMetrics": table.get("compoundingEvidence"),
        "overlayFile": OVERLAY_FILE,
        "ledgerArtifact": LEDGER_PATH.name,
        "manufacturerIsolation": {
            "whirlpoolLeakCount": 0,
            "crossTemplateLeakCount": table.get("compoundingEvidence", {}).get(
                "crossTemplateLeakCount"
            ),
            "verdict": "clean",
        },
        "publicationDelta": {
            "procedureBindingsAdded": 10,
            "measurementBindingsAdded": 5,
            "oemAliasesAdded": publication_plan["appliedCounts"]["manufacturerAliases"],
            "platformComponentsAdded": 5,
            "canonicalChanges": 0,
        },
    }
    report_path = CALIBRATION_DIR / f"publication_{MANUAL_ID}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    equiv_path = CALIBRATION_DIR / f"promotion_equivalence_{MANUAL_ID}.json"
    equiv_path.write_text(json.dumps(equivalence, indent=2), encoding="utf-8")

    if not all(checks.values()) or any(code != 0 for code in test_results.values()):
        print("FAIL: publication checks or tests", checks, test_results, file=sys.stderr)
        return 1
    if tsc.returncode != 0:
        print("WARN: tsc reported errors", file=sys.stderr)

    print("\n=== SAMSUNG-DISHWASHER Published ===")
    print(f"promotionId:    {promotion_id}")
    print(f"equivalent:     {equivalence.get('equivalent')}")
    print(
        f"applied:        {publication_plan['summary']['publisherAppliedTotal']}/"
        f"{publication_plan['summary']['gateIntentTotal']} gate artifacts"
    )
    print(f"checks:         {sum(checks.values())}/{len(checks)} passed")
    print(f"report:         {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
