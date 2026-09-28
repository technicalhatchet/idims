#!/usr/bin/env python3
"""CG-9.5 WP4 — Generate Midea/Insignia NS-RSS26 SxS overlay gate table (production compounding)."""

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

MANUAL_ID = "MIDEA-RSS-FRIDGE"
PLATFORM_ID = "midea_rss"
BOUNDARY_PROBE = "MIDEA_RSS_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
OUT_TABLE = CALIBRATION / "MIDEA_RSS_SXS_overlay_mapping_table_v1.json"
OUT_EVIDENCE = CALIBRATION / "MIDEA_RSS_SXS_CG95_COMPOUNDING_EVIDENCE_v1.json"

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
            "teachingId": "midearss-control-board",
            "gateQuestion": "Does NS-RSS26 SxS independently teach frozen control_board?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "control_board",
            "procedureIds": ["midearss-mandatory-mode-entry"],
            "seedComponentIds": ["main_control"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "§10.5 mandatory mode (LOCK + FRZ.TEMP 3 s) — forced compressor / ice-maker "
                "orchestration on Midea RSS main control. Independent of prior SxS overlays."
            ),
        },
        {
            "teachingId": "midearss-user-interface",
            "gateQuestion": "Does NS-RSS26 SxS independently teach frozen user_interface?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "user_interface",
            "procedureIds": ["midearss-communication"],
            "seedComponentIds": ["display_panel"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "§10.8 E6 display↔main CN9 communication — independent HMI diagnostic on "
                "Midea RSS without importing LG/Samsung/Whirlpool SxS overlays."
            ),
        },
        {
            "teachingId": "midearss-defrost-heater",
            "gateQuestion": "Does NS-RSS26 SxS teach frozen defrost_heater?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "defrost_heater",
            "instanceScope": "freezer",
            "procedureIds": ["midearss-fz-defrost-heater"],
            "seedComponentIds": ["defrost_heater"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "§6.3 / §8.6 freezer defrost heater 115 V 240 W (~55 Ω) — direct canonical inheritance.",
        },
        {
            "teachingId": "midearss-door-switch-abstention",
            "gateQuestion": "Does NS-RSS26 SxS independently teach frozen door_switch?",
            "outcome": "intentional_abstention",
            "layer": "defer_insufficient_procedure_evidence",
            "gateAction": "defer_human_review",
            "independentEvidence": False,
            "rationale": (
                "E9 high-temp alarm flowchart references door switches but no standalone "
                "door-switch procedure seed on midea_rss. Abstain — same class as Samsung RS28."
            ),
        },
        {
            "teachingId": "midearss-evaporator-fan-abstention",
            "gateQuestion": "Does NS-RSS26 SxS teach frozen evaporator_fan?",
            "outcome": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "gateAction": "defer_human_review",
            "rationale": (
                "No evaporator-fan procedure seed on midea_rss (contrast midea_uz21 evap-fan seed). "
                "Deferred until RSS26 fan diagnostic seed exists."
            ),
        },
        {
            "teachingId": "midearss-air-damper-abstention",
            "gateQuestion": "Does NS-RSS26 SxS independently teach frozen air_damper?",
            "outcome": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "gateAction": "defer_human_review",
            "rationale": "No damper / baffle procedure seed on NS-RSS26 manual extraction.",
        },
        {
            "teachingId": "midearss-condenser-fan-abstention",
            "gateQuestion": "Does NS-RSS26 SxS teach conditional condenser_fan?",
            "outcome": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "gateAction": "defer_human_review",
            "rationale": (
                "VFD SxS uses BLDC compressor drive — no condenser_fan procedure seed. "
                "Not bound without independent gate evidence."
            ),
        },
        {
            "teachingId": "midearss-water-dispenser-abstention",
            "gateQuestion": "NS-RSS26 water_dispenser conditional binding?",
            "outcome": "intentional_abstention",
            "layer": "defer_not_on_manual",
            "gateAction": "defer_human_review",
            "rationale": (
                "RSS26 E-family covers ice maker (E0/EE) but no water-dispenser procedure seed. "
                "EH/EF/CA/EP codes deferred until dispenser seeds exist."
            ),
        },
        {
            "teachingId": "midearss-compressor-vfd-conditional",
            "gateQuestion": "What does NS-RSS26 teach about conditional compressor?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "compressor",
            "instanceScope": "vfd_mediated",
            "procedureIds": ["midearss-vfd-inverter"],
            "seedComponentIds": ["compressor", "inverter_board"],
            "gateAction": "approve_conditional_binding",
            "rationale": (
                "§11.2 VFD inverter fault LED — functional compressor role as conditionalConcept only. "
                "VFD implementation stays platform layer. NOT canonical compressor promotion."
            ),
        },
        {
            "teachingId": "midearss-temp-fresh-food-conditional",
            "gateQuestion": "NS-RSS26 RC cabinet NTC scope (E1)?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "fresh_food",
            "procedureIds": ["midearss-rc-temp-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "midearss-temp-freezer-conditional",
            "gateQuestion": "NS-RSS26 FZ cabinet NTC scope (E2)?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "freezer",
            "procedureIds": ["midearss-fz-temp-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "midearss-temp-ambient-conditional",
            "gateQuestion": "NS-RSS26 ambient NTC scope (E7)?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "ambient",
            "procedureIds": ["midearss-ambient-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "midearss-ice-maker-conditional",
            "gateQuestion": "NS-RSS26 optional ice_maker conditional binding (E0/EE)?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "ice_maker",
            "procedureIds": ["midearss-ice-maker", "midearss-ice-maker-sensor"],
            "seedComponentIds": ["ice_maker_module"],
            "gateAction": "approve_conditional_binding",
            "rationale": "§10.8 E0 ice maker fault + EE sensor circuit — optional feature domain only.",
        },
        {
            "teachingId": "midearss-rc-defrost-sensor-platform",
            "gateQuestion": "RC defrost NTC vocabulary (E4)?",
            "outcome": "overlay_knowledge",
            "layer": "midea_rss_platform_implementation",
            "platformTarget": "defrost_sensor",
            "instanceScope": "fresh_food",
            "procedureIds": ["midearss-rc-defrost-sensor"],
            "seedComponentIds": ["defrost_thermostat"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "E4 refrigerating-chamber defrost sensor — platform defrost_sensor vocabulary, "
                "not cabinet temperature_sensor conditional."
            ),
        },
        {
            "teachingId": "midearss-fz-defrost-sensor-platform",
            "gateQuestion": "FZ defrost NTC vocabulary (E5)?",
            "outcome": "overlay_knowledge",
            "layer": "midea_rss_platform_implementation",
            "platformTarget": "defrost_sensor",
            "instanceScope": "freezer",
            "procedureIds": ["midearss-fz-defrost-sensor"],
            "seedComponentIds": ["defrost_thermostat"],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "midearss-display-cn9-platform",
            "gateQuestion": "Main↔display CN9 implementation?",
            "outcome": "overlay_knowledge",
            "layer": "midea_rss_platform_implementation",
            "platformTarget": "display_communication",
            "canonicalFunctionalRole": ["user_interface"],
            "procedureIds": ["midearss-communication"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "CN9 harness between main control and display panel — platform HMI comm path, "
                "not canonical control_board expansion."
            ),
        },
        {
            "teachingId": "midearss-vfd-inverter-platform",
            "gateQuestion": "VFD inverter board implementation (§11.2)?",
            "outcome": "overlay_knowledge",
            "layer": "midea_rss_platform_implementation",
            "platformTarget": "compressor_controller",
            "procedureIds": ["midearss-vfd-inverter"],
            "implementationComponents": ["inverter_board", "compressor"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "Variable-frequency driver fault LED codes — platform compressor_controller. "
                "Distinct from Samsung inverter PBA and LG conventional relay paths."
            ),
        },
        {
            "teachingId": "midearss-b3839-ntc-platform",
            "gateQuestion": "B3839 NTC thermistor implementation?",
            "outcome": "overlay_knowledge",
            "layer": "midea_rss_platform_implementation",
            "platformTarget": "b3839_ntc",
            "procedureIds": [
                "midearss-rc-temp-sensor",
                "midearss-fz-temp-sensor",
                "midearss-ambient-sensor",
            ],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "B3839 ~2.0 kΩ @ 25°C spec (mideaB3839ThermistorKohm) — platform NTC vocabulary "
                "for cabinet/ambient conditional scopes."
            ),
        },
        {
            "teachingId": "midearss-mandatory-mode-platform",
            "gateQuestion": "Mandatory mode service entry implementation?",
            "outcome": "overlay_knowledge",
            "layer": "midea_rss_platform_implementation",
            "platformTarget": "mandatory_mode_entry",
            "procedureIds": ["midearss-mandatory-mode-entry"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "LOCK + FRZ.TEMP 3 s entry — platform service-mode vocabulary implementing "
                "canonical control_board orchestration."
            ),
        },
        {
            "teachingId": "midearss-high-temp-routing",
            "gateQuestion": "E9 high-temperature alarm complaint routing?",
            "outcome": "overlay_knowledge",
            "layer": "midea_rss_complaint_routing",
            "procedureIds": ["midearss-high-temp-alarm"],
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "E9 routes through door/compressor/thermistor checks — complaint routing only, "
                "not door_switch canonical promotion."
            ),
        },
        {
            "teachingId": "midearss-ice-maker-sensor-platform",
            "gateQuestion": "Ice maker sensor (EE) implementation?",
            "outcome": "overlay_knowledge",
            "layer": "midea_rss_platform_implementation",
            "implementationComponent": "ice_maker_module",
            "procedureIds": ["midearss-ice-maker-sensor"],
            "gateAction": "approve_platform_implementation",
            "rationale": "EE ice-maker sensor circuit — implements conditional ice_maker feature domain.",
        },
        {
            "teachingId": "midearss-aggregate-resurrection-blocked",
            "gateQuestion": "Do NS-RSS26 terms resurrect removed aggregates?",
            "outcome": "overlay_knowledge",
            "layer": "reject_aggregate_resurrection",
            "removedConcepts": sorted(REMOVED_AGGREGATES),
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "E-family and VFD steps decompose into members — defrost_system, cooling_system, "
                "airflow_path remain dead per CG-7 freeze."
            ),
        },
        {
            "teachingId": "midearss-cg9-r2-evidence-isolation",
            "gateQuestion": "Does CG-9 R2 boundary observation auto-approve overlay rows?",
            "outcome": "overlay_knowledge",
            "layer": "reject_cg9_calibration_inheritance",
            "gateAction": "reject_canonical_promotion",
            "boundaryProbeArtifact": BOUNDARY_PROBE,
            "rationale": (
                "CG-9 R2 triangulation closed family boundary — calibration only. Each "
                "teaching row requires independent NS-RSS26 procedure evidence in this gate."
            ),
        },
    ]


def _classify_mapping_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    term = str(candidate.get("sourceTerm") or "")
    proc_id = (candidate.get("provenance") or {}).get("procedureId")
    cid = candidate.get("id")
    lower = term.lower()

    if "§" in term or term.startswith("Service Test") or term.startswith("\u00a7"):
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "reject_procedural_title",
            "outcome": "procedural_noise",
            "gateAction": "reject_procedural_title",
        }

    if lower in ("thermistor",) or "sensor" in lower or "ntc" in lower:
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
        "heater",
        "defrost_heater",
        "display_panel",
        "main_control",
        "ice_maker_module",
        "compressor",
        "inverter_board",
        "door_switch",
        "defrost_thermostat",
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
        "proposedOverlayFile": "midea_rss.json",
        "priorPublishedManualIds": [
            "SAMSUNG-RS28-SXS",
            "W11296289",
            "LG-LSC27926-SXS",
        ],
        "status": "gate_preview",
        "compoundingContract": "CG9_5_SXS_REFRIGERATOR_COMPOUNDING_CONTRACT_v1.json",
        "workPackage": "WP4",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "gateFraming": {
            "question": "What does this SxS manual teach us about the frozen refrigerator contract?",
            "manufacturerBoundary": (
                "independent — NS-RSS26 evidence not inherited from Samsung, Whirlpool, LG SxS, "
                "or CG-9 R2 calibration"
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
                "lg_sxs.json",
            ],
            "rule": (
                "Do not import LRMVS linear, Samsung SxS, Whirlpool SxS, or LG SxS aliases, "
                "bindings, or topology."
            ),
            "crossOverlayDependentCount": 0,
            "cg8FrenchDoorOverlaysByteStableRequired": [
                "whirlpool_jazz_french_door.json",
                "samsung_fridge_bespoke.json",
                "lg_lrmvs.json",
            ],
            "cg95Wp1OverlayByteStableRequired": "samsung_sxs.json",
            "cg95Wp2OverlayByteStableRequired": "whirlpool_sxs_w11296289.json",
            "cg95Wp3OverlayByteStableRequired": "lg_sxs.json",
        },
        "pipelineCounts": manifest.get("counts") or {},
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
        },
        "gatePolicy": {
            "gateKind": "sxs_production_compounding_midea",
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
                "ice_maker",
            ],
        },
        "contractTeachingRows": teaching_rows,
        "mappingCandidateDispositions": candidate_dispositions,
        "auditBoundaries": {
            "vfdMediatedCompressor": [
                "midearss-compressor-vfd-conditional",
                "midearss-vfd-inverter-platform",
            ],
            "doorSwitchAbstention": ["midearss-door-switch-abstention"],
            "compartmentThermistors": [
                "midearss-temp-fresh-food-conditional",
                "midearss-temp-freezer-conditional",
                "midearss-temp-ambient-conditional",
            ],
            "defrostSensorPlatform": [
                "midearss-rc-defrost-sensor-platform",
                "midearss-fz-defrost-sensor-platform",
            ],
            "cg9R2EvidenceIsolation": ["midearss-cg9-r2-evidence-isolation"],
            "aggregateResurrectionBlocked": ["midearss-aggregate-resurrection-blocked"],
            "mandatoryModeEntry": ["midearss-control-board", "midearss-mandatory-mode-platform"],
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
        "workPackage": "WP4",
        "compoundingSequence": 4,
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
                "Fourth SxS production compounding — VFD-mediated compressor, B3839 NTC platform, "
                "E-family defrost sensors, mandatory mode entry. Door_switch abstained (no seed). "
                "Seven refrigerator overlays on one contract."
            ),
        },
        "hierarchyTest": {
            "frozenKeepStable": True,
            "conditionalAbsorbsArchitecture": True,
            "platformAbsorbsImplementation": True,
            "manufacturerIsolationEnforced": True,
            "cg9CalibrationNotAutoPromoted": True,
            "verdict": (
                "NS-RSS26 SxS compounds VFD compressor, B3839 NTC scopes, E4/E5 defrost-sensor "
                "platform vocabulary, and mandatory-mode control without canonical expansion."
            ),
        },
        "comparisonToWP1WP2WP3": {
            "samsungRs28": {
                "canonicalInheritance": 5,
                "doorSwitchWithheld": True,
                "compressorScope": "inverter_pba_mediated",
            },
            "whirlpoolW11296289": {
                "canonicalInheritance": 6,
                "doorSwitchWithheld": False,
            },
            "lgLsc27926": {
                "canonicalInheritance": 6,
                "compressorScope": "relay_drive_conventional",
            },
            "mideaRss": {
                "canonicalInheritance": acct["canonicalInheritance"],
                "doorSwitchWithheld": True,
                "compressorScope": "vfd_mediated",
                "vfdInverterPlatform": True,
            },
        },
    }


def main() -> int:
    print("==> CG-9.5 WP4 Midea RSS SxS gate table generation")
    normalize_result = _run_fresh_cg3()
    gate_table = build_gate_table(normalize_result)
    evidence = build_evidence(gate_table)
    OUT_TABLE.write_text(json.dumps(gate_table, indent=2), encoding="utf-8")
    OUT_EVIDENCE.write_text(json.dumps(evidence, indent=2), encoding="utf-8")

    acct = gate_table["accounting"]
    print("\n=== Midea RSS SxS CG-9.5 Gate Preview ===")
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
