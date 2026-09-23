#!/usr/bin/env python3
"""W11499711 promotion dry-run — mechanical SSM registration only (no publish)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR
from normalization.promotion.planner import find_platform_family, load_overlay_file, plan_promotion
from normalization.review.review_package import load_review_package
from run_compiler_loop import run_compiler_loop

MANUAL_ID = "W11499711"
PRIOR_MANUAL_IDS = ["W11633848", "W11480208"]
TARGET = {
    "overlayFile": "whirlpool_dishwasher.json",
    "platformFamilyId": "whirlpool_dishwasher_acu",
}
NATIVE_PROCEDURE = "w11499711-wash-motor-ssm"


def _verify_architecture_preservation() -> dict[str, bool]:
    overlay = load_overlay_file(TARGET["overlayFile"])
    family = find_platform_family(overlay, TARGET["platformFamilyId"])
    assert family is not None

    aliases = family.get("oemTermAliases") or {}
    components = {c["id"] for c in (family.get("add") or {}).get("components") or []}
    procedure_map = {
        b["procedureId"]: b
        for b in family.get("procedureBindings") or []
        if b.get("procedureId")
    }
    measurement_map = {
        f"{b['procedureId']}:{b['measurementKnowledgeId']}": b
        for b in family.get("measurementBindings") or []
        if b.get("procedureId") and b.get("measurementKnowledgeId")
    }

    dishwasher = json.loads((CANONICAL_DIR / "dishwasher.json").read_text(encoding="utf-8"))
    canonical_ids = {c["id"] for c in dishwasher.get("components", [])}

    ssm_wash = procedure_map.get("w11633848-wash-motor") or {}
    vsm_wash = procedure_map.get("w11480208-wash-motor-vsm") or {}

    return {
        "dishwasher_ontology_frozen_rev1": (
            dishwasher.get("ontology", {}).get("frozen") is True
            and dishwasher.get("ontology", {}).get("frozenRevision") == "rev1"
        ),
        "no_diverter_valve_canonical": "diverter_valve" not in canonical_ids,
        "ssm_anchor_intact": (
            ssm_wash.get("testTargetId") == "circulation_test"
            and ssm_wash.get("implementationComponent") == "ssm_wash_motor"
        ),
        "vsm_knowledge_intact": (
            vsm_wash.get("testTargetId") == "circulation_test"
            and vsm_wash.get("implementationComponent") == "vsm_wash_motor"
            and "vsm_wash_motor" in components
            and "vsm_drain_motor" in components
        ),
        "ssm_measurement_anchor_intact": (
            measurement_map.get("w11633848-wash-motor:whirlpoolDishwasherAcuWashMotorOhms", {}).get(
                "implementationComponent"
            )
            == "ssm_wash_motor"
        ),
        "vsm_measurement_not_on_native_cohort": (
            f"{NATIVE_PROCEDURE}:whirlpoolDishwasherFiltrationVsmWashMotorOhms"
            not in measurement_map
        ),
        "native_procedure_not_prematurely_published": NATIVE_PROCEDURE not in procedure_map,
    }


def _verify_ledger_scope() -> dict[str, int | bool]:
    package = load_review_package(MANUAL_ID)
    records = package.get("records") or []
    approved_mappings = [
        r for r in records if r.get("candidateType") == "canonicalMapping" and r.get("status") == "approved"
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

    native_proc = next(
        (r for r in approved_procedures if r.get("what") == NATIVE_PROCEDURE),
        None,
    )
    native_meas = next(
        (
            r
            for r in approved_measurements
            if r.get("what") == NATIVE_PROCEDURE
            and (r.get("proposedChange", {}).get("value", {}).get("measurementKnowledgeId"))
            == "whirlpoolDishwasherAcuWashMotorOhms"
        ),
        None,
    )

    return {
        "totalRecords": len(records),
        "approvedMappings": len(approved_mappings),
        "approvedProcedureBindings": len(approved_procedures),
        "approvedMeasurementBindings": len(approved_measurements),
        "mappingsExactly0": len(approved_mappings) == 0,
        "procedureBindingsExactly1": len(approved_procedures) == 1,
        "measurementBindingsExactly1": len(approved_measurements) == 1,
        "nativeProcedureTarget": (native_proc or {})
        .get("proposedChange", {})
        .get("value", {})
        .get("testTargetId")
        == "circulation_test",
        "nativeMeasurementKnowledgeId": (native_meas or {})
        .get("proposedChange", {})
        .get("value", {})
        .get("measurementKnowledgeId")
        == "whirlpoolDishwasherAcuWashMotorOhms",
        "newCanonicalConcepts": 0,
        "newHumanSemanticDecisions": 0,
    }


def main() -> int:
    print("==> Apply W11499711 mechanical gate")
    apply_proc = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "apply_w11499711_dishwasher_mechanical_gate.py")],
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
    diff = plan.get("diff") or {}
    alias_add = diff.get("oemTermAliases", {}).get("add") or {}
    proc_add = diff.get("procedureBindings", {}).get("add") or []
    meas_add = diff.get("measurementBindings", {}).get("add") or []

    architecture = _verify_architecture_preservation()
    ledger_scope = _verify_ledger_scope()

    promotion_checks = {
        "noAliasAdds": len(alias_add) == 0,
        "oneProcedureAdd": len(proc_add) == 1 and proc_add[0].get("procedureId") == NATIVE_PROCEDURE,
        "oneMeasurementAdd": (
            len(meas_add) == 1
            and meas_add[0].get("procedureId") == NATIVE_PROCEDURE
            and meas_add[0].get("measurementKnowledgeId") == "whirlpoolDishwasherAcuWashMotorOhms"
        ),
        "procedureTargetCirculationTest": proc_add[0].get("testTargetId") == "circulation_test"
        if proc_add
        else False,
        "measurementTargetCirculationTest": meas_add[0].get("testTargetId") == "circulation_test"
        if meas_add
        else False,
    }

    if not all(architecture.values()):
        print("FAIL: architecture preservation", architecture, file=sys.stderr)
        return 1
    if not all(
        ledger_scope.get(key)
        for key in (
            "mappingsExactly0",
            "procedureBindingsExactly1",
            "measurementBindingsExactly1",
            "nativeProcedureTarget",
            "nativeMeasurementKnowledgeId",
        )
    ):
        print("FAIL: ledger scope", ledger_scope, file=sys.stderr)
        return 1
    if not all(promotion_checks.values()):
        print("FAIL: promotion diff scope", promotion_checks, file=sys.stderr)
        print(f"  alias_add={alias_add} proc_add={proc_add} meas_add={meas_add}", file=sys.stderr)
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
        (CALIBRATION_DIR / "W11499711_overlay_mapping_table_v1.json").read_text(encoding="utf-8")
    )
    evidence = gate_table.get("compoundingEvidence") or {}
    accounting = gate_table.get("compoundingAccounting") or {}

    report = {
        "manualId": MANUAL_ID,
        "priorManualIds": PRIOR_MANUAL_IDS,
        "gateKind": "mechanical_only",
        "promotionId": result.get("promotionId"),
        "equivalent": equivalence.get("equivalent"),
        "checks": equivalence.get("checks"),
        "ledgerScope": ledger_scope,
        "architecturePreservation": architecture,
        "promotionDiffChecks": promotion_checks,
        "promotionDiff": plan.get("diff"),
        "dishwasherOntologyFrozen": True,
        "dishwasherFrozenRevision": "rev1",
        "publish": False,
        "compoundingMetrics": {
            "newHumanSemanticDecisions": 0,
            "mechanicalRegistrations": evidence.get("mechanicalRegistrations"),
            "inheritanceValidation": evidence.get("inheritanceValidation"),
            "documentation": evidence.get("documentation"),
            "evidenceKinds": accounting.get("evidenceKinds"),
            "teachingCostCurve": accounting.get("teachingCostCurve"),
        },
        "notes": [
            "Mechanical dry-run registers w11499711-wash-motor-ssm under published SSM semantics.",
            "No OEM aliases, platform components, or canonical expansion.",
            "VSM/diverter/ProDry published knowledge preserved unchanged.",
            evidence.get("documentation"),
        ],
    }
    report_path = CALIBRATION_DIR / f"promotion_dry_run_{MANUAL_ID}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    equiv_path = CALIBRATION_DIR / f"promotion_equivalence_{MANUAL_ID}.json"
    equiv_path.write_text(
        json.dumps(
            {
                "manualId": MANUAL_ID,
                "priorManualIds": PRIOR_MANUAL_IDS,
                "equivalent": equivalence.get("equivalent"),
                "checks": equivalence.get("checks"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print("\n=== W11499711 Promotion Dry-Run (mechanical) ===")
    print(f"equivalent:              {report['equivalent']}")
    print(f"promotionId:             {report['promotionId']}")
    print(
        f"ledger:                  {ledger_scope['approvedMappings']} mappings / "
        f"{ledger_scope['approvedProcedureBindings']} procedures / "
        f"{ledger_scope['approvedMeasurementBindings']} measurements"
    )
    print(f"promotion diff:          +1 procedure, +1 measurement, +0 aliases")
    print(f"human semantic decisions: 0")
    print(f"report:                  {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
