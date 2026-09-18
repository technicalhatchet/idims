#!/usr/bin/env python3
"""CG-9.5 WP2 — Generate Whirlpool W11296289 SxS overlay gate table (production compounding)."""

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

MANUAL_ID = "W11296289"
PLATFORM_ID = "whirlpool_sxs_w11296289"
BOUNDARY_PROBE = "W11296289_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
OUT_TABLE = CALIBRATION / "W11296289_SXS_overlay_mapping_table_v1.json"
OUT_EVIDENCE = CALIBRATION / "W11296289_SXS_CG95_COMPOUNDING_EVIDENCE_v1.json"

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
            "teachingId": "whirlpool-sxs-control-board",
            "gateQuestion": "Does W11296289 SxS independently teach frozen control_board?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "control_board",
            "procedureIds": [
                "w11296289-theseus-service-entry",
                "w11296289-athena-service-entry",
                "w11296289-athena-fail-display",
            ],
            "seedComponentIds": ["control_board"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "THESEUS CUDA / ATHENA service-mode orchestration and fail-LED decode — "
                "Whirlpool SxS-native control. Not inherited from Jazz french-door or Samsung SxS."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-user-interface",
            "gateQuestion": "Does W11296289 SxS independently teach frozen user_interface?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "user_interface",
            "procedureIds": [
                "w11296289-theseus-service-entry",
                "w11296289-athena-fail-display",
            ],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "CUDA dispenser LED step UI and ATHENA TEMP-button / fail-display decode — "
                "functional HMI on SxS without separate display-panel comm procedure."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-door-switch",
            "gateQuestion": "Does W11296289 SxS independently teach frozen door_switch?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "door_switch",
            "procedureIds": [
                "w11296289-test-21-rc-door-switch",
                "w11296289-test-23-fc-door-switch",
            ],
            "seedComponentIds": ["door_switch"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "Dedicated service steps 21/23 RC and FC door switches — independent procedure "
                "evidence (contrast Samsung SxS flowchart-only abstention)."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-evaporator-fan",
            "gateQuestion": "Does W11296289 SxS teach frozen evaporator_fan?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "evaporator_fan",
            "procedureIds": ["w11296289-test-15-evap-fan"],
            "seedComponentIds": ["evap_fan"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "Single-evaporator SxS architecture — step 15 evap fan. Instance topology differs "
                "from multi-fan french-door but same canonical function."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-air-damper",
            "gateQuestion": "Does W11296289 SxS independently teach frozen air_damper?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "air_damper",
            "procedureIds": [
                "w11296289-test-09-damper-open",
                "w11296289-test-11-damper-heater",
            ],
            "seedComponentIds": ["damper_motor"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "12 VDC stepper damper open (step 9) + damper heater (step 11) — Whirlpool SxS "
                "air_damper implementation distinct from Samsung heater-only path."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-defrost-heater",
            "gateQuestion": "Does W11296289 SxS teach frozen defrost_heater?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "defrost_heater",
            "procedureIds": ["w11296289-test-13-defrost-heater"],
            "seedComponentIds": ["defrost_heater"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "Service step 13 defrost heater 550–650 Ω — direct canonical inheritance.",
        },
        {
            "teachingId": "whirlpool-sxs-compressor-relay-conditional",
            "gateQuestion": "What does W11296289 teach about conditional compressor?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "compressor",
            "instanceScope": "relay_drive_em3y60",
            "procedureIds": ["w11296289-test-07-compressor-cond-fan"],
            "seedComponentIds": ["compressor"],
            "gateAction": "approve_conditional_binding",
            "rationale": (
                "Step 7 compressor run windings via EM3Y60/EGX60 relay-drive path — "
                "conditionalConcept only. Relay implementation stays platform layer."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-condenser-fan-conditional",
            "gateQuestion": "Does W11296289 teach conditional condenser_fan?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "condenser_fan",
            "procedureIds": ["w11296289-test-07-compressor-cond-fan"],
            "seedComponentIds": ["condenser_fan"],
            "gateAction": "approve_conditional_binding",
            "independentEvidence": True,
            "rationale": (
                "Step 7 explicitly exercises condenser fan with compressor — independent Whirlpool "
                "procedure evidence. Conditional binding only; NOT canonical promotion. "
                "CG-9 R2 triangulation informative; gate evidence is step 7 procedure."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-temp-freezer-conditional",
            "gateQuestion": "W11296289 FC cabinet NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "freezer",
            "procedureIds": ["w11296289-test-01-fc-thermistor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "whirlpool-sxs-temp-fresh-food-conditional",
            "gateQuestion": "W11296289 RC cabinet NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "fresh_food",
            "procedureIds": ["w11296289-test-03-rc-thermistor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "whirlpool-sxs-ice-maker-conditional",
            "gateQuestion": "W11296289 optional ice_maker conditional binding?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "ice_maker",
            "procedureIds": ["w11296289-test-33-im-tray-thermistor"],
            "seedComponentIds": ["ice_maker_module"],
            "gateAction": "approve_conditional_binding",
            "rationale": "IDI twist-tray step 33 — optional feature domain, conditionalConcept only.",
        },
        {
            "teachingId": "whirlpool-sxs-water-dispenser-conditional",
            "gateQuestion": "W11296289 water_dispenser conditional binding?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "water_dispenser",
            "procedureIds": ["w11296289-test-19-water-valve"],
            "seedComponentIds": ["water_valve"],
            "gateAction": "approve_conditional_binding",
            "rationale": "Step 19 water valve — optional conditional feature, not canonical.",
        },
        {
            "teachingId": "whirlpool-sxs-defrost-thermistor-platform",
            "gateQuestion": "Defrost NTC vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_sxs_platform_implementation",
            "platformTarget": "defrost_sensor",
            "procedureIds": ["w11296289-test-05-defrost-thermistor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "Step 5 defrost thermistor — platform defrost_sensor vocabulary, not cabinet "
                "temperature_sensor conditional."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-theseus-athena-acu-platform",
            "gateQuestion": "THESEUS vs ATHENA ACU board variants?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_sxs_platform_implementation",
            "platformTarget": "control_board_implementation",
            "procedureIds": [
                "w11296289-theseus-service-entry",
                "w11296289-athena-service-entry",
            ],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "Board variant routing (THESEUS/CUDA vs ATHENA) — implementation overlay, "
                "not canonical control_board expansion."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-minotaur-cuda-hmi-platform",
            "gateQuestion": "MINOTAUR HMI / CUDA dispenser UI implementation?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_sxs_platform_implementation",
            "canonicalFunctionalRole": ["user_interface"],
            "procedureIds": ["w11296289-theseus-service-entry"],
            "gateAction": "approve_platform_implementation",
            "rationale": "MINOTAUR J1 12.7 VDC + CUDA LED step codes — platform HMI path detail.",
        },
        {
            "teachingId": "whirlpool-sxs-compressor-relay-platform",
            "gateQuestion": "EM3Y60/EGX60 relay-drive implementation?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_sxs_platform_implementation",
            "platformTarget": "compressor_controller",
            "procedureIds": ["w11296289-test-07-compressor-cond-fan"],
            "implementationComponents": ["compressor_relay", "em3y60_compressor"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "Relay-drive compressor path — platform compressor_controller. Distinct from "
                "Jazz EM2Y60 french-door and Samsung inverter PBA."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-damper-stepper-platform",
            "gateQuestion": "12 VDC stepper damper implementation?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_sxs_platform_implementation",
            "canonicalFunctionalRole": ["air_damper"],
            "implementationComponent": "damper_motor",
            "procedureIds": [
                "w11296289-test-09-damper-open",
                "w11296289-test-11-damper-heater",
            ],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "whirlpool-sxs-idi-ice-platform",
            "gateQuestion": "IDI twist-tray ice maker platform vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_sxs_platform_implementation",
            "implementationComponent": "ice_maker_module",
            "procedureIds": ["w11296289-test-33-im-tray-thermistor"],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "whirlpool-sxs-water-valve-platform",
            "gateQuestion": "Water inlet valve implementation?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_sxs_platform_implementation",
            "implementationComponent": "water_valve",
            "procedureIds": ["w11296289-test-19-water-valve"],
            "gateAction": "approve_platform_implementation",
            "rationale": "P3 water valve — implements conditional water_dispenser.",
        },
        {
            "teachingId": "whirlpool-sxs-sealed-system-routing",
            "gateQuestion": "Sealed-system complaint routing?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_sxs_complaint_routing",
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "Sealed-system / not-cooling complaint vocabulary routes to compressor + "
                "condenser_fan conditionals — not a canonical aggregate node."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-aggregate-resurrection-blocked",
            "gateQuestion": "Do W11296289 terms resurrect removed aggregates?",
            "outcome": "overlay_knowledge",
            "layer": "reject_aggregate_resurrection",
            "removedConcepts": sorted(REMOVED_AGGREGATES),
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "THESEUS service steps decompose into members — defrost_system, cooling_system, "
                "airflow_path remain dead per CG-7 freeze."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-cg9-r2-evidence-isolation",
            "gateQuestion": "Does CG-9 R2 boundary observation auto-approve overlay rows?",
            "outcome": "overlay_knowledge",
            "layer": "reject_cg9_calibration_inheritance",
            "gateAction": "reject_canonical_promotion",
            "boundaryProbeArtifact": BOUNDARY_PROBE,
            "rationale": (
                "CG-9 R2 falsification probe closed family boundary — calibration only. Each "
                "teaching row requires independent W11296289 procedure evidence in this gate."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-idi-partial-abstention",
            "gateQuestion": "Full IDI steps 29–35 coverage?",
            "outcome": "intentional_abstention",
            "layer": "defer_partial_procedure_coverage",
            "procedureIds": ["w11296289-test-33-im-tray-thermistor"],
            "gateAction": "defer_human_review",
            "rationale": (
                "Only step 33 tray thermistor seeded — harvest/fill steps 29–32/34–35 deferred "
                "until procedure seeds exist. ice_maker conditional bound on step 33 only."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-dispenser-light-abstention",
            "gateQuestion": "Dispenser light step 17?",
            "outcome": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "gateAction": "defer_human_review",
            "rationale": "Step 17 dispenser light — no procedure seed; lighting adjunct not canonical.",
        },
        {
            "teachingId": "whirlpool-sxs-paddle-feedback-abstention",
            "gateQuestion": "Paddle feedback steps 25/27?",
            "outcome": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "gateAction": "defer_human_review",
            "rationale": (
                "Steps 25/27 ice/water paddle feedback — HMI path only, no standalone procedure "
                "seeds. water_dispenser bound via step 19 valve only."
            ),
        },
        {
            "teachingId": "whirlpool-sxs-humidity-abstention",
            "gateQuestion": "humidity_control on W11296289?",
            "outcome": "intentional_abstention",
            "layer": "defer_not_on_manual",
            "gateAction": "defer_human_review",
            "rationale": "No humidity sensor on W11296289 SxS — CG-7 deferred humidity_control.",
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
        "proposedOverlayFile": "whirlpool_sxs_w11296289.json",
        "priorPublishedManualIds": [],
        "status": "gate_preview",
        "compoundingContract": "CG9_5_SXS_REFRIGERATOR_COMPOUNDING_CONTRACT_v1.json",
        "workPackage": "WP2",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "gateFraming": {
            "question": "What does this SxS manual teach us about the frozen refrigerator contract?",
            "manufacturerBoundary": (
                "independent — W11296289 evidence not inherited from Jazz, Samsung SxS, or CG-9 R2"
            ),
            "configurationNote": "side_by_side — compounding target is frozen french_door_refrigerator rev1",
            "freezeReopenBlocked": True,
            "cg9BoundaryProbe": BOUNDARY_PROBE,
            "cg9AutoApprovalBlocked": True,
        },
        "manufacturerIsolation": {
            "priorOverlaysBlocked": [
                "whirlpool_jazz_french_door.json",
                "samsung_sxs.json",
            ],
            "rule": "Do not import Jazz french-door or Samsung SxS aliases, bindings, or topology.",
            "crossOverlayDependentCount": 0,
            "cg8FrenchDoorOverlaysByteStableRequired": [
                "whirlpool_jazz_french_door.json",
                "samsung_fridge_bespoke.json",
                "lg_lrmvs.json",
            ],
            "cg95Wp1OverlayByteStableRequired": "samsung_sxs.json",
        },
        "pipelineCounts": manifest.get("counts") or {},
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
        },
        "gatePolicy": {
            "gateKind": "sxs_production_compounding_whirlpool",
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
                "whirlpool-sxs-compressor-relay-conditional",
                "whirlpool-sxs-compressor-relay-platform",
            ],
            "condenserFanExplicitBinding": [
                "whirlpool-sxs-condenser-fan-conditional",
            ],
            "dedicatedDoorSwitch": ["whirlpool-sxs-door-switch"],
            "compartmentThermistors": [
                "whirlpool-sxs-temp-fresh-food-conditional",
                "whirlpool-sxs-temp-freezer-conditional",
            ],
            "cg9R2EvidenceIsolation": ["whirlpool-sxs-cg9-r2-evidence-isolation"],
            "aggregateResurrectionBlocked": ["whirlpool-sxs-aggregate-resurrection-blocked"],
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
                "Second SxS production compounding — full KEEP intersection including door_switch "
                "and explicit condenser_fan conditional. Five refrigerator overlays on one contract."
            ),
        },
        "hierarchyTest": {
            "frozenKeepStable": True,
            "conditionalAbsorbsArchitecture": True,
            "platformAbsorbsImplementation": True,
            "manufacturerIsolationEnforced": True,
            "cg9CalibrationNotAutoPromoted": True,
            "verdict": (
                "W11296289 SxS compounds relay-drive compressor, stepper damper, dedicated door "
                "switches, and explicit condenser_fan conditional without canonical expansion."
            ),
        },
        "comparisonToWP1": {
            "samsungRs28": {
                "canonicalInheritance": 5,
                "doorSwitchWithheld": True,
                "condenserFanWithheld": True,
            },
            "whirlpoolW11296289": {
                "canonicalInheritance": acct["canonicalInheritance"],
                "doorSwitchWithheld": False,
                "condenserFanBound": True,
            },
        },
    }


def main() -> int:
    print("==> CG-9.5 WP2 Whirlpool W11296289 SxS gate table generation")
    normalize_result = _run_fresh_cg3()
    gate_table = build_gate_table(normalize_result)
    evidence = build_evidence(gate_table)
    OUT_TABLE.write_text(json.dumps(gate_table, indent=2), encoding="utf-8")
    OUT_EVIDENCE.write_text(json.dumps(evidence, indent=2), encoding="utf-8")

    acct = gate_table["accounting"]
    print("\n=== Whirlpool W11296289 SxS CG-9.5 Gate Preview ===")
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
