#!/usr/bin/env python3
"""W11480208 promotion dry-run — compounding delta against frozen dishwasher rev1 (no publish)."""

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

MANUAL_ID = "W11480208"
PRIOR_MANUAL_ID = "W11633848"
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
    procedure_map = {
        b["procedureId"]: b["testTargetId"]
        for b in family.get("procedureBindings") or []
        if b.get("procedureId") and b.get("testTargetId")
    }

    dishwasher = json.loads((CANONICAL_DIR / "dishwasher.json").read_text(encoding="utf-8"))
    canonical_ids = {c["id"] for c in dishwasher.get("components", [])}

    return {
        "dishwasher_ontology_frozen_rev1": (
            dishwasher.get("ontology", {}).get("frozen") is True
            and dishwasher.get("ontology", {}).get("frozenRevision") == "rev1"
        ),
        "no_diverter_valve_canonical": "diverter_valve" not in canonical_ids,
        "no_turbidity_sensor_canonical": "turbidity_sensor" not in canonical_ids,
        "no_check_valve_canonical": "check_valve" not in canonical_ids,
        "w11633848_dc_fan_correction_preserved": procedure_map.get("w11633848-dc-fan")
        == "drying_airflow_test",
        "w11633848_bindings_intact": all(
            procedure_map.get(pid) == target
            for pid, target in {
                "w11633848-heater": "heater_command_test",
                "w11633848-drain-motor": "drain_test",
                "w11633848-wash-motor": "circulation_test",
            }.items()
        ),
        "platform_components_from_baseline_present": {
            "diverter_motor",
            "dc_fan_motor",
            "ssm_wash_motor",
            "owi_sensor",
        }.issubset(components),
        "door_gasket_not_manufacturer_alias": "door_gasket" not in {
            k.lower() for k in aliases
        },
    }


def _verify_ledger_scope() -> dict[str, int | bool]:
    package = load_review_package(MANUAL_ID)
    records = package.get("records") or []
    approved_mappings = [
        r
        for r in records
        if r.get("candidateType") == "canonicalMapping" and r.get("status") == "approved"
    ]
    approved_procedures = [
        r
        for r in records
        if r.get("candidateType") == "procedureTestBinding" and r.get("status") == "approved"
    ]
    approved_measurements = [
        r
        for r in records
        if r.get("candidateType") == "measurementBinding" and r.get("status") == "approved"
    ]
    rejected = [r for r in records if r.get("status") == "rejected"]

    dc_fan = next(
        (r for r in approved_procedures if r.get("what") == "w11480208-dc-fan"),
        None,
    )
    overfill_meas = next(
        (
            r
            for r in approved_measurements
            if r.get("what") == "w11480208-overfill-switch"
        ),
        None,
    )
    interior_led_rejected = any(
        r.get("what") == "w11480208-interior-led" and r.get("status") == "rejected"
        for r in records
    )

    return {
        "approvedMappings": len(approved_mappings),
        "approvedProcedureBindings": len(approved_procedures),
        "approvedMeasurementBindings": len(approved_measurements),
        "rejected": len(rejected),
        "mappingsExactly11": len(approved_mappings) == 11,
        "procedureBindingsExactly7": len(approved_procedures) == 7,
        "dcFanGatedTarget": (dc_fan or {})
        .get("proposedChange", {})
        .get("value", {})
        .get("testTargetId")
        == "drying_airflow_test",
        "overfillMeasGatedTarget": (overfill_meas or {})
        .get("proposedChange", {})
        .get("value", {})
        .get("testTargetId")
        == "water_level_test",
        "interiorLedOverlayRejected": interior_led_rejected,
        "newCanonicalConcepts": 0,
    }


def main() -> int:
    print("==> Apply W11480208 human gate")
    apply_proc = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "apply_w11480208_dishwasher_human_gate.py")],
        cwd=ROOT,
        check=False,
    )
    if apply_proc.returncode != 0:
        return apply_proc.returncode

    print("==> Compiler loop dry-run (no publish)")
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
            "mappingsExactly11",
            "procedureBindingsExactly7",
            "dcFanGatedTarget",
            "overfillMeasGatedTarget",
            "interiorLedOverlayRejected",
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

    gate_table = json.loads(
        (
            CALIBRATION_DIR / "W11480208_overlay_mapping_table_v1.json"
        ).read_text(encoding="utf-8")
    )
    evidence = gate_table.get("compoundingEvidence") or {}
    teaching = gate_table.get("compoundingAccounting", {}).get("teachingCostCurve") or {}

    report = {
        "manualId": MANUAL_ID,
        "priorManualId": PRIOR_MANUAL_ID,
        "promotionId": result.get("promotionId"),
        "equivalent": equivalence.get("equivalent"),
        "checks": equivalence.get("checks"),
        "ledgerScope": ledger_scope,
        "architecturePreservation": architecture,
        "promotionDiff": plan.get("diff"),
        "dishwasherOntologyFrozen": True,
        "dishwasherFrozenRevision": "rev1",
        "publish": False,
        "compoundingMetrics": {
            "newHumanSemanticDecisions": evidence.get("newHumanSemanticDecisions"),
            "baselineNewHumanSemanticDecisions": teaching.get("W11633848", {}).get(
                "newHumanSemanticDecisions"
            ),
            "teachingCostReduction": evidence.get("teachingCostReduction"),
            "inheritedReuseAtGate": evidence.get("inheritedReuseAtGate"),
            "newPlatformKnowledge": evidence.get("newPlatformKnowledge"),
            "newModelSpecificKnowledge": evidence.get("newModelSpecificKnowledge"),
            "newCanonicalConcepts": evidence.get("newCanonicalConcepts"),
        },
        "notes": [
            "Successful dry-run compounds W11480208 under frozen dishwasher rev1.",
            "VSM/diverter/DC-fan architecture stays platform layer — no canonical expansion.",
            "Matcher corrections applied at gate only; overlay not published.",
        ],
    }
    report_path = CALIBRATION_DIR / f"promotion_dry_run_{MANUAL_ID}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    equiv_path = CALIBRATION_DIR / f"promotion_equivalence_{MANUAL_ID}.json"
    equiv_path.write_text(
        json.dumps(
            {
                "manualId": MANUAL_ID,
                "priorManualId": PRIOR_MANUAL_ID,
                "equivalent": equivalence.get("equivalent"),
                "checks": equivalence.get("checks"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print("\n=== W11480208 Promotion Dry-Run (compounding) ===")
    print(f"equivalent:              {report['equivalent']}")
    print(f"promotionId:             {report['promotionId']}")
    print(
        f"ledger:                  {ledger_scope['approvedMappings']} mappings / "
        f"{ledger_scope['approvedProcedureBindings']} procedures / "
        f"{ledger_scope['approvedMeasurementBindings']} measurements"
    )
    print(
        f"teaching cost:           {evidence.get('newHumanSemanticDecisions')} new decisions "
        f"(W11633848 baseline: {teaching.get('W11633848', {}).get('newHumanSemanticDecisions')})"
    )
    print(f"new canonical concepts:  {evidence.get('newCanonicalConcepts')}")
    print(f"architecture:            {sum(architecture.values())}/{len(architecture)} checks passed")
    print(f"report:                  {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
