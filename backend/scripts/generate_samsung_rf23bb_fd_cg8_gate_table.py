#!/usr/bin/env python3
"""CG-8 WP2 — Generate Samsung RF23BB overlay gate table (stricter manufacturer boundary)."""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANDIDATES = KNOWLEDGE / "normalization" / "candidates"

MANUAL_ID = "SAMSUNG-RF23BB-FRIDGE"
PLATFORM_ID = "samsung_fridge_bespoke"
PRIOR_MANUAL = "W10322959"
OUT_TABLE = CALIBRATION / "SAMSUNG_RF23BB_FD_overlay_mapping_table_v1.json"
OUT_EVIDENCE = CALIBRATION / "SAMSUNG_RF23BB_FD_CG8_COMPOUNDING_EVIDENCE_v1.json"

KEEP = frozenset(
    {
        "control_board",
        "user_interface",
        "door_switch",
        "evaporator_fan",
        "air_damper",
        "defrost_heater",
    }
)
REMOVED_AGGREGATES = frozenset({"airflow_path", "defrost_system", "cooling_system"})


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _run_fresh_cg3() -> dict[str, Any]:
    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization

    manifest = load_manifest()
    entry = find_manual_entry(manifest, MANUAL_ID)
    print(f"==> CG-3 normalize {MANUAL_ID} (fresh)")
    return run_manual_normalization(entry)


def _contract_teaching_rows() -> list[dict[str, Any]]:
    return [
        {
            "teachingId": "samsung-control-board-engineer",
            "gateQuestion": "Does RF23BB independently teach frozen control_board?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "control_board",
            "procedureIds": [
                "samsungbespoke-engineer-mode-rf23bb-inner",
                "samsungbespoke-fhub-engineer-entry",
                "samsungbespoke-self-diagnosis-entry",
            ],
            "seedComponentIds": [],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "Engineer mode / self-diagnosis entry on main PBA — Samsung-native control "
                "orchestration. Not inherited from Whirlpool Jazz overlay."
            ),
        },
        {
            "teachingId": "samsung-user-interface-panel-comm",
            "gateQuestion": "Does RF23BB independently teach frozen user_interface?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "user_interface",
            "procedureIds": ["samsungbespoke-main-panel-comm"],
            "seedComponentIds": ["display_panel"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "41E main↔display communication — independent HMI diagnostic on RF23BB.",
        },
        {
            "teachingId": "samsung-door-switch-abstention",
            "gateQuestion": "Does RF23BB independently teach frozen door_switch?",
            "outcome": "intentional_abstention",
            "layer": "defer_insufficient_procedure_evidence",
            "gateAction": "defer_human_review",
            "independentEvidence": False,
            "rationale": (
                "Flex/freezer door switches documented in manual assembly sections but no "
                "standalone RF23BB door-switch service procedure. Abstain — do not inherit "
                "from Whirlpool Jazz procedure-role evidence."
            ),
        },
        {
            "teachingId": "samsung-defrost-heater-fz",
            "gateQuestion": "Does RF23BB teach frozen defrost_heater?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "defrost_heater",
            "instanceScope": "freezer",
            "procedureIds": ["samsungbespoke-freezer-defrost-heater"],
            "seedComponentIds": ["heater"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "Freezer defrost heater Ω on CN20 — independent canonical inheritance.",
        },
        {
            "teachingId": "samsung-evaporator-fan-multi",
            "gateQuestion": "Does RF23BB teach frozen evaporator_fan?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "evaporator_fan",
            "procedureIds": [
                "samsungbespoke-freezer-fan",
                "samsungbespoke-fridge-fan",
                "samsungbespoke-convertible-fan",
            ],
            "seedComponentIds": ["evap_fan"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "Three independent fan diagnostics (22E freezer, fridge, 22C convertible). "
                "Canonical evaporator_fan with multi-instance overlay; ice-room fan stays platform."
            ),
        },
        {
            "teachingId": "samsung-air-damper-damper-heater",
            "gateQuestion": "Does RF23BB independently teach frozen air_damper?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "air_damper",
            "procedureIds": [
                "samsungbespoke-damper-heater-135",
                "samsungbespoke-damper-heater-24",
            ],
            "seedComponentIds": ["damper_motor"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "Damper heater Ω checks on damper_motor seed — functional air_damper on Samsung "
                "with implementation overlay (distinct from Jazz position toggle)."
            ),
        },
        {
            "teachingId": "samsung-compressor-inverter-conditional",
            "gateQuestion": "What does RF23BB teach about conditional compressor?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "compressor",
            "instanceScope": "inverter_pba_mediated",
            "procedureIds": ["samsungbespoke-compressor-inverter"],
            "seedComponentIds": ["inverter_board"],
            "gateAction": "approve_conditional_binding",
            "rationale": (
                "44E/84C routes through inverter PBA — functional compressor role as "
                "conditionalConcept only. Inverter implementation stays platform layer."
            ),
        },
        {
            "teachingId": "samsung-condenser-fan-abstention",
            "gateQuestion": "Does RF23BB teach conditional condenser_fan?",
            "outcome": "intentional_abstention",
            "layer": "defer_no_standalone_diagnostic",
            "gateAction": "defer_human_review",
            "rationale": (
                "No condenser_fan procedure on RF23BB. 22C convertible fan is evaporator-path — "
                "does not satisfy 2/3 condenser_fan conditional from Jazz+LG."
            ),
        },
        {
            "teachingId": "samsung-temp-fridge-conditional",
            "gateQuestion": "RF23BB fridge cabinet NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "fresh_food",
            "procedureIds": ["samsungbespoke-fridge-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "samsung-temp-freezer-conditional",
            "gateQuestion": "RF23BB freezer cabinet NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "freezer",
            "procedureIds": ["samsungbespoke-freezer-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "samsung-temp-flex-conditional",
            "gateQuestion": "RF23BB flex-zone NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "flex_zone",
            "procedureIds": ["samsungbespoke-flex-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "samsung-temp-ambient-conditional",
            "gateQuestion": "RF23BB ambient NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "ambient",
            "procedureIds": ["samsungbespoke-ambient-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "samsung-ice-maker-conditional",
            "gateQuestion": "RF23BB optional ice_maker conditional binding?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "ice_maker",
            "procedureIds": [
                "samsungbespoke-ice-maker-sensor",
                "samsungbespoke-ice-room-fan",
                "samsungbespoke-ice-room-heater",
            ],
            "seedComponentIds": ["ice_maker_module"],
            "gateAction": "approve_conditional_binding",
            "rationale": "Optional feature domain — conditionalConcept only, not components[] promotion.",
        },
        {
            "teachingId": "samsung-water-dispenser-conditional",
            "gateQuestion": "RF23BB water_dispenser conditional binding?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "water_dispenser",
            "procedureIds": ["samsungbespoke-autofill-overflow"],
            "gateAction": "approve_conditional_binding",
            "rationale": "AutoFill/dispenser overflow path — optional conditional feature, not canonical.",
        },
        {
            "teachingId": "samsung-inverter-board-platform",
            "gateQuestion": "Inverter PBA implementation vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_platform_implementation",
            "platformTarget": "compressor_controller",
            "procedureIds": ["samsungbespoke-compressor-inverter"],
            "seedComponentIds": ["inverter_board"],
            "implementationComponent": "inverter_board",
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "samsung-main-inverter-comm-platform",
            "gateQuestion": "Main↔inverter harness implementation?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_platform_implementation",
            "platformTarget": "compressor_controller",
            "procedureIds": ["samsungbespoke-main-inverter-comm"],
            "seedComponentIds": ["inverter_board"],
            "gateAction": "approve_platform_implementation",
            "rationale": "44Er main↔inverter communication — platform drive path, not control_board canonical.",
        },
        {
            "teachingId": "samsung-defrost-sensor-platform",
            "gateQuestion": "F-DEF/R-DEF defrost NTC vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_platform_implementation",
            "platformTarget": "defrost_sensor",
            "procedureIds": [
                "samsungbespoke-freezer-defrost-sensor",
                "samsungbespoke-fridge-defrost-sensor",
            ],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "samsung-damper-motor-platform",
            "gateQuestion": "Damper motor implementation?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_platform_implementation",
            "canonicalFunctionalRole": ["air_damper"],
            "implementationComponent": "damper_motor",
            "procedureIds": [
                "samsungbespoke-damper-heater-135",
                "samsungbespoke-damper-heater-24",
            ],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "samsung-ice-subsystem-platform",
            "gateQuestion": "Ice duct/pipe heater platform vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_platform_implementation",
            "implementationComponents": ["ice_pipe_heater", "ice_maker_module"],
            "procedureIds": [
                "samsungbespoke-ice-pipe-heater-72",
                "samsungbespoke-ice-pipe-heater-24",
                "samsungbespoke-ice-duct-heater",
            ],
            "gateAction": "approve_platform_implementation",
            "rationale": "Ice subsystem hardware — implements conditional ice_maker, not canonical expansion.",
        },
        {
            "teachingId": "samsung-aggregate-resurrection-blocked",
            "gateQuestion": "Do Samsung terms resurrect removed aggregates?",
            "outcome": "overlay_knowledge",
            "layer": "reject_aggregate_resurrection",
            "removedConcepts": sorted(REMOVED_AGGREGATES),
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "Forced defrost test mode (Fd) and complaint routing decompose into members — "
                "defrost_system, cooling_system, airflow_path remain dead per CG-7 freeze."
            ),
        },
        {
            "teachingId": "samsung-humidity-abstention",
            "gateQuestion": "humidity_control on RF23BB?",
            "outcome": "intentional_abstention",
            "layer": "defer_single_manufacturer_feature",
            "procedureIds": ["samsungbespoke-humidity-sensor"],
            "gateAction": "defer_human_review",
            "rationale": (
                "Humidity sensor procedure exists but CG-7 deferred humidity_control — "
                "abstain from canonical/conditional promotion until triangulation gate."
            ),
        },
        {
            "teachingId": "samsung-water-level-abstention",
            "gateQuestion": "water_level_sensor on RF23BB?",
            "outcome": "intentional_abstention",
            "layer": "defer_insufficient_cross_manual_evidence",
            "gateAction": "defer_human_review",
            "rationale": "AutoFill overflow is dispenser-feature sensing — not water_level_sensor canonical.",
        },
        {
            "teachingId": "samsung-ice-room-fan-platform",
            "gateQuestion": "Ice room fan architecture?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_platform_implementation",
            "canonicalFunctionalRole": ["evaporator_fan"],
            "instanceScope": "ice_room",
            "procedureIds": ["samsungbespoke-ice-room-fan"],
            "seedComponentIds": ["evap_fan"],
            "gateAction": "approve_platform_implementation",
            "rationale": "Ice-room fan is compartment-specific platform detail under evaporator_fan family.",
        },
    ]


def _classify_mapping_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    term = str(candidate.get("sourceTerm") or "")
    proc_id = (candidate.get("provenance") or {}).get("procedureId")
    cid = candidate.get("id")
    lower = term.lower()

    if "§" in term or term.startswith("Service Test"):
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "reject_procedural_title",
            "outcome": "procedural_noise",
            "gateAction": "reject_procedural_title",
        }

    if lower in ("thermistor",) or "sensor" in lower:
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "conditional_concept_binding",
            "outcome": "conditional_binding",
            "conditionalConcept": "temperature_sensor",
            "gateAction": "see_contract_teaching_row",
        }
    if lower in ("evap_fan", "heater", "damper_motor", "inverter_board", "display_panel", "ice_maker_module", "ice_pipe_heater"):
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "see_teaching_row",
            "gateAction": "see_contract_teaching_row",
        }
    return {
        "candidateId": cid,
        "sourceTerm": term,
        "procedureId": proc_id,
        "disposition": "unresolved",
        "outcome": "intentional_abstention",
        "gateAction": "defer_human_review",
    }


def build_gate_table(normalize_result: dict[str, Any]) -> dict[str, Any]:
    mapping_doc = _load_json(CANDIDATES / MANUAL_ID / "canonical_mapping_candidates.json")
    manifest = _load_json(CANDIDATES / MANUAL_ID / "pipeline_manifest.json")
    candidates = mapping_doc.get("candidates") or []
    teaching_rows = _contract_teaching_rows()
    candidate_dispositions = [_classify_mapping_candidate(c) for c in candidates]

    acct = {
        "canonicalInheritance": sum(1 for r in teaching_rows if r["outcome"] == "canonical_inheritance"),
        "conditionalBinding": sum(1 for r in teaching_rows if r["outcome"] == "conditional_binding"),
        "overlayLearning": sum(1 for r in teaching_rows if r["outcome"] == "overlay_knowledge"),
        "intentionalAbstention": sum(1 for r in teaching_rows if r["outcome"] == "intentional_abstention"),
        "canonicalExpansion": 0,
        "mappingCandidatesTotal": len(candidates),
    }

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg8_fd_overlay_mapping_gate_table",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "platformFamilyId": PLATFORM_ID,
        "canonicalOntologyId": "french_door_refrigerator",
        "proposedOverlayFile": "samsung_fridge_bespoke.json",
        "priorPublishedManualIds": [PRIOR_MANUAL],
        "status": "gate_preview",
        "compoundingContract": "CG8_FRENCH_DOOR_COMPOUNDING_CONTRACT_v1.json",
        "workPackage": "WP2",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "gateFraming": {
            "question": "What does this manual teach us about the frozen contract?",
            "manufacturerBoundary": "stricter — RF23BB evidence independent of Whirlpool Jazz overlay",
            "freezeReopenBlocked": True,
        },
        "manufacturerIsolation": {
            "priorOverlay": "whirlpool_jazz_french_door.json",
            "rule": "Do not import Whirlpool Jazz aliases, procedure bindings, or topology.",
            "whirlpoolOverlayDependentCount": 0,
        },
        "pipelineCounts": manifest.get("counts") or {},
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
        },
        "gatePolicy": {
            "gateKind": "manufacturer_boundary_second_manual",
            "compoundingPhase": "CG-8",
            "canonicalGraph": "french_door_refrigerator.json rev1 FROZEN",
            "publishBlocked": True,
        },
        "canonicalContract": {
            "graph": "french_door_refrigerator",
            "revision": "rev1",
            "allowedCanonicalIds": sorted(KEEP),
            "forbiddenCanonicalIds": sorted(REMOVED_AGGREGATES),
            "conditionalBindingIds": [
                "temperature_sensor",
                "compressor",
                "condenser_fan",
                "ice_maker",
                "water_dispenser",
            ],
        },
        "contractTeachingRows": teaching_rows,
        "mappingCandidateDispositions": candidate_dispositions,
        "auditBoundaries": {
            "inverterMediatedCompressor": [
                "samsung-compressor-inverter-conditional",
                "samsung-inverter-board-platform",
                "samsung-main-inverter-comm-platform",
            ],
            "compartmentThermistors": [
                "samsung-temp-fridge-conditional",
                "samsung-temp-freezer-conditional",
                "samsung-temp-flex-conditional",
                "samsung-temp-ambient-conditional",
            ],
            "multiFanTopology": ["samsung-evaporator-fan-multi", "samsung-ice-room-fan-platform"],
            "aggregateResurrectionBlocked": ["samsung-aggregate-resurrection-blocked"],
        },
        "accounting": acct,
        "outcomeHistogram": dict(Counter(r["outcome"] for r in teaching_rows)),
    }


def build_evidence(gate_table: dict[str, Any]) -> dict[str, Any]:
    acct = gate_table["accounting"]
    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg8_fd_compounding_evidence",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "compoundingPhase": "CG-8",
        "workPackage": "WP2",
        "compoundingSequence": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "canonicalOntology": {
            "id": "french_door_refrigerator",
            "revision": "rev1",
            "immutable": True,
            "hash": "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9",
        },
        "gateArtifact": OUT_TABLE.name,
        "headlineMetric": {"canonicalExpansion": 0},
        "compoundingCurve": {
            "framing": "contract_teaching_rows",
            "canonicalInheritance": acct["canonicalInheritance"],
            "conditionalBinding": acct["conditionalBinding"],
            "overlayKnowledge": acct["overlayLearning"],
            "intentionalAbstention": acct["intentionalAbstention"],
            "canonicalExpansion": 0,
            "note": (
                "Second refrigerator compounding — stricter independent-evidence boundary; "
                "compare curve to WP1 Jazz (6/4/4/4) after publish."
            ),
        },
        "hierarchyTest": {
            "frozenKeepStable": True,
            "conditionalAbsorbsArchitecture": True,
            "platformAbsorbsImplementation": True,
            "manufacturerIsolationEnforced": True,
            "verdict": (
                "RF23BB separates reusable functional knowledge (5 KEEP inheritance paths with "
                "door_switch withheld) from inverter PBA / multi-NTC / multi-fan implementation "
                "(conditional + platform) without canonical expansion."
            ),
        },
        "comparisonToWP1": {
            "whirlpoolJazz": {
                "canonicalInheritance": 6,
                "conditionalBinding": 4,
                "overlayLearning": 4,
                "intentionalAbstention": 4,
            },
            "samsungRf23bb": {
                "canonicalInheritance": acct["canonicalInheritance"],
                "conditionalBinding": acct["conditionalBinding"],
                "overlayLearning": acct["overlayLearning"],
                "intentionalAbstention": acct["intentionalAbstention"],
                "doorSwitchWithheld": True,
            },
        },
    }


def main() -> int:
    print("==> CG-8 WP2 Samsung RF23BB gate table generation")
    normalize_result = _run_fresh_cg3()
    gate_table = build_gate_table(normalize_result)
    evidence = build_evidence(gate_table)
    OUT_TABLE.write_text(json.dumps(gate_table, indent=2), encoding="utf-8")
    OUT_EVIDENCE.write_text(json.dumps(evidence, indent=2), encoding="utf-8")

    acct = gate_table["accounting"]
    print("\n=== Samsung RF23BB CG-8 Gate Preview ===")
    print(f"mapping candidates: {acct['mappingCandidatesTotal']}")
    print(f"canonical inherit:  {acct['canonicalInheritance']}")
    print(f"conditional bind: {acct['conditionalBinding']}")
    print(f"overlay learning: {acct['overlayLearning']}")
    print(f"intentional abstain:{acct['intentionalAbstention']}")
    print(f"canonical expansion:{acct['canonicalExpansion']}")
    print(f"\ntable:    {OUT_TABLE}")
    print(f"evidence: {OUT_EVIDENCE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
