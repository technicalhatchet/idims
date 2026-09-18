#!/usr/bin/env python3
"""SAMSUNG-DISHWASHER gate-table promotion dry-run (no publish)."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, MANUFACTURER_OVERLAYS_DIR, PROMOTIONS_DIR
from normalization.promotion.equivalence import compare_promotion_equivalence
from normalization.promotion.planner import find_platform_family, load_overlay_file
from samsung_dishwasher_gate_publish import (
    MANUAL_ID,
    PLATFORM_FAMILY_ID,
    apply_samsung_dishwasher_gate_delta,
    build_publication_plan,
    reconcile_first_manual_equivalence,
)

OVERLAY_FILE = "samsung_dishwasher.json"
WHIRLPOOL_OVERLAY = "whirlpool_dishwasher.json"
TABLE_PATH = CALIBRATION_DIR / "SAMSUNG_DISHWASHER_overlay_mapping_table_v1.json"
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


def _verify_whirlpool_preserved(before: dict, after: dict) -> dict[str, bool]:
    return {
        "whirlpool_overlay_byte_stable": json.dumps(before, sort_keys=True)
        == json.dumps(after, sort_keys=True),
        "w11499711_ssm_binding_present": any(
            b.get("procedureId") == "w11499711-wash-motor-ssm"
            for b in (before.get("platformFamilies") or [{}])[0].get("procedureBindings") or []
        ),
    }


def _verify_samsung_architecture(family: dict) -> dict[str, bool]:
    aliases = family.get("oemTermAliases") or {}
    components = {c["id"] for c in (family.get("add") or {}).get("components") or []}
    procedures = {
        b["procedureId"]: b["testTargetId"]
        for b in family.get("procedureBindings") or []
        if b.get("procedureId")
    }

    distributor_targets = [
        rel["to"]
        for rel in (family.get("add") or {}).get("relationships") or []
        if rel.get("from") == "distributor_motor" and rel.get("type") == "implements"
    ]

    return {
        "tenProcedureBindings": len(
            [pid for pid in procedures if str(pid).startswith("samsungdw-")]
        )
        == 10,
        "fiveMeasurementBindings": len(
            [
                b
                for b in family.get("measurementBindings") or []
                if str(b.get("procedureId", "")).startswith("samsungdw-")
            ]
        )
        == 5,
        "fivePlatformComponents": components
        == {
            "circulation_motor",
            "distributor_motor",
            "vent_fan_motor",
            "thermal_actuator",
            "overflow_sensor",
        },
        "distributorImplementsCirculation": distributor_targets == ["circulation_pump"],
        "noDiverterMotorAlias": "diverter motor" not in aliases
        and "diverter_motor" not in aliases,
        "noDiverterMotorComponent": "diverter_motor" not in components,
        "mainControlAliasPresent": aliases.get("main pba") == "control_board",
        "communicationNotBound": "samsungdw-communication" not in procedures,
        "powerSupplyNotBound": "samsungdw-power-supply" not in procedures,
        "drySystemDryingTest": procedures.get("samsungdw-dry-system") == "drying_airflow_test",
        "overflowWaterLevelTest": procedures.get("samsungdw-overflow") == "water_level_test",
    }


def main() -> int:
    print("==> Apply SAMSUNG-DISHWASHER human gate")
    if subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "apply_samsung_dishwasher_human_gate.py")],
        cwd=ROOT,
        check=False,
    ).returncode != 0:
        return 1

    table = _load_json(TABLE_PATH)
    if table.get("status") not in {"gated", "published"}:
        print("FAIL: gate table not gated", file=sys.stderr)
        return 1

    whirlpool_before = _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_OVERLAY)
    canonical_before = _load_json(CANONICAL_PATH)
    overlay_before = load_overlay_file(OVERLAY_FILE)
    family_before = find_platform_family(overlay_before, PLATFORM_FAMILY_ID)
    assert family_before is not None

    print("==> Gate-table publisher dry-run (authoritative)")
    try:
        overlay_after, publication_plan = apply_samsung_dishwasher_gate_delta(
            json.loads(json.dumps(overlay_before)),
            table,
            publish=False,
        )
    except Exception as exc:
        print(f"FAIL: gate-table publisher blocked: {exc}", file=sys.stderr)
        report_path = CALIBRATION_DIR / "publication_plan_SAMSUNG-DISHWASHER.json"
        report_path.write_text(
            json.dumps(build_publication_plan(table), indent=2),
            encoding="utf-8",
        )
        return 1

    family_after = find_platform_family(overlay_after, PLATFORM_FAMILY_ID)
    assert family_after is not None

    overlay_path = MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE
    promotion_id = f"promo-{MANUAL_ID}-gate-table-dry-run"
    promo_dir = PROMOTIONS_DIR / promotion_id
    promo_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(overlay_path, promo_dir / "overlay_before.json")
    (promo_dir / "overlay_after.json").write_text(
        json.dumps(overlay_after, indent=2),
        encoding="utf-8",
    )

    # Temporarily apply gate-table overlay so frontend regression tests exercise full publication.
    overlay_path.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")

    equivalence = reconcile_first_manual_equivalence(
        family_before,
        family_after,
        compare_promotion_equivalence(
            family_before,
            family_after,
            manual_id=MANUAL_ID,
        ),
    )

    whirlpool_after = _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_OVERLAY)
    canonical_after = _load_json(CANONICAL_PATH)
    whirlpool_checks = _verify_whirlpool_preserved(whirlpool_before, whirlpool_after)
    architecture = _verify_samsung_architecture(family_after)

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
        "gateTableFullyApplied": publication_plan.get("summary", {}).get("representationFailures")
        == 0
        and not publication_plan.get("publishBlocked"),
        "whirlpoolUnchanged": whirlpool_checks["whirlpool_overlay_byte_stable"],
        **architecture,
    }

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

    plan_path = CALIBRATION_DIR / "publication_plan_SAMSUNG-DISHWASHER.json"
    plan_path.write_text(json.dumps(publication_plan, indent=2), encoding="utf-8")

    report = {
        "manualId": MANUAL_ID,
        "gateKind": "manufacturer_boundary_first_manual",
        "promotionId": promotion_id,
        "publish": False,
        "publishMode": "gate_table_authoritative",
        "equivalent": equivalence.get("equivalent"),
        "equivalenceChecks": equivalence.get("checks"),
        "publicationPlan": {
            "gateIntentTotal": publication_plan["summary"]["gateIntentTotal"],
            "publisherAppliedTotal": publication_plan["summary"]["publisherAppliedTotal"],
            "representationFailures": publication_plan["summary"]["representationFailures"],
            "appliedCounts": publication_plan["appliedCounts"],
            "expectedCounts": publication_plan["expectedCounts"],
        },
        "checks": checks,
        "whirlpoolPreservation": whirlpool_checks,
        "testResults": test_results,
        "notes": [
            "Gate table is authoritative; ledger records audit trail only.",
            "Dry-run writes overlay_after to promotion folder — on-disk overlay unchanged.",
        ],
    }
    report_path = CALIBRATION_DIR / f"promotion_dry_run_{MANUAL_ID}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    equiv_path = CALIBRATION_DIR / f"promotion_equivalence_{MANUAL_ID}.json"
    equiv_path.write_text(json.dumps(equivalence, indent=2), encoding="utf-8")

    # Restore skeleton overlay — dry-run must not leave published state on disk.
    overlay_path.write_text(
        json.dumps(overlay_before, indent=2),
        encoding="utf-8",
    )
    restored_whirlpool = _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_OVERLAY)
    checks["overlayRestoredAfterDryRun"] = (
        json.dumps(_load_json(overlay_path), sort_keys=True)
        == json.dumps(overlay_before, sort_keys=True)
    )
    checks["whirlpoolUnchanged"] = json.dumps(whirlpool_before, sort_keys=True) == json.dumps(
        restored_whirlpool, sort_keys=True
    )

    if not all(checks.values()) or any(code != 0 for code in test_results.values()):
        print("FAIL: checks or tests", checks, test_results, file=sys.stderr)
        return 1

    print("\n=== SAMSUNG-DISHWASHER Gate-Table Dry-Run ===")
    print(f"gate intent:      {publication_plan['summary']['gateIntentTotal']} approved artifacts")
    print(
        f"publisher applied: {publication_plan['summary']['publisherAppliedTotal']} "
        f"(0 silently dropped)"
    )
    print(
        f"bindings:         10 procedures / 5 measurements / 5 platform / "
        f"{publication_plan['appliedCounts']['manufacturerAliases']} aliases"
    )
    print(f"equivalent:       {equivalence.get('equivalent')}")
    print(f"architecture:     {sum(architecture.values())}/{len(architecture)} checks")
    print(f"plan:             {plan_path}")
    print(f"report:           {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
