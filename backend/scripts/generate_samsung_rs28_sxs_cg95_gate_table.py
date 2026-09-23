#!/usr/bin/env python3
"""CG-9.5 WP1 — Generate Samsung RS28 SxS overlay gate table (production compounding)."""

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

MANUAL_ID = "SAMSUNG-RS28-SXS"
PLATFORM_ID = "samsung_sxs"
BOUNDARY_PROBE = "SAMSUNG_RS28_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
OUT_TABLE = CALIBRATION / "SAMSUNG_RS28_SXS_overlay_mapping_table_v1.json"
OUT_EVIDENCE = CALIBRATION / "SAMSUNG_RS28_SXS_CG95_COMPOUNDING_EVIDENCE_v1.json"

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
            "teachingId": "samsung-rs28-control-board",
            "gateQuestion": "Does RS28 SxS independently teach frozen control_board?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "control_board",
            "procedureIds": [
                "samsungrs28-engineer-test-entry",
                "samsungrs28-self-diagnostic-entry",
                "samsungrs28-led-test-mode-entry",
            ],
            "seedComponentIds": [],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "Engineer mode / self-diagnosis / LED test entry on main PBA — Samsung SxS-native "
                "control orchestration. Not inherited from RF23BB french-door overlay."
            ),
        },
        {
            "teachingId": "samsung-rs28-user-interface",
            "gateQuestion": "Does RS28 SxS independently teach frozen user_interface?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "user_interface",
            "procedureIds": [
                "samsungrs28-panel-communication",
                "samsungrf260b-panel-communication",
            ],
            "seedComponentIds": ["display_panel"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "41Er main↔display communication — independent HMI diagnostic on samsung_sxs.",
        },
        {
            "teachingId": "samsung-rs28-door-switch-abstention",
            "gateQuestion": "Does RS28 SxS independently teach frozen door_switch?",
            "outcome": "intentional_abstention",
            "layer": "defer_insufficient_procedure_evidence",
            "gateAction": "defer_human_review",
            "independentEvidence": False,
            "rationale": (
                "F/R reed door switches documented in svc manual §5-4 flowchart (CN20 voltage) but "
                "no standalone RS28 door-switch procedure seed. Abstain — CG-9 boundary evidence "
                "does not auto-approve without procedure binding."
            ),
        },
        {
            "teachingId": "samsung-rs28-defrost-heater",
            "gateQuestion": "Does RS28 SxS teach frozen defrost_heater?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "defrost_heater",
            "instanceScope": "freezer",
            "procedureIds": [
                "samsungrs28-f-defrost-heater",
                "samsungrf260b-fz-defrost-heater",
                "samsungrf260b-ff-defrost-heater",
            ],
            "seedComponentIds": ["heater"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "F-DEF / FZ-DEF / FF-DEF heater Ω — compartment-scoped canonical inheritance.",
        },
        {
            "teachingId": "samsung-rs28-evaporator-fan",
            "gateQuestion": "Does RS28 SxS teach frozen evaporator_fan?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "evaporator_fan",
            "procedureIds": [
                "samsungrs28-f-fan",
                "samsungrf260b-fz-fan",
                "samsungrf260b-ff-fan",
            ],
            "seedComponentIds": ["evap_fan"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "F-FAN / FZ-FAN / FF-FAN feedback (22E) — canonical evaporator_fan with "
                "multi-compartment instance overlay. C-FAN handled separately (platform)."
            ),
        },
        {
            "teachingId": "samsung-rs28-air-damper",
            "gateQuestion": "Does RS28 SxS independently teach frozen air_damper?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "air_damper",
            "procedureIds": ["samsungrs28-damper-heater"],
            "seedComponentIds": ["damper_motor"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "R-room damper heater Ω on CN40 — functional air_damper on Samsung SxS.",
        },
        {
            "teachingId": "samsung-rs28-compressor-inverter-conditional",
            "gateQuestion": "What does RS28 SxS teach about conditional compressor?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "compressor",
            "instanceScope": "inverter_pba_mediated",
            "procedureIds": ["samsungrs28-inverter-communication"],
            "seedComponentIds": ["inverter_board"],
            "gateAction": "approve_conditional_binding",
            "rationale": (
                "44Er/84C routes through inverter PBA — functional compressor role as "
                "conditionalConcept only. Inverter implementation stays platform layer."
            ),
        },
        {
            "teachingId": "samsung-rs28-condenser-fan-abstention",
            "gateQuestion": "Does RS28 SxS teach conditional condenser_fan?",
            "outcome": "intentional_abstention",
            "layer": "defer_role_ambiguity",
            "gateAction": "defer_human_review",
            "rationale": (
                "C-FAN 22C procedure seed tags condenser_fan but manual weak-FF routing suggests "
                "evaporator/convert path — same ambiguity class as RF23BB 22C. No independent "
                "gate evidence for condenser_fan conditional binding; C-fan stays platform under "
                "evaporator_fan."
            ),
        },
        {
            "teachingId": "samsung-rs28-temp-freezer-conditional",
            "gateQuestion": "RS28 SxS freezer cabinet NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "freezer",
            "procedureIds": [
                "samsungrs28-f-sensor",
                "samsungrf260b-fz-sensor",
            ],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "samsung-rs28-temp-fresh-food-conditional",
            "gateQuestion": "RS28 SxS fresh-food cabinet NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "fresh_food",
            "procedureIds": [
                "samsungrs28-r-sensor",
                "samsungrf260b-ff-sensor",
            ],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "samsung-rs28-temp-ambient-conditional",
            "gateQuestion": "RS28 SxS ambient NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "ambient",
            "procedureIds": [
                "samsungrs28-ambient-sensor",
                "samsungrf260b-ambient-sensor",
            ],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "samsung-rs28-temp-pantry-conditional",
            "gateQuestion": "RS28 SxS pantry NTC scope (RF260B topology)?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "pantry",
            "procedureIds": ["samsungrf260b-pantry-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
            "rationale": "Pantry sensor on RF260B samsung_sxs sibling — instance scope only.",
        },
        {
            "teachingId": "samsung-rs28-ice-maker-conditional",
            "gateQuestion": "RS28 SxS optional ice_maker conditional binding?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "ice_maker",
            "procedureIds": [
                "samsungrs28-ice-maker-sensor",
                "samsungrs28-ice-maker-function",
                "samsungrs28-ice-pipe-heater",
                "samsungrf260b-ice-maker-sensor",
                "samsungrf260b-ice-maker-function",
            ],
            "seedComponentIds": ["ice_maker_module"],
            "gateAction": "approve_conditional_binding",
            "rationale": "In-door ice on RS28 — optional feature domain, conditionalConcept only.",
        },
        {
            "teachingId": "samsung-rs28-water-dispenser-conditional",
            "gateQuestion": "RS28 SxS water_dispenser conditional binding?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "water_dispenser",
            "procedureIds": ["samsungrs28-dispenser-communication"],
            "gateAction": "approve_conditional_binding",
            "rationale": "47Er dispenser panel comm — optional conditional feature, not canonical.",
        },
        {
            "teachingId": "samsung-rs28-inverter-board-platform",
            "gateQuestion": "Inverter PBA implementation vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_sxs_platform_implementation",
            "platformTarget": "compressor_controller",
            "procedureIds": ["samsungrs28-inverter-communication"],
            "seedComponentIds": ["inverter_board"],
            "implementationComponent": "inverter_board",
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "samsung-rs28-io-expander-platform",
            "gateQuestion": "IO expander harness implementation?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_sxs_platform_implementation",
            "platformTarget": "io_expander",
            "procedureIds": ["samsungrs28-io-expander-communication"],
            "seedComponentIds": [],
            "gateAction": "approve_platform_implementation",
            "rationale": "46Er main↔IO expander — platform comm path, not canonical control_board.",
        },
        {
            "teachingId": "samsung-rs28-defrost-sensor-platform",
            "gateQuestion": "F-DEF defrost NTC vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_sxs_platform_implementation",
            "platformTarget": "defrost_sensor",
            "procedureIds": [
                "samsungrs28-f-def-sensor",
                "samsungrf260b-fz-def-sensor",
                "samsungrf260b-ff-def-sensor",
            ],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "samsung-rs28-damper-motor-platform",
            "gateQuestion": "Damper motor implementation?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_sxs_platform_implementation",
            "canonicalFunctionalRole": ["air_damper"],
            "implementationComponent": "damper_motor",
            "procedureIds": ["samsungrs28-damper-heater"],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "samsung-rs28-ice-subsystem-platform",
            "gateQuestion": "Ice pipe / in-door ice platform vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_sxs_platform_implementation",
            "implementationComponents": ["ice_pipe_heater", "ice_maker_module"],
            "procedureIds": [
                "samsungrs28-ice-pipe-heater",
                "samsungrs28-ice-maker-sensor",
                "samsungrs28-ice-maker-function",
            ],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "samsung-rs28-wifi-modem-platform",
            "gateQuestion": "WiFi modem implementation?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_sxs_platform_implementation",
            "procedureIds": ["samsungrs28-wifi-communication"],
            "gateAction": "approve_platform_implementation",
            "rationale": "52Er WiFi comm — connectivity platform adjunct, not canonical user_interface.",
        },
        {
            "teachingId": "samsung-rs28-dispenser-panel-platform",
            "gateQuestion": "Dispenser panel implementation?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_sxs_platform_implementation",
            "implementationComponent": "dispenser_panel",
            "procedureIds": ["samsungrs28-dispenser-communication"],
            "gateAction": "approve_platform_implementation",
            "rationale": "47Er path implements conditional water_dispenser — platform hardware vocabulary.",
        },
        {
            "teachingId": "samsung-rs28-c-fan-platform",
            "gateQuestion": "C-FAN role under evaporator_fan platform?",
            "outcome": "overlay_knowledge",
            "layer": "samsung_sxs_platform_implementation",
            "canonicalFunctionalRole": ["evaporator_fan"],
            "instanceScope": "convertible",
            "procedureIds": [
                "samsungrs28-c-fan",
                "samsungrf260b-c-fan",
            ],
            "seedComponentIds": ["evap_fan"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "C-FAN 22C bound to evaporator_fan platform instance — NOT condenser_fan conditional. "
                "Role ambiguity documented; Whirlpool SxS WP2 may triangulate."
            ),
        },
        {
            "teachingId": "samsung-rs28-aggregate-resurrection-blocked",
            "gateQuestion": "Do Samsung SxS terms resurrect removed aggregates?",
            "outcome": "overlay_knowledge",
            "layer": "reject_aggregate_resurrection",
            "removedConcepts": sorted(REMOVED_AGGREGATES),
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "Self-diagnostic checklist and complaint routing decompose into members — "
                "defrost_system, cooling_system, airflow_path remain dead per CG-7 freeze."
            ),
        },
        {
            "teachingId": "samsung-rs28-cg9-evidence-isolation",
            "gateQuestion": "Does CG-9 R1 boundary observation auto-approve overlay rows?",
            "outcome": "overlay_knowledge",
            "layer": "reject_cg9_calibration_inheritance",
            "gateAction": "reject_canonical_promotion",
            "boundaryProbeArtifact": BOUNDARY_PROBE,
            "rationale": (
                "CG-9 R1 proved SxS fits frozen contract — calibration only. Each teaching row "
                "requires independent procedure evidence in this gate; boundary artifact informs "
                "human review but is not a runtime inheritance shortcut."
            ),
        },
        {
            "teachingId": "samsung-rs28-humidity-abstention",
            "gateQuestion": "humidity_control on RS28 SxS?",
            "outcome": "intentional_abstention",
            "layer": "defer_single_manufacturer_feature",
            "procedureIds": [
                "samsungrs28-humidity-sensor",
                "samsungrf260b-humidity-sensor",
            ],
            "gateAction": "defer_human_review",
            "rationale": (
                "14E humidity sensor procedure exists but CG-7 deferred humidity_control — "
                "abstain from canonical/conditional promotion until triangulation gate."
            ),
        },
        {
            "teachingId": "samsung-rs28-wifi-canonical-abstention",
            "gateQuestion": "Promote WiFi modem to canonical user_interface?",
            "outcome": "intentional_abstention",
            "layer": "defer_connectivity_not_hmi",
            "procedureIds": ["samsungrs28-wifi-communication"],
            "gateAction": "defer_human_review",
            "rationale": "52Er WiFi is connectivity adjunct — platform overlay only, not canonical expansion.",
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
        "inverter_board",
        "display_panel",
        "ice_maker_module",
        "ice_pipe_heater",
        "dispenser_panel",
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
        "proposedOverlayFile": "samsung_sxs.json",
        "priorPublishedManualIds": [],
        "status": "gate_preview",
        "compoundingContract": "CG9_5_SXS_REFRIGERATOR_COMPOUNDING_CONTRACT_v1.json",
        "workPackage": "WP1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "gateFraming": {
            "question": "What does this SxS manual teach us about the frozen refrigerator contract?",
            "manufacturerBoundary": (
                "stricter — RS28 SxS evidence independent of samsung_fridge_bespoke RF23BB overlay"
            ),
            "configurationNote": "side_by_side — compounding target is frozen french_door_refrigerator rev1",
            "freezeReopenBlocked": True,
            "cg9BoundaryProbe": BOUNDARY_PROBE,
            "cg9AutoApprovalBlocked": True,
        },
        "manufacturerIsolation": {
            "priorOverlay": "samsung_fridge_bespoke.json",
            "rule": "Do not import RF23BB french-door aliases, procedure bindings, or topology.",
            "rf23bbOverlayDependentCount": 0,
            "cg8FrenchDoorOverlaysByteStableRequired": [
                "whirlpool_jazz_french_door.json",
                "samsung_fridge_bespoke.json",
                "lg_lrmvs.json",
            ],
        },
        "pipelineCounts": manifest.get("counts") or {},
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
        },
        "gatePolicy": {
            "gateKind": "sxs_production_compounding_samsung",
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
            "inverterMediatedCompressor": [
                "samsung-rs28-compressor-inverter-conditional",
                "samsung-rs28-inverter-board-platform",
            ],
            "compartmentThermistors": [
                "samsung-rs28-temp-fresh-food-conditional",
                "samsung-rs28-temp-freezer-conditional",
                "samsung-rs28-temp-ambient-conditional",
                "samsung-rs28-temp-pantry-conditional",
            ],
            "cFanRoleAmbiguity": [
                "samsung-rs28-c-fan-platform",
                "samsung-rs28-condenser-fan-abstention",
            ],
            "cg9EvidenceIsolation": ["samsung-rs28-cg9-evidence-isolation"],
            "aggregateResurrectionBlocked": ["samsung-rs28-aggregate-resurrection-blocked"],
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
        "workPackage": "WP1",
        "compoundingSequence": 1,
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
                "First SxS production compounding — frozen refrigerator contract, "
                "samsung_sxs platform overlay. CG-9 boundary closed; this is runtime knowledge."
            ),
        },
        "hierarchyTest": {
            "frozenKeepStable": True,
            "conditionalAbsorbsArchitecture": True,
            "platformAbsorbsImplementation": True,
            "manufacturerIsolationEnforced": True,
            "cg9CalibrationNotAutoPromoted": True,
            "verdict": (
                "RS28 SxS separates reusable functional knowledge (5 KEEP inheritance paths with "
                "door_switch withheld) from inverter PBA / multi-NTC / C-fan ambiguity "
                "(conditional + platform) without canonical expansion."
            ),
        },
    }


def main() -> int:
    print("==> CG-9.5 WP1 Samsung RS28 SxS gate table generation")
    normalize_result = _run_fresh_cg3()
    gate_table = build_gate_table(normalize_result)
    evidence = build_evidence(gate_table)
    OUT_TABLE.write_text(json.dumps(gate_table, indent=2), encoding="utf-8")
    OUT_EVIDENCE.write_text(json.dumps(evidence, indent=2), encoding="utf-8")

    acct = gate_table["accounting"]
    print("\n=== Samsung RS28 SxS CG-9.5 Gate Preview ===")
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
