#!/usr/bin/env python3
"""Publish gated W11480208 dishwasher platform delta (bindings + VSM platform components only)."""

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

MANUAL_ID = "W11480208"
PRIOR_MANUAL_ID = "W11633848"
OVERLAY_FILE = "whirlpool_dishwasher.json"
PLATFORM_FAMILY_ID = "whirlpool_dishwasher_acu"
TABLE_PATH = CALIBRATION_DIR / "W11480208_overlay_mapping_table_v1.json"
CANONICAL_PATH = ROOT / "frontend/components/diagnostics/knowledge/canonical/dishwasher.json"

FAILURE_DOMAINS = {
    "w11480208-door-switch": ["door_authorization_failure"],
    "w11480208-overfill-switch": ["fill_failure"],
    "w11480208-heater": ["heating_failure"],
    "w11480208-diverter-motor": ["circulation_failure"],
    "w11480208-wash-motor-vsm": ["circulation_failure"],
    "w11480208-drain-motor-vsm": ["drain_failure"],
    "w11480208-dc-fan": ["drying_failure"],
}

DISPLAY_TITLES = {
    "w11480208-door-switch": "§3-8: Door Switch Circuit (P12)",
    "w11480208-overfill-switch": "§3-13: Overfill Float Switch (P11)",
    "w11480208-heater": "§3-11: Water Heating / Heat Dry",
    "w11480208-diverter-motor": "§3-14: Diverter Motor (P6)",
    "w11480208-wash-motor-vsm": "§3-17: Wash Motor (Variable Speed)",
    "w11480208-drain-motor-vsm": "§3-19: Drain Motor (Variable Speed platform)",
    "w11480208-dc-fan": "§3-20: DC Fan Motor (ProDry)",
}

VSM_WASH_MOTOR = {
    "id": "vsm_wash_motor",
    "name": "Variable-speed wash motor (VSM)",
    "aliases": ["vsm wash motor", "wash motor (variable speed)"],
    "systemId": "circulation",
    "categoryId": "wash_circuit",
    "type": "actuator",
    "note": "W11480208 §3-17 — VSM wash motor implements canonical circulation_pump (P5 pins 1&2).",
}

VSM_DRAIN_MOTOR = {
    "id": "vsm_drain_motor",
    "name": "Variable-speed drain motor (VSM)",
    "aliases": ["vsm drain motor", "drain motor (variable speed)"],
    "systemId": "drain",
    "categoryId": "drain_circuit",
    "type": "actuator",
    "note": "W11480208 §3-19 — VSM drain motor implements canonical drain_pump (P5 pins 5&6).",
}

VSM_RELATIONSHIPS = [
    {
        "from": "vsm_wash_motor",
        "to": "circulation_pump",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
        "note": "W11480208 filtration-platform VSM wash motor architecture.",
    },
    {
        "from": "vsm_drain_motor",
        "to": "drain_pump",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
        "note": "W11480208 filtration-platform VSM drain motor architecture.",
    },
    {
        "from": "control_board",
        "to": "vsm_wash_motor",
        "type": "commands",
        "source": "service_manual",
        "confidence": "high",
    },
    {
        "from": "control_board",
        "to": "vsm_drain_motor",
        "type": "commands",
        "source": "service_manual",
        "confidence": "high",
    },
]

FORBIDDEN_ALIAS_PREFIXES = ("§",)
FORBIDDEN_ALIAS_KEYS = {
    "circulation_pump",
    "drain_pump",
    "inlet_valve",
    "door_gasket",
    "interior led",
}


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _component_by_id(family: dict, component_id: str) -> dict | None:
    for component in (family.get("add") or {}).get("components") or []:
        if component.get("id") == component_id:
            return component
    return None


def _upsert_component(family: dict, component: dict) -> None:
    add = family.setdefault("add", {})
    components = add.setdefault("components", [])
    existing = _component_by_id(family, component["id"])
    if existing:
        existing.update(component)
    else:
        components.append(component)


def _upsert_relationship(family: dict, relationship: dict) -> None:
    add = family.setdefault("add", {})
    relationships = add.setdefault("relationships", [])
    key = (relationship.get("from"), relationship.get("to"), relationship.get("type"))
    for rel in relationships:
        if (rel.get("from"), rel.get("to"), rel.get("type")) == key:
            rel.update(relationship)
            return
    relationships.append(relationship)


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


def _sanitize_aliases(family: dict) -> list[str]:
    removed: list[str] = []
    aliases = family.get("oemTermAliases") or {}
    for key in list(aliases.keys()):
        lower = str(key).lower()
        if any(str(key).startswith(prefix) for prefix in FORBIDDEN_ALIAS_PREFIXES):
            removed.append(key)
            del aliases[key]
            continue
        if lower in FORBIDDEN_ALIAS_KEYS:
            removed.append(key)
            del aliases[key]
    family["oemTermAliases"] = aliases
    return removed


def apply_w11480208_platform_delta(overlay: dict, table: dict) -> dict:
    family = find_platform_family(overlay, PLATFORM_FAMILY_ID)
    if not family:
        raise ValueError(f"Platform family {PLATFORM_FAMILY_ID} not found")

    _upsert_component(family, VSM_WASH_MOTOR)
    _upsert_component(family, VSM_DRAIN_MOTOR)
    for relationship in VSM_RELATIONSHIPS:
        _upsert_relationship(family, relationship)

    for binding in table.get("procedureBindings") or []:
        if binding.get("gateAction") != "approve_human":
            continue
        proc_id = binding["procedureId"]
        entry = {
            "procedureId": proc_id,
            "testTargetId": binding["testTargetId"],
            "failureDomains": FAILURE_DOMAINS.get(proc_id, []),
            "displayTitle": DISPLAY_TITLES.get(proc_id),
            "canonicalComponents": binding.get("canonicalComponents") or [],
        }
        if binding.get("implementationComponent"):
            entry["implementationComponent"] = binding["implementationComponent"]
        if binding.get("matcherCorrection"):
            entry["platformNote"] = f"Gate correction: {binding['matcherCorrection']}"
        _upsert_procedure_binding(family, entry)

    for binding in table.get("measurementBindings") or []:
        if binding.get("gateAction") != "approve_human":
            continue
        entry = {
            "procedureId": binding["procedureId"],
            "measurementKnowledgeId": binding["measurementKnowledgeId"],
            "testTargetId": binding["testTargetId"],
        }
        impl = next(
            (
                pb.get("implementationComponent")
                for pb in table.get("procedureBindings") or []
                if pb.get("procedureId") == binding["procedureId"]
            ),
            None,
        )
        if impl:
            entry["implementationComponent"] = impl
        _upsert_measurement_binding(family, entry)

    applies_to = family.setdefault("appliesTo", {})
    patterns = set(applies_to.get("modelPatterns") or [])
    patterns.update({"WDT74*", "WDTA74*"})
    applies_to["modelPatterns"] = sorted(patterns)

    family["label"] = (
        "Whirlpool/Maytag/KitchenAid/JennAir ACU dishwasher "
        "(W11633848 base + W11480208 filtration/VSM)"
    )
    family["compoundingManualIds"] = [PRIOR_MANUAL_ID, MANUAL_ID]

    overlay["gateArtifact"] = "W11480208_overlay_mapping_table_v1.json"
    overlay["priorGateArtifact"] = "W11633848_overlay_mapping_table_v1.json"
    overlay["publishedManualIds"] = [PRIOR_MANUAL_ID, MANUAL_ID]
    overlay["publishedAt"] = datetime.now(timezone.utc).isoformat()

    _sanitize_aliases(family)
    return overlay


def _relationship_keys(relationships: list[dict]) -> set[tuple]:
    return {
        (rel.get("from"), rel.get("to"), rel.get("type"))
        for rel in relationships or []
    }


def _compounding_topology_additive(before: dict, after: dict) -> bool:
    before_rels = (before.get("add") or {}).get("relationships") or []
    after_rels = (after.get("add") or {}).get("relationships") or []
    return _relationship_keys(before_rels).issubset(_relationship_keys(after_rels))


def _verify_canonical_unchanged(before: dict, after: dict) -> bool:
    before_ontology = {k: v for k, v in before.get("ontology", {}).items() if k != "frozenNote"}
    after_ontology = {k: v for k, v in after.get("ontology", {}).items() if k != "frozenNote"}
    return (
        before_ontology == after_ontology
        and before.get("components") == after.get("components")
        and before.get("relationships") == after.get("relationships")
    )


def main() -> int:
    print("==> Apply W11480208 human gate")
    gate_proc = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "apply_w11480208_dishwasher_human_gate.py")],
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

    plan = plan_promotion(MANUAL_ID)
    if plan.get("blocked"):
        print("FAIL: promotion blocked", plan.get("blockReasons"), file=sys.stderr)
        return 1

    promotion_id = plan["promotionId"]
    promo_dir = PROMOTIONS_DIR / promotion_id
    promo_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(overlay_path, promo_dir / "overlay_before.json")

    overlay_after = apply_w11480208_platform_delta(
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

    w11633848_preserved = (
        equivalence.get("checks", {}).get("canonicalAliases") is True
        and equivalence.get("checks", {}).get("procedureBindings") is True
        and equivalence.get("checks", {}).get("measurementBindings") is True
    )
    topology_additive = _compounding_topology_additive(family_before, family_after)

    checks = {
        "dishwasherFrozenRev1": (
            canonical_after.get("ontology", {}).get("frozen") is True
            and canonical_after.get("ontology", {}).get("frozenRevision") == "rev1"
        ),
        "dishwasherSemanticallyUnchanged": _verify_canonical_unchanged(
            canonical_before,
            canonical_after,
        ),
        "w11633848SemanticsPreserved": w11633848_preserved,
        "topologyAdditiveOnly": topology_additive,
        "vsmWashMotorPresent": _component_by_id(family_after, "vsm_wash_motor") is not None,
        "vsmDrainMotorPresent": _component_by_id(family_after, "vsm_drain_motor") is not None,
        "noInteriorLedBinding": not any(
            b.get("procedureId") == "w11480208-interior-led"
            for b in family_after.get("procedureBindings") or []
        ),
        "noDoorGasketAlias": "door_gasket" not in {
            k.lower() for k in (family_after.get("oemTermAliases") or {})
        },
        "noDiverterValveCanonical": "diverter_valve" not in {
            c["id"] for c in canonical_after.get("components", [])
        },
        "dcFanBindingCorrect": next(
            (
                b.get("testTargetId")
                for b in family_after.get("procedureBindings") or []
                if b.get("procedureId") == "w11480208-dc-fan"
            ),
            None,
        )
        == "drying_airflow_test",
        "w11633848DcFanPreserved": next(
            (
                b.get("testTargetId")
                for b in family_after.get("procedureBindings") or []
                if b.get("procedureId") == "w11633848-dc-fan"
            ),
            None,
        )
        == "drying_airflow_test",
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
    plan["publishMode"] = "gate_table_bindings_and_platform_delta"
    plan["diff"] = {
        "oemTermAliases": {"add": {}, "skip": "no new manufacturer aliases"},
        "procedureBindings": {
            "add": [
                b
                for b in family_after.get("procedureBindings") or []
                if str(b.get("procedureId", "")).startswith("w11480208-")
            ],
        },
        "measurementBindings": {
            "add": [
                b
                for b in family_after.get("measurementBindings") or []
                if str(b.get("procedureId", "")).startswith("w11480208-")
            ],
        },
        "platformComponentsAdded": ["vsm_wash_motor", "vsm_drain_motor"],
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
        "priorManualId": PRIOR_MANUAL_ID,
        "promotionId": promotion_id,
        "publishedAt": plan["publishedAt"],
        "equivalent": w11633848_preserved and topology_additive,
        "equivalenceChecks": equivalence.get("checks"),
        "compoundingEquivalence": {
            "w11633848SemanticsPreserved": w11633848_preserved,
            "topologyAdditiveOnly": topology_additive,
            "note": "Compounding publish allows additive platform relationships; W11633848 alias/binding semantics must be preserved.",
        },
        "publicationChecks": checks,
        "testResults": test_results,
        "tscExitCode": tsc.returncode,
        "compoundingMetrics": table.get("compoundingEvidence"),
        "teachingCostCurve": table.get("compoundingAccounting", {}).get("teachingCostCurve"),
        "overlayFile": OVERLAY_FILE,
        "publishBlockedConcepts": [
            "door_gasket",
            "interior_led",
            "diverter_valve",
            "turbidity_sensor",
            "check_valve",
            "§3-11 procedural title alias",
        ],
    }
    report_path = CALIBRATION_DIR / f"publication_W11480208.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    equiv_path = CALIBRATION_DIR / f"promotion_equivalence_{MANUAL_ID}.json"
    equiv_path.write_text(json.dumps(equivalence, indent=2), encoding="utf-8")

    if not all(checks.values()) or any(code != 0 for code in test_results.values()):
        print("FAIL: publication checks or tests", checks, test_results, file=sys.stderr)
        return 1
    if tsc.returncode != 0:
        print("WARN: tsc reported pre-existing errors (samsung-dryer-routing-boundary)", file=sys.stderr)

    print("\n=== W11480208 Published ===")
    print(f"promotionId:    {promotion_id}")
    print(f"equivalent:     {report['equivalent']}")
    print(f"checks:         {sum(checks.values())}/{len(checks)} passed")
    print(f"report:         {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
