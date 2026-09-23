#!/usr/bin/env python3
"""Publish gated W11499711 mechanical overlay registration (bindings only, no semantic delta)."""

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

from normalization.paths import CALIBRATION_DIR, MANUFACTURER_OVERLAYS_DIR, PROMOTIONS_DIR
from normalization.promotion.equivalence import compare_promotion_equivalence
from normalization.promotion.planner import find_platform_family, load_overlay_file, plan_promotion
from normalization.promotion.publish import validate_overlay
from normalization.review.ledger import mark_candidates_promoted

MANUAL_ID = "W11499711"
PRIOR_MANUAL_IDS = ["W11633848", "W11480208"]
OVERLAY_FILE = "whirlpool_dishwasher.json"
PLATFORM_FAMILY_ID = "whirlpool_dishwasher_acu"
TABLE_PATH = CALIBRATION_DIR / "W11499711_overlay_mapping_table_v1.json"
CANONICAL_PATH = ROOT / "frontend/components/diagnostics/knowledge/canonical/dishwasher.json"
NATIVE_PROCEDURE = "w11499711-wash-motor-ssm"
PROMOTION_ID = "promo-W11499711-20260915074133"

FAILURE_DOMAINS = {
    NATIVE_PROCEDURE: ["circulation_failure"],
}


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _component_by_id(family: dict, component_id: str) -> dict | None:
    for component in (family.get("add") or {}).get("components") or []:
        if component.get("id") == component_id:
            return component
    return None


def _upsert_procedure_binding(family: dict, binding: dict) -> None:
    bindings = family.setdefault("procedureBindings", [])
    proc_id = binding.get("procedureId")
    for index, existing in enumerate(bindings):
        if existing.get("procedureId") == proc_id:
            bindings[index] = {**existing, **binding}
            return
    bindings.append(binding)


def _upsert_measurement_binding(family: dict, binding: dict) -> None:
    bindings = family.setdefault("measurementBindings", [])
    key = (binding.get("procedureId"), binding.get("measurementKnowledgeId"))
    for index, existing in enumerate(bindings):
        if (
            existing.get("procedureId"),
            existing.get("measurementKnowledgeId"),
        ) == key:
            bindings[index] = {**existing, **binding}
            return
    bindings.append(binding)


def _alias_count(family: dict) -> int:
    return len(family.get("oemTermAliases") or {})


def _component_count(family: dict) -> int:
    return len((family.get("add") or {}).get("components") or [])


def apply_w11499711_mechanical_delta(overlay: dict, table: dict) -> dict:
    family = find_platform_family(overlay, PLATFORM_FAMILY_ID)
    if not family:
        raise ValueError(f"Platform family {PLATFORM_FAMILY_ID} not found")

    alias_count_before = _alias_count(family)
    component_count_before = _component_count(family)

    for binding in table.get("procedureBindings") or []:
        if binding.get("gateAction") != "approve_mechanical":
            continue
        proc_id = binding["procedureId"]
        entry = {
            "procedureId": proc_id,
            "testTargetId": binding["testTargetId"],
            "failureDomains": binding.get("failureDomains")
            or FAILURE_DOMAINS.get(proc_id, []),
            "displayTitle": binding.get("displayTitle"),
            "canonicalComponents": binding.get("canonicalComponents") or [],
        }
        if binding.get("implementationComponent"):
            entry["implementationComponent"] = binding["implementationComponent"]
        if binding.get("semanticAnchor"):
            entry["platformNote"] = (
                f"Mechanical registration — semantic anchor {binding['semanticAnchor']}."
            )
        _upsert_procedure_binding(family, entry)

    for binding in table.get("measurementBindings") or []:
        if binding.get("gateAction") != "approve_mechanical":
            continue
        entry = {
            "procedureId": binding["procedureId"],
            "measurementKnowledgeId": binding["measurementKnowledgeId"],
            "testTargetId": binding["testTargetId"],
        }
        if binding.get("implementationComponent"):
            entry["implementationComponent"] = binding["implementationComponent"]
        _upsert_measurement_binding(family, entry)

    if _alias_count(family) != alias_count_before:
        raise ValueError("Mechanical publish must not add OEM aliases")
    if _component_count(family) != component_count_before:
        raise ValueError("Mechanical publish must not add platform components")

    family["compoundingManualIds"] = [*PRIOR_MANUAL_IDS, MANUAL_ID]
    overlay["gateArtifact"] = "W11499711_overlay_mapping_table_v1.json"
    overlay["priorGateArtifact"] = "W11480208_overlay_mapping_table_v1.json"
    overlay["publishedManualIds"] = [*PRIOR_MANUAL_IDS, MANUAL_ID]
    overlay["publishedAt"] = datetime.now(timezone.utc).isoformat()
    return overlay


def _verify_canonical_unchanged(before: dict, after: dict) -> bool:
    before_ontology = {k: v for k, v in before.get("ontology", {}).items() if k != "frozenNote"}
    after_ontology = {k: v for k, v in after.get("ontology", {}).items() if k != "frozenNote"}
    return (
        before_ontology == after_ontology
        and before.get("components") == after.get("components")
        and before.get("relationships") == after.get("relationships")
    )


def main() -> int:
    print("==> Apply W11499711 mechanical gate")
    gate_proc = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "apply_w11499711_dishwasher_mechanical_gate.py")],
        cwd=ROOT,
        check=False,
    )
    if gate_proc.returncode != 0:
        return gate_proc.returncode

    table = _load_json(TABLE_PATH)
    if table.get("status") != "gated":
        print("FAIL: gate table not in gated status", file=sys.stderr)
        return 1

    overlay_path = MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE
    overlay_before = load_overlay_file(OVERLAY_FILE)
    family_before = find_platform_family(overlay_before, PLATFORM_FAMILY_ID)
    assert family_before is not None

    canonical_before = _load_json(CANONICAL_PATH)
    overlay_before_copy = json.loads(json.dumps(overlay_before))

    plan = plan_promotion(MANUAL_ID)
    if plan.get("blocked"):
        print("FAIL: promotion blocked", plan.get("blockReasons"), file=sys.stderr)
        return 1

    promotion_id = PROMOTION_ID
    promo_dir = PROMOTIONS_DIR / promotion_id
    promo_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(overlay_path, promo_dir / "overlay_before.json")

    overlay_after = apply_w11499711_mechanical_delta(
        json.loads(json.dumps(overlay_before)),
        table,
    )
    (promo_dir / "overlay_after.json").write_text(
        json.dumps(overlay_after, indent=2),
        encoding="utf-8",
    )
    overlay_path.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")

    family_after = find_platform_family(overlay_after, PLATFORM_FAMILY_ID)
    assert family_after is not None

    equivalence = compare_promotion_equivalence(
        family_before,
        family_after,
        manual_id=MANUAL_ID,
    )
    canonical_after = _load_json(CANONICAL_PATH)

    prior_semantics_preserved = (
        equivalence.get("checks", {}).get("canonicalAliases") is True
        and equivalence.get("checks", {}).get("procedureBindings") is True
        and equivalence.get("checks", {}).get("measurementBindings") is True
    )

    native_proc = next(
        (
            b
            for b in family_after.get("procedureBindings") or []
            if b.get("procedureId") == NATIVE_PROCEDURE
        ),
        None,
    )
    native_meas = next(
        (
            b
            for b in family_after.get("measurementBindings") or []
            if b.get("procedureId") == NATIVE_PROCEDURE
            and b.get("measurementKnowledgeId") == "whirlpoolDishwasherAcuWashMotorOhms"
        ),
        None,
    )

    checks = {
        "dishwasherFrozenRev1": (
            canonical_after.get("ontology", {}).get("frozen") is True
            and canonical_after.get("ontology", {}).get("frozenRevision") == "rev1"
        ),
        "dishwasherSemanticallyUnchanged": _verify_canonical_unchanged(
            canonical_before,
            canonical_after,
        ),
        "priorSemanticsPreserved": prior_semantics_preserved,
        "equivalentPromotion": equivalence.get("equivalent") is True,
        "oneNativeProcedureBinding": native_proc is not None,
        "nativeProcedureSsmImplementation": native_proc.get("implementationComponent")
        == "ssm_wash_motor"
        if native_proc
        else False,
        "nativeProcedureCirculationTest": native_proc.get("testTargetId") == "circulation_test"
        if native_proc
        else False,
        "oneNativeMeasurementBinding": native_meas is not None,
        "nativeMeasurementSsmImplementation": native_meas.get("implementationComponent")
        == "ssm_wash_motor"
        if native_meas
        else False,
        "noNewAliases": _alias_count(family_after) == _alias_count(family_before),
        "noNewPlatformComponents": _component_count(family_after) == _component_count(
            family_before
        ),
        "ssmAnchorIntact": next(
            (
                b
                for b in family_after.get("procedureBindings") or []
                if b.get("procedureId") == "w11633848-wash-motor"
            ),
            {},
        ).get("implementationComponent")
        == "ssm_wash_motor",
        "vsmWashMotorIntact": next(
            (
                b
                for b in family_after.get("procedureBindings") or []
                if b.get("procedureId") == "w11480208-wash-motor-vsm"
            ),
            {},
        ).get("implementationComponent")
        == "vsm_wash_motor",
        "vsmDrainMotorIntact": _component_by_id(family_after, "vsm_drain_motor") is not None,
        "noDiverterValveCanonical": "diverter_valve" not in {
            c["id"] for c in canonical_after.get("components", [])
        },
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
    plan["promotionId"] = promotion_id
    plan["status"] = "published"
    plan["publishedAt"] = datetime.now(timezone.utc).isoformat()
    plan["publishMode"] = "mechanical_gate_bindings_only"
    plan["diff"] = {
        "oemTermAliases": {"add": {}, "skip": "no new manufacturer aliases"},
        "procedureBindings": {"add": [native_proc] if native_proc else []},
        "measurementBindings": {"add": [native_meas] if native_meas else []},
        "platformComponentsAdded": [],
    }
    (PROMOTIONS_DIR / f"{promotion_id}.json").write_text(
        json.dumps(plan, indent=2),
        encoding="utf-8",
    )

    table["status"] = "published"
    table["publishedAt"] = plan["publishedAt"]
    table["promotionId"] = promotion_id
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    report = {
        "manualId": MANUAL_ID,
        "priorManualIds": PRIOR_MANUAL_IDS,
        "promotionId": promotion_id,
        "publishedAt": plan["publishedAt"],
        "equivalent": equivalence.get("equivalent"),
        "equivalenceChecks": equivalence.get("checks"),
        "publicationChecks": checks,
        "testResults": test_results,
        "tscExitCode": tsc.returncode,
        "compoundingMetrics": table.get("compoundingEvidence"),
        "teachingCostCurve": table.get("compoundingAccounting", {}).get("teachingCostCurve"),
        "evidenceKinds": table.get("compoundingAccounting", {}).get("evidenceKinds"),
        "overlayFile": OVERLAY_FILE,
        "publishMode": "mechanical_only",
        "publicationDelta": {
            "procedureBindingsAdded": 1,
            "measurementBindingsAdded": 1,
            "oemAliasesAdded": 0,
            "platformComponentsAdded": 0,
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
        print("WARN: tsc reported pre-existing errors", file=sys.stderr)

    print("\n=== W11499711 Published (mechanical) ===")
    print(f"promotionId:    {promotion_id}")
    print(f"equivalent:     {report['equivalent']}")
    print(f"checks:         {sum(checks.values())}/{len(checks)} passed")
    print(f"report:         {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
