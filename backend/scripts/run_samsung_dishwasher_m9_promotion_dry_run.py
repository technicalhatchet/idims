#!/usr/bin/env python3
"""SAMSUNG-DISHWASHER-M9 gate-table compounding dry-run (no publish)."""

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
from samsung_dishwasher_m9_gate_publish import (
    MANUAL_ID,
    NATIVE_PREFIX,
    PLATFORM_FAMILY_ID,
    PRIOR_MANUAL_ID,
    apply_samsung_dishwasher_m9_gate_delta,
    build_publication_plan,
)

OVERLAY_FILE = "samsung_dishwasher.json"
WHIRLPOOL_OVERLAY = "whirlpool_dishwasher.json"
TABLE_PATH = CALIBRATION_DIR / "SAMSUNG_DISHWASHER_M9_overlay_mapping_table_v1.json"
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
    }


def _relationship_keys(relationships: list[dict]) -> set[tuple]:
    return {
        (rel.get("from"), rel.get("to"), rel.get("type"))
        for rel in relationships or []
    }


def _compounding_topology_additive(before: dict, after: dict) -> bool:
    before_rels = (before.get("add") or {}).get("relationships") or []
    after_rels = (after.get("add") or {}).get("relationships") or []
    return _relationship_keys(before_rels).issubset(_relationship_keys(after_rels))


def _verify_m9_compounding_architecture(family_before: dict, family_after: dict) -> dict[str, bool]:
    aliases = family_after.get("oemTermAliases") or {}
    components = {c["id"] for c in (family_after.get("add") or {}).get("components") or []}
    procedures = {
        b["procedureId"]: b
        for b in family_after.get("procedureBindings") or []
        if b.get("procedureId")
    }
    m9_procedures = {pid: b for pid, b in procedures.items() if str(pid).startswith(NATIVE_PREFIX)}
    m9_measurements = [
        b
        for b in family_after.get("measurementBindings") or []
        if str(b.get("procedureId", "")).startswith(NATIVE_PREFIX)
    ]

    circulation = m9_procedures.get("samsungdwm9-circulation-motor") or {}
    distributor = m9_procedures.get("samsungdwm9-distributor") or {}
    vane = m9_procedures.get("samsungdwm9-vane-motor") or {}

    prior_proc_count = len(
        [pid for pid in procedures if str(pid).startswith("samsungdw-")]
    )
    prior_meas_count = len(
        [
            b
            for b in family_before.get("measurementBindings") or []
            if str(b.get("procedureId", "")).startswith("samsungdw-")
        ]
    )

    return {
        "priorManualBindingsPreserved": prior_proc_count == 10 and prior_meas_count == 5,
        "elevenM9ProcedureBindings": len(m9_procedures) == 11,
        "tenM9MeasurementBindings": len(m9_measurements) == 10,
        "vaneMotorPlatformComponent": "vane_motor" in components,
        "circulationRoutesCirculationTest": circulation.get("testTargetId") == "circulation_test"
        and circulation.get("implementationComponent") == "circulation_motor",
        "distributorImplementsCirculation": distributor.get("implementationComponent")
        == "distributor_motor",
        "vaneImplementsCirculation": vane.get("implementationComponent") == "vane_motor",
        "noDriveMotorPath": circulation.get("testTargetId") != "motor_output_test",
        "communicationNotBound": "samsungdwm9-communication" not in m9_procedures,
        "powerSupplyNotBound": "samsungdwm9-power-supply" not in m9_procedures,
        "voltageAbnormalNotBound": "samsungdwm9-voltage-abnormal" not in m9_procedures,
        "leakSensorNotBound": "samsungdwm9-leak-sensor" not in m9_procedures,
        "noDiverterMotorAlias": "diverter motor" not in aliases and "diverter_motor" not in aliases,
        "noNewAliases": len(aliases) == len(family_before.get("oemTermAliases") or {}),
        "drySystemDryingTest": m9_procedures.get("samsungdwm9-dry-system", {}).get("testTargetId")
        == "drying_airflow_test",
    }


def main() -> int:
    print("==> Generate M9 gate table")
    if subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "generate_samsung_dishwasher_m9_gate_table.py")],
        cwd=ROOT,
        check=False,
    ).returncode != 0:
        return 1

    print("==> Apply SAMSUNG-DISHWASHER-M9 human gate")
    if subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "apply_samsung_dishwasher_m9_human_gate.py")],
        cwd=ROOT,
        check=False,
    ).returncode != 0:
        return 1

    table = _load_json(TABLE_PATH)
    if table.get("status") != "gated":
        print("FAIL: gate table not gated", file=sys.stderr)
        return 1

    whirlpool_before = _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_OVERLAY)
    canonical_before = _load_json(CANONICAL_PATH)
    overlay_before = load_overlay_file(OVERLAY_FILE)
    family_before = find_platform_family(overlay_before, PLATFORM_FAMILY_ID)
    assert family_before is not None

    print("==> Gate-table compounding publisher dry-run (authoritative)")
    try:
        overlay_after, publication_plan = apply_samsung_dishwasher_m9_gate_delta(
            json.loads(json.dumps(overlay_before)),
            table,
            publish=False,
        )
    except Exception as exc:
        print(f"FAIL: gate-table publisher blocked: {exc}", file=sys.stderr)
        report_path = CALIBRATION_DIR / "publication_plan_SAMSUNG-DISHWASHER-M9.json"
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

    overlay_path.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")

    equivalence = compare_promotion_equivalence(
        family_before,
        family_after,
        manual_id=PRIOR_MANUAL_ID,
    )
    prior_semantics_preserved = (
        equivalence.get("checks", {}).get("canonicalAliases") is True
        and equivalence.get("checks", {}).get("procedureBindings") is True
        and equivalence.get("checks", {}).get("measurementBindings") is True
    )
    topology_additive = _compounding_topology_additive(family_before, family_after)

    whirlpool_after = _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_OVERLAY)
    canonical_after = _load_json(CANONICAL_PATH)
    whirlpool_checks = _verify_whirlpool_preserved(whirlpool_before, whirlpool_after)
    architecture = _verify_m9_compounding_architecture(family_before, family_after)

    evidence = table.get("compoundingEvidence") or {}
    carry_forward = table.get("carryForwardMatcherDefects") or []

    checks = {
        "dishwasherFrozenRev1": (
            canonical_after.get("ontology", {}).get("frozen") is True
            and canonical_after.get("ontology", {}).get("frozenRevision") == "rev1"
        ),
        "dishwasherSemanticallyUnchanged": _verify_canonical_unchanged(
            canonical_before,
            canonical_after,
        ),
        "priorManualSemanticsPreserved": prior_semantics_preserved,
        "topologyAdditiveOnly": topology_additive,
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

    plan_path = CALIBRATION_DIR / "publication_plan_SAMSUNG-DISHWASHER-M9.json"
    plan_path.write_text(json.dumps(publication_plan, indent=2), encoding="utf-8")

    report = {
        "manualId": MANUAL_ID,
        "priorManualId": PRIOR_MANUAL_ID,
        "gateKind": "manufacturer_compounding_second_manual",
        "promotionId": promotion_id,
        "publish": False,
        "publishMode": "gate_table_compounding",
        "priorManualSemanticsPreserved": prior_semantics_preserved,
        "topologyAdditiveOnly": topology_additive,
        "equivalenceChecks": equivalence.get("checks"),
        "teachingCostAccounting": publication_plan.get("teachingCostAccounting"),
        "carryForwardMatcherDefects": carry_forward,
        "carryForwardMatcherDefectThemes": len(carry_forward),
        "genuineNewHumanSemanticDecisions": evidence.get("genuineNewHumanSemanticDecisions"),
        "compoundingInheritance": publication_plan.get("compoundingInheritance"),
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
            "Dry-run writes overlay_after to promotion folder — on-disk overlay restored after tests.",
            "Teaching cost: 2 genuine decisions (leak_sensor defer, vane_motor platform); "
            "2 carry-forward matcher defects (power, communication).",
        ],
    }
    report_path = CALIBRATION_DIR / f"promotion_dry_run_{MANUAL_ID}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    equiv_path = CALIBRATION_DIR / f"promotion_equivalence_{MANUAL_ID}.json"
    equiv_path.write_text(json.dumps(equivalence, indent=2), encoding="utf-8")

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

    print("\n=== SAMSUNG-DISHWASHER-M9 Gate-Table Compounding Dry-Run ===")
    print(f"inheritance:      {evidence.get('inheritedExact')} exact / {evidence.get('inheritedSemantic')} semantic")
    print(
        f"genuine new:      {evidence.get('genuineNewHumanSemanticDecisions')} human decisions "
        f"(leak_sensor + vane_motor)"
    )
    print(f"carry-forward:    {len(carry_forward)} matcher defect themes (compiler signal)")
    print(
        f"M9 delta:         {publication_plan['appliedCounts']['procedureBindings']} procedures / "
        f"{publication_plan['appliedCounts']['measurementBindings']} measurements / "
        f"{publication_plan['appliedCounts']['platformComponents']} platform component"
    )
    print(f"prior preserved:  {prior_semantics_preserved} (topology additive: {topology_additive})")
    print(f"architecture:     {sum(architecture.values())}/{len(architecture)} checks")
    print(f"plan:             {plan_path}")
    print(f"report:           {report_path}")
    print(f"ledger:           {CALIBRATION_DIR / 'SAMSUNG_DISHWASHER_M9_gate_decision_ledger_v1.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
