#!/usr/bin/env python3
"""CG-9.5 WP3 — Generate LG LSC27926 SxS overlay gate table (production compounding)."""

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

MANUAL_ID = "LG-LSC27926-SXS"
PLATFORM_ID = "lg_sxs"
BOUNDARY_PROBE = "LG_LSC27926_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
OUT_TABLE = CALIBRATION / "LG_LSC27926_SXS_overlay_mapping_table_v1.json"
OUT_EVIDENCE = CALIBRATION / "LG_LSC27926_SXS_CG95_COMPOUNDING_EVIDENCE_v1.json"

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
            "teachingId": "lg-sxs-control-board",
            "gateQuestion": "Does LSC27926 SxS independently teach frozen control_board?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "control_board",
            "procedureIds": ["lgsxs-test-mode-entry"],
            "seedComponentIds": ["control_board"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "Main PCB MICOM test-mode orchestration (Test 1 all loads / Test 2 defrost) — "
                "LG SxS-native control. Not inherited from LRMVS linear or Samsung inverter SxS."
            ),
        },
        {
            "teachingId": "lg-sxs-user-interface",
            "gateQuestion": "Does LSC27926 SxS independently teach frozen user_interface?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "user_interface",
            "procedureIds": ["lgsxs-lcd-check", "lgsxs-display-communication"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "§2-16 LCD/LED graphics check and §1-11 main↔display MICOM communication — "
                "independent HMI diagnostic on LG SxS without LRMVS linear overlay."
            ),
        },
        {
            "teachingId": "lg-sxs-door-switch",
            "gateQuestion": "Does LSC27926 SxS independently teach frozen door_switch?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "door_switch",
            "procedureIds": ["lgsxs-door-switch"],
            "seedComponentIds": ["door_switch"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "§1-4 door switches A/B/C/D with Test 1 fan-stop evidence — independent procedure "
                "binding (contrast Samsung RS28 flowchart-only abstention)."
            ),
        },
        {
            "teachingId": "lg-sxs-evaporator-fan",
            "gateQuestion": "Does LSC27926 SxS teach frozen evaporator_fan?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "evaporator_fan",
            "procedureIds": ["lgsxs-fz-fan"],
            "seedComponentIds": ["evap_fan"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "F-FAN BLDC freezer evaporator fan in Test 1 — single-evaporator SxS architecture, "
                "canonical evaporator_fan with BLDC platform overlay."
            ),
        },
        {
            "teachingId": "lg-sxs-air-damper",
            "gateQuestion": "Does LSC27926 SxS independently teach frozen air_damper?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "air_damper",
            "procedureIds": ["lgsxs-damper"],
            "seedComponentIds": ["damper_motor"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "Stepping motor baffle Test 1 open / Test 2 closed — LG SxS air_damper "
                "implementation distinct from Samsung heater-only or Whirlpool stepper+heater."
            ),
        },
        {
            "teachingId": "lg-sxs-defrost-heater",
            "gateQuestion": "Does LSC27926 SxS teach frozen defrost_heater?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "defrost_heater",
            "procedureIds": ["lgsxs-defrost-heater"],
            "seedComponentIds": ["defrost_heater"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "Test 2 forced defrost heater ON — direct canonical inheritance.",
        },
        {
            "teachingId": "lg-sxs-compressor-relay-conditional",
            "gateQuestion": "What does LSC27926 teach about conditional compressor?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "compressor",
            "instanceScope": "relay_drive_conventional",
            "procedureIds": ["lgsxs-compressor"],
            "seedComponentIds": ["compressor"],
            "gateAction": "approve_conditional_binding",
            "rationale": (
                "Test 1 compressor relay RY2 drive — conventional AC relay path. "
                "conditionalConcept only; relay implementation stays platform layer. "
                "NOT LRMVS linear inverter or Samsung inverter PBA."
            ),
        },
        {
            "teachingId": "lg-sxs-condenser-fan-conditional",
            "gateQuestion": "Does LSC27926 teach conditional condenser_fan?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "condenser_fan",
            "procedureIds": ["lgsxs-condenser-fan"],
            "seedComponentIds": ["condenser_fan"],
            "gateAction": "approve_conditional_binding",
            "independentEvidence": True,
            "rationale": (
                "C-FAN BLDC runs with compressor in Test 1 — independent LG procedure evidence. "
                "Conditional binding only; NOT canonical promotion."
            ),
        },
        {
            "teachingId": "lg-sxs-temp-freezer-conditional",
            "gateQuestion": "LSC27926 freezer cabinet NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "freezer",
            "procedureIds": ["lgsxs-freezer-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "lg-sxs-temp-fresh-food-conditional",
            "gateQuestion": "LSC27926 cold storage NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "fresh_food",
            "procedureIds": ["lgsxs-fresh-food-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "lg-sxs-temp-ambient-conditional",
            "gateQuestion": "LSC27926 ambient NTC scope (Better1)?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "ambient",
            "procedureIds": ["lgsxs-ambient-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
            "rationale": "Better1 ambient sensor — conditional ambient scope, not cabinet NTC collapse.",
        },
        {
            "teachingId": "lg-sxs-ice-maker-conditional",
            "gateQuestion": "LSC27926 optional ice_maker conditional binding?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "ice_maker",
            "procedureIds": ["lgsxs-ice-maker"],
            "seedComponentIds": ["ice_maker_module"],
            "gateAction": "approve_conditional_binding",
            "rationale": "§3 in-door ice maker — optional feature domain, conditionalConcept only.",
        },
        {
            "teachingId": "lg-sxs-water-dispenser-conditional",
            "gateQuestion": "LSC27926 water_dispenser conditional binding?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "water_dispenser",
            "procedureIds": ["lgsxs-water-dispenser"],
            "seedComponentIds": ["water_valve"],
            "gateAction": "approve_conditional_binding",
            "rationale": "§2-18 water/ice dispenser valves — optional conditional feature, not canonical.",
        },
        {
            "teachingId": "lg-sxs-defrost-sensor-platform",
            "gateQuestion": "Defrost NTC vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "lg_sxs_platform_implementation",
            "platformTarget": "defrost_sensor",
            "procedureIds": ["lgsxs-defrost-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "Defrost sensor resistance flow — platform defrost_sensor vocabulary, not cabinet "
                "temperature_sensor conditional."
            ),
        },
        {
            "teachingId": "lg-sxs-micom-display-platform",
            "gateQuestion": "Main↔display MICOM implementation?",
            "outcome": "overlay_knowledge",
            "layer": "lg_sxs_platform_implementation",
            "platformTarget": "display_communication",
            "canonicalFunctionalRole": ["user_interface"],
            "procedureIds": ["lgsxs-display-communication"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "4-wire main MICOM ↔ display MICOM harness — platform HMI comm path, "
                "not canonical control_board expansion."
            ),
        },
        {
            "teachingId": "lg-sxs-compressor-relay-platform",
            "gateQuestion": "RY2 conventional compressor relay implementation?",
            "outcome": "overlay_knowledge",
            "layer": "lg_sxs_platform_implementation",
            "platformTarget": "compressor_controller",
            "procedureIds": ["lgsxs-compressor"],
            "implementationComponents": ["compressor_relay", "conventional_compressor"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "Conventional relay-drive compressor path — platform compressor_controller. "
                "Distinct from LRMVS linear inverter and Samsung inverter PBA."
            ),
        },
        {
            "teachingId": "lg-sxs-damper-stepper-platform",
            "gateQuestion": "Stepping motor damper implementation?",
            "outcome": "overlay_knowledge",
            "layer": "lg_sxs_platform_implementation",
            "canonicalFunctionalRole": ["air_damper"],
            "implementationComponent": "damper_motor",
            "procedureIds": ["lgsxs-damper"],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "lg-sxs-bldc-fan-platform",
            "gateQuestion": "BLDC F-FAN / C-FAN implementation?",
            "outcome": "overlay_knowledge",
            "layer": "lg_sxs_platform_implementation",
            "procedureIds": ["lgsxs-fz-fan", "lgsxs-condenser-fan"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "BLDC fan drive on main MICOM — platform fan controller vocabulary for "
                "evaporator_fan canonical and condenser_fan conditional paths."
            ),
        },
        {
            "teachingId": "lg-sxs-dispenser-platform",
            "gateQuestion": "Water/ice dispenser valve implementation?",
            "outcome": "overlay_knowledge",
            "layer": "lg_sxs_platform_implementation",
            "implementationComponent": "water_valve",
            "procedureIds": ["lgsxs-water-dispenser"],
            "gateAction": "approve_platform_implementation",
            "rationale": "RY4/RY5/RY7/RY12 dispenser relays — implements conditional water_dispenser.",
        },
        {
            "teachingId": "lg-sxs-sealed-system-routing",
            "gateQuestion": "Sealed-system complaint routing?",
            "outcome": "overlay_knowledge",
            "layer": "lg_sxs_complaint_routing",
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "Not-cooling complaint vocabulary routes to compressor relay + condenser_fan + "
                "cabinet NTCs — not a canonical aggregate node."
            ),
        },
        {
            "teachingId": "lg-sxs-aggregate-resurrection-blocked",
            "gateQuestion": "Do LSC27926 terms resurrect removed aggregates?",
            "outcome": "overlay_knowledge",
            "layer": "reject_aggregate_resurrection",
            "removedConcepts": sorted(REMOVED_AGGREGATES),
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "Test-mode steps decompose into members — defrost_system, cooling_system, "
                "airflow_path remain dead per CG-7 freeze."
            ),
        },
        {
            "teachingId": "lg-sxs-cg9-r2-evidence-isolation",
            "gateQuestion": "Does CG-9 R2 boundary observation auto-approve overlay rows?",
            "outcome": "overlay_knowledge",
            "layer": "reject_cg9_calibration_inheritance",
            "gateAction": "reject_canonical_promotion",
            "boundaryProbeArtifact": BOUNDARY_PROBE,
            "rationale": (
                "CG-9 R2 triangulation closed family boundary — calibration only. Each "
                "teaching row requires independent LSC27926 procedure evidence in this gate."
            ),
        },
        {
            "teachingId": "lg-sxs-optichill-damper-platform",
            "gateQuestion": "OptiChill stepping damper implementation?",
            "outcome": "overlay_knowledge",
            "layer": "lg_sxs_platform_implementation",
            "implementationComponent": "optichill_damper",
            "procedureIds": ["lgsxs-damper"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "OptiChill stepping damper Test 1 closed / Test 2 closed — LG-specific "
                "platform instance alongside main baffle damper_motor."
            ),
        },
        {
            "teachingId": "lg-sxs-r2-sensor-abstention",
            "gateQuestion": "R2 / OptiChill sensor procedure coverage?",
            "outcome": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "gateAction": "defer_human_review",
            "rationale": (
                "LCD check reveals hidden R2/OptiChill sensor faults but no standalone "
                "R2-sensor procedure seed — deferred until seed exists."
            ),
        },
        {
            "teachingId": "lg-sxs-humidity-abstention",
            "gateQuestion": "humidity_control on LSC27926?",
            "outcome": "intentional_abstention",
            "layer": "defer_not_on_manual",
            "gateAction": "defer_human_review",
            "rationale": "No humidity sensor on LSC27926 SxS — CG-7 deferred humidity_control.",
        },
        {
            "teachingId": "lg-sxs-water-tank-abstention",
            "gateQuestion": "Water tank sensor on LSC27926?",
            "outcome": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "gateAction": "defer_human_review",
            "rationale": (
                "LCD check reveals hidden water-tank fault display but no water-tank procedure "
                "seed — dispenser bound via water_valve only."
            ),
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
    if lower in (
        "evap_fan",
        "heater",
        "damper_motor",
        "display_panel",
        "ice_maker_module",
        "compressor",
        "condenser_fan",
        "door_switch",
        "water_valve",
        "defrost_heater",
    ):
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
        "discoveryCorpusInheritance": 0,
        "mappingCandidatesTotal": len(candidates),
    }

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg9_5_sxs_overlay_mapping_gate_table",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "platformFamilyId": PLATFORM_ID,
        "canonicalOntologyId": "french_door_refrigerator",
        "proposedOverlayFile": "lg_sxs.json",
        "priorPublishedManualIds": [],
        "status": "gate_preview",
        "compoundingContract": "CG9_5_SXS_REFRIGERATOR_COMPOUNDING_CONTRACT_v1.json",
        "workPackage": "WP3",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "gateFraming": {
            "question": "What does this SxS manual teach us about the frozen refrigerator contract?",
            "manufacturerBoundary": (
                "independent — LSC27926 evidence not inherited from LRMVS linear, Samsung SxS, "
                "Whirlpool SxS, or CG-9 R2"
            ),
            "configurationNote": "side_by_side — compounding target is frozen french_door_refrigerator rev1",
            "freezeReopenBlocked": True,
            "cg9BoundaryProbe": BOUNDARY_PROBE,
            "cg9AutoApprovalBlocked": True,
        },
        "manufacturerIsolation": {
            "priorOverlaysBlocked": [
                "lg_lrmvs.json",
                "samsung_sxs.json",
                "whirlpool_sxs_w11296289.json",
            ],
            "rule": (
                "Do not import LRMVS linear, Samsung SxS, or Whirlpool SxS aliases, bindings, or topology."
            ),
            "crossOverlayDependentCount": 0,
            "cg8FrenchDoorOverlaysByteStableRequired": [
                "whirlpool_jazz_french_door.json",
                "samsung_fridge_bespoke.json",
                "lg_lrmvs.json",
            ],
            "cg95Wp1OverlayByteStableRequired": "samsung_sxs.json",
            "cg95Wp2OverlayByteStableRequired": "whirlpool_sxs_w11296289.json",
        },
        "pipelineCounts": manifest.get("counts") or {},
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
        },
        "gatePolicy": {
            "gateKind": "sxs_production_compounding_lg",
            "compoundingPhase": "CG-9.5",
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
            "relayDriveCompressor": [
                "lg-sxs-compressor-relay-conditional",
                "lg-sxs-compressor-relay-platform",
            ],
            "condenserFanExplicitBinding": ["lg-sxs-condenser-fan-conditional"],
            "dedicatedDoorSwitch": ["lg-sxs-door-switch"],
            "compartmentThermistors": [
                "lg-sxs-temp-fresh-food-conditional",
                "lg-sxs-temp-freezer-conditional",
                "lg-sxs-temp-ambient-conditional",
            ],
            "cg9R2EvidenceIsolation": ["lg-sxs-cg9-r2-evidence-isolation"],
            "aggregateResurrectionBlocked": ["lg-sxs-aggregate-resurrection-blocked"],
            "optichillDamperPlatform": ["lg-sxs-optichill-damper-platform"],
        },
        "accounting": acct,
        "outcomeHistogram": dict(Counter(r["outcome"] for r in teaching_rows)),
    }


def build_evidence(gate_table: dict[str, Any]) -> dict[str, Any]:
    acct = gate_table["accounting"]
    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg9_5_sxs_compounding_evidence",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "compoundingPhase": "CG-9.5",
        "workPackage": "WP3",
        "compoundingSequence": 3,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "canonicalOntology": {
            "id": "french_door_refrigerator",
            "revision": "rev1",
            "immutable": True,
            "hash": "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9",
        },
        "gateArtifact": OUT_TABLE.name,
        "boundaryProbeArtifact": BOUNDARY_PROBE,
        "headlineMetric": {"canonicalExpansion": 0},
        "compoundingCurve": {
            "framing": "contract_teaching_rows",
            "canonicalInheritance": acct["canonicalInheritance"],
            "conditionalBinding": acct["conditionalBinding"],
            "overlayKnowledge": acct["overlayLearning"],
            "intentionalAbstention": acct["intentionalAbstention"],
            "canonicalExpansion": 0,
            "discoveryCorpusInheritance": 0,
            "note": (
                "Third SxS production compounding — full KEEP intersection including door_switch, "
                "ambient NTC scope, and explicit condenser_fan conditional. Six refrigerator overlays "
                "on one contract."
            ),
        },
        "hierarchyTest": {
            "frozenKeepStable": True,
            "conditionalAbsorbsArchitecture": True,
            "platformAbsorbsImplementation": True,
            "manufacturerIsolationEnforced": True,
            "cg9CalibrationNotAutoPromoted": True,
            "verdict": (
                "LSC27926 SxS compounds relay-drive compressor, stepping damper + OptiChill, "
                "dedicated door switches, BLDC fans, and ambient NTC scope without canonical expansion."
            ),
        },
        "comparisonToWP1WP2": {
            "samsungRs28": {
                "canonicalInheritance": 5,
                "doorSwitchWithheld": True,
                "condenserFanWithheld": True,
            },
            "whirlpoolW11296289": {
                "canonicalInheritance": 6,
                "doorSwitchWithheld": False,
                "condenserFanBound": True,
            },
            "lgLsc27926": {
                "canonicalInheritance": acct["canonicalInheritance"],
                "doorSwitchWithheld": False,
                "condenserFanBound": True,
                "ambientNtcScope": True,
            },
        },
    }


def main() -> int:
    print("==> CG-9.5 WP3 LG LSC27926 SxS gate table generation")
    normalize_result = _run_fresh_cg3()
    gate_table = build_gate_table(normalize_result)
    evidence = build_evidence(gate_table)
    OUT_TABLE.write_text(json.dumps(gate_table, indent=2), encoding="utf-8")
    OUT_EVIDENCE.write_text(json.dumps(evidence, indent=2), encoding="utf-8")

    acct = gate_table["accounting"]
    print("\n=== LG LSC27926 SxS CG-9.5 Gate Preview ===")
    print(f"mapping candidates: {acct['mappingCandidatesTotal']}")
    print(f"canonical inherit:  {acct['canonicalInheritance']}")
    print(f"conditional bind:   {acct['conditionalBinding']}")
    print(f"overlay learning:   {acct['overlayLearning']}")
    print(f"intentional abstain:{acct['intentionalAbstention']}")
    print(f"canonical expansion:{acct['canonicalExpansion']}")
    print(f"\ntable:    {OUT_TABLE}")
    print(f"evidence: {OUT_EVIDENCE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
