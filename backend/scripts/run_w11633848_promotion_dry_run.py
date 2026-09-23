#!/usr/bin/env python3
"""W11633848 promotion dry-run — equivalence + architecture preservation gate."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, MANUFACTURER_OVERLAYS_DIR
from normalization.promotion.planner import find_platform_family, load_overlay_file, plan_promotion
from normalization.review.review_package import load_review_package
from run_compiler_loop import run_compiler_loop

MANUAL_ID = "W11633848"
TARGET = {
    "overlayFile": "whirlpool_dishwasher.json",
    "platformFamilyId": "whirlpool_dishwasher_acu",
}


def _verify_architecture_preservation() -> dict[str, bool]:
    overlay = load_overlay_file(TARGET["overlayFile"])
    family = find_platform_family(overlay, TARGET["platformFamilyId"])
    assert family is not None

    aliases = family.get("oemTermAliases") or {}
    components = {c["id"] for c in (family.get("add") or {}).get("components") or []}
    relationships = family.get("add", {}).get("relationships") or []
    procedure_map = {
        b["procedureId"]: b["testTargetId"]
        for b in family.get("procedureBindings") or []
        if b.get("procedureId") and b.get("testTargetId")
    }

    owi = next((c for c in (family.get("add") or {}).get("components") or [] if c.get("id") == "owi_sensor"), None)
    owi_implements = {
        rel["to"]
        for rel in relationships
        if rel.get("from") == "owi_sensor" and rel.get("type") == "implements"
    }

    dishwasher = json.loads((CANONICAL_DIR / "dishwasher.json").read_text(encoding="utf-8"))

    return {
        "dishwasher_ontology_frozen_rev1": (
            dishwasher.get("ontology", {}).get("frozen") is True
            and dishwasher.get("ontology", {}).get("frozenRevision") == "rev1"
        ),
        "no_diverter_valve_canonical": "diverter_valve" not in {
            c["id"] for c in dishwasher.get("components", [])
        },
        "owi_not_manufacturer_alias": "owi" not in {k.lower() for k in aliases},
        "owi_dual_role_platform": owi is not None and owi.get("dualRoleCanonicalIds") == [
            "water_level_sensor",
            "temperature_sensor",
        ],
        "owi_implements_level_and_temperature": owi_implements == {
            "water_level_sensor",
            "temperature_sensor",
        },
        "f500_alias_thermal_protection": aliases.get("f500 triac load fuse") == "thermal_protection",
        "section_310_title_not_alias": "§3-10: Water Heating / Heat Dry" not in aliases,
        "heater_vs_dc_fan_split": (
            procedure_map.get("w11633848-heater") == "heater_command_test"
            and procedure_map.get("w11633848-dc-fan") == "drying_airflow_test"
        ),
        "platform_components_present": {
            "diverter_motor",
            "diverter_position_sensor",
            "owi_sensor",
            "dc_fan_motor",
            "f500_triac_fuse",
            "ssm_wash_motor",
        }.issubset(components),
        "door_gasket_not_manufacturer_alias": "door_gasket" not in {
            k.lower() for k in aliases
        },
    }


def _verify_ledger_scope() -> dict[str, int | bool]:
    package = load_review_package(MANUAL_ID)
    records = package.get("records") or []
    approved_mappings = [
        r for r in records
        if r.get("candidateType") == "canonicalMapping" and r.get("status") == "approved"
    ]
    approved_procedures = [
        r for r in records
        if r.get("candidateType") == "procedureTestBinding" and r.get("status") == "approved"
    ]
    approved_measurement_ids = {
        r.get("candidateId")
        for r in records
        if r.get("candidateType") == "measurementBinding" and r.get("status") == "approved"
    }
    rejected = [r for r in records if r.get("status") == "rejected"]
    deferred = [r for r in records if r.get("status") == "needs_review"]

    dc_fan = next(
        (
            r for r in approved_procedures
            if r.get("what") == "w11633848-dc-fan"
        ),
        None,
    )
    owi_meas = next(
        (
            r for r in records
            if r.get("candidateType") == "measurementBinding"
            and r.get("status") == "approved"
            and r.get("what") == "w11633848-owi-sensor"
        ),
        None,
    )

    return {
        "approvedMappings": len(approved_mappings),
        "approvedProcedureBindings": len(approved_procedures),
        "approvedMeasurementBindings": len(approved_measurement_ids),
        "rejected": len(rejected),
        "deferred": len(deferred),
        "dcFanGatedTarget": (dc_fan or {}).get("proposedChange", {})
        .get("value", {})
        .get("testTargetId") == "drying_airflow_test",
        "owiMeasGatedTarget": (owi_meas or {}).get("proposedChange", {})
        .get("value", {})
        .get("testTargetId") == "water_level_test",
        "mappingsExactly15": len(approved_mappings) == 15,
        "procedureBindingsExactly13": len(approved_procedures) == 13,
        "measurementBindingsExactly7": len(approved_measurement_ids) == 7,
        "wrongOverfillFillValveMeasRejected": not any(
            r.get("candidateId")
            == "overlay-W11633848-w11633848-overfill-switch-meas-whirlpoolDishwasherAcuFillValveOhms"
            and r.get("status") == "approved"
            for r in records
        ),
    }


def main() -> int:
    print("==> Re-apply human gate (mappings + gated bindings)")
    apply_proc = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "apply_w11633848_dishwasher_human_gate.py")],
        cwd=ROOT,
        check=False,
    )
    if apply_proc.returncode != 0:
        return apply_proc.returncode

    print("==> Compiler loop dry-run")
    result = run_compiler_loop(MANUAL_ID, publish=False, auto_approve=False)
    equivalence = result.get("equivalence") or {}
    if not equivalence.get("equivalent"):
        print("FAIL: promotion equivalence", equivalence.get("checks"), file=sys.stderr)
        return 1

    plan = plan_promotion(MANUAL_ID)
    architecture = _verify_architecture_preservation()
    ledger_scope = _verify_ledger_scope()

    if not all(architecture.values()):
        print("FAIL: architecture preservation", architecture, file=sys.stderr)
        return 1
    if not all(
        ledger_scope.get(key)
        for key in (
            "mappingsExactly15",
            "procedureBindingsExactly13",
            "measurementBindingsExactly7",
            "dcFanGatedTarget",
            "owiMeasGatedTarget",
            "wrongOverfillFillValveMeasRejected",
        )
    ):
        print("FAIL: ledger scope", ledger_scope, file=sys.stderr)
        return 1

    print("==> validate_canonical_graph.py")
    canon = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "validate_canonical_graph.py")],
        cwd=ROOT,
        check=False,
    )
    if canon.returncode != 0:
        return canon.returncode

    print("==> validate_normalization_candidates.py")
    norm = subprocess.run(
        [
            sys.executable,
            str(SCRIPTS_DIR / "validate_normalization_candidates.py"),
            "--manual",
            MANUAL_ID,
        ],
        cwd=ROOT,
        check=False,
    )
    if norm.returncode != 0:
        return norm.returncode

    print("==> dishwasher regression tests")
    ds = subprocess.run(
        [
            "npx",
            "--yes",
            "tsx",
            "components/diagnostics/session/__tests__/scenarios/cg6-dishwasher-ontology.test.ts",
        ],
        cwd=ROOT / "frontend",
        check=False,
        shell=sys.platform == "win32",
    )
    if ds.returncode != 0:
        return ds.returncode

    arch = subprocess.run(
        [
            "npx",
            "--yes",
            "tsx",
            "components/diagnostics/session/__tests__/scenarios/cg6-dishwasher-architecture-boundary.test.ts",
        ],
        cwd=ROOT / "frontend",
        check=False,
        shell=sys.platform == "win32",
    )
    if arch.returncode != 0:
        return arch.returncode

    report = {
        "manualId": MANUAL_ID,
        "promotionId": result.get("promotionId"),
        "equivalent": equivalence.get("equivalent"),
        "checks": equivalence.get("checks"),
        "ledgerScope": ledger_scope,
        "architecturePreservation": architecture,
        "promotionDiff": plan.get("diff"),
        "dishwasherOntologyFrozen": True,
    "dishwasherFrozenRevision": "rev1",
        "publish": False,
        "notes": [
            "Successful dry-run preserves first-manual architecture; dishwasher.json remains unfrozen.",
            "OWI dual-role and §3-10 heat/drying split verified in overlay + gated ledger.",
        ],
    }
    report_path = CALIBRATION_DIR / f"promotion_dry_run_{MANUAL_ID}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("\n=== W11633848 Promotion Dry-Run ===")
    print(f"equivalent:     {report['equivalent']}")
    print(f"promotionId:    {report['promotionId']}")
    print(f"ledger:         15 mappings / 13 procedures / 7 measurements approved")
    print(f"architecture:   {sum(architecture.values())}/{len(architecture)} checks passed")
    print(f"dishwasher.json frozen rev1: {report['dishwasherOntologyFrozen']}")
    print(f"report:         {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
