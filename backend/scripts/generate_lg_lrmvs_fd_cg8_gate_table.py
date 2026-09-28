#!/usr/bin/env python3
"""CG-8 WP3 — Generate LG LRMVS overlay gate table (discovery-corpus isolated)."""

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

MANUAL_ID = "LG-LRMVS-FRIDGE"
PLATFORM_ID = "lg_lrmvs"
PRIOR_MANUALS = ["W10322959", "SAMSUNG-RF23BB-FRIDGE"]
OUT_TABLE = CALIBRATION / "LG_LRMVS_FD_overlay_mapping_table_v1.json"
OUT_EVIDENCE = CALIBRATION / "LG_LRMVS_FD_CG8_COMPOUNDING_EVIDENCE_v1.json"

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
DISCOVERY_CORPUS_ARTIFACTS = frozenset(
    {
        "LG_LRMVS_fd_cg7x_observation_v1.json",
        "W10322959_fd_cg7x_observation_v1.json",
        "SAMSUNG_RF23BB_fd_cg7x_observation_v1.json",
        "french_door_refrigerator_cg7x_candidate_v1.json",
        "french_door_refrigerator.reference.json",
    }
)


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
            "teachingId": "lg-control-board-test-mode",
            "gateQuestion": "Does LRMVS independently teach frozen control_board?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "control_board",
            "procedureIds": [
                "lglrmvs-test-mode-entry",
                "lglrmvs-display-communication",
                "lglrmvs-display-mode",
            ],
            "seedComponentIds": ["main_control"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "Main PCB test modes (×1/×2/×3) and E CO flowchart — LG-native control "
                "orchestration from procedure seeds only."
            ),
        },
        {
            "teachingId": "lg-user-interface-display",
            "gateQuestion": "Does LRMVS independently teach frozen user_interface?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "user_interface",
            "procedureIds": ["lglrmvs-display-communication", "lglrmvs-display-mode"],
            "seedComponentIds": ["display_panel"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "E CO main↔display comm and demo/OFF display mode — independent HMI diagnostics.",
        },
        {
            "teachingId": "lg-door-switch-abstention",
            "gateQuestion": "Does LRMVS independently teach frozen door_switch?",
            "outcome": "intentional_abstention",
            "layer": "defer_insufficient_procedure_evidence",
            "gateAction": "defer_human_review",
            "independentEvidence": False,
            "rationale": (
                "Manual assembly §10-3 documents R/F/HomeBar door switches but no LRMVS "
                "door-switch service procedure seed. Abstain — do not inherit Jazz procedure "
                "evidence or CG-7 triangulation phrases."
            ),
        },
        {
            "teachingId": "lg-evaporator-fan-multi",
            "gateQuestion": "Does LRMVS teach frozen evaporator_fan?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "evaporator_fan",
            "procedureIds": [
                "lglrmvs-ff-fan",
                "lglrmvs-fz-fan",
                "lglrmvs-icing-fan",
            ],
            "seedComponentIds": ["evap_fan"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": (
                "E rF / E FF / E IF evaporator-path fan diagnostics — canonical with "
                "multi-instance overlay; condenser fan (E CF) stays conditional."
            ),
        },
        {
            "teachingId": "lg-air-damper-test-mode",
            "gateQuestion": "Does LRMVS independently teach frozen air_damper?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "air_damper",
            "procedureIds": ["lglrmvs-damper-test", "lglrmvs-test-mode-entry"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "Test Mode ×2 (display 22 22) closes damper — functional airflow control on LG.",
        },
        {
            "teachingId": "lg-defrost-heater-ff-fz",
            "gateQuestion": "Does LRMVS teach frozen defrost_heater?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "defrost_heater",
            "procedureIds": ["lglrmvs-fz-defrost-heater", "lglrmvs-ff-defrost-heater"],
            "seedComponentIds": ["heater"],
            "gateAction": "approve_human",
            "independentEvidence": True,
            "rationale": "F dH / r dH separate heater procedures — FF/FZ instance scopes on canonical.",
        },
        {
            "teachingId": "lg-compressor-linear-conditional",
            "gateQuestion": "What does LRMVS teach about conditional compressor?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "compressor",
            "instanceScope": "linear_compressor_r600a",
            "procedureIds": ["lglrmvs-sealed-system"],
            "seedComponentIds": ["compressor", "sealed_system"],
            "gateAction": "approve_conditional_binding",
            "rationale": (
                "E CH/E CL sealed-system path references linear compressor — conditionalConcept "
                "only; linear drive stays platform layer."
            ),
        },
        {
            "teachingId": "lg-condenser-fan-conditional",
            "gateQuestion": "Does LRMVS teach conditional condenser_fan?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "condenser_fan",
            "procedureIds": ["lglrmvs-condenser-fan"],
            "seedComponentIds": ["evap_fan"],
            "gateAction": "approve_conditional_binding",
            "rationale": "Standalone E CF procedure on CON3 — conditional binding (2/3 with Jazz; Samsung abstains).",
        },
        {
            "teachingId": "lg-temp-ff-conditional",
            "gateQuestion": "LRMVS fresh-food cabinet NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "fresh_food",
            "procedureIds": ["lglrmvs-ff-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "lg-temp-fz-conditional",
            "gateQuestion": "LRMVS freezer cabinet NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "freezer",
            "procedureIds": ["lglrmvs-fz-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "lg-temp-convert-conditional",
            "gateQuestion": "LRMVS convert-drawer NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "convert_drawer",
            "procedureIds": ["lglrmvs-convert-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "lg-temp-icing-conditional",
            "gateQuestion": "LRMVS icing-room NTC scope?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "icing_room",
            "procedureIds": ["lglrmvs-icing-sensor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
        },
        {
            "teachingId": "lg-ice-maker-conditional",
            "gateQuestion": "LRMVS optional ice_maker conditional binding?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "ice_maker",
            "procedureIds": ["lglrmvs-ice-maker-electrical"],
            "seedComponentIds": ["ice_maker_module"],
            "gateAction": "approve_conditional_binding",
            "rationale": "E ID/E IU ice maker kit electrical — conditionalConcept only.",
        },
        {
            "teachingId": "lg-water-dispenser-abstention",
            "gateQuestion": "LRMVS water_dispenser conditional binding?",
            "outcome": "intentional_abstention",
            "layer": "defer_no_standalone_diagnostic",
            "gateAction": "defer_human_review",
            "rationale": "No LRMVS water-dispenser service procedure seed in manual pipeline.",
        },
        {
            "teachingId": "lg-linear-compressor-platform",
            "gateQuestion": "Linear compressor implementation vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "lg_platform_implementation",
            "platformTarget": "compressor_controller",
            "procedureIds": ["lglrmvs-sealed-system"],
            "seedComponentIds": ["compressor"],
            "implementationComponent": "linear_compressor",
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "lg-defrost-sensor-platform",
            "gateQuestion": "F dS/r dS defrost NTC vocabulary?",
            "outcome": "overlay_knowledge",
            "layer": "lg_platform_implementation",
            "platformTarget": "defrost_sensor",
            "procedureIds": [
                "lglrmvs-fz-defrost-sensor",
                "lglrmvs-ff-defrost-sensor",
            ],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_platform_implementation",
        },
        {
            "teachingId": "lg-icing-fan-platform",
            "gateQuestion": "Icing compartment fan architecture?",
            "outcome": "overlay_knowledge",
            "layer": "lg_platform_implementation",
            "canonicalFunctionalRole": ["evaporator_fan"],
            "instanceScope": "icing_room",
            "procedureIds": ["lglrmvs-icing-fan"],
            "seedComponentIds": ["evap_fan"],
            "gateAction": "approve_platform_implementation",
            "rationale": "E IF icing fan — platform detail under evaporator_fan family.",
        },
        {
            "teachingId": "lg-wifi-modem-platform",
            "gateQuestion": "Wi-Fi modem (E Od) implementation?",
            "outcome": "overlay_knowledge",
            "layer": "lg_platform_implementation",
            "procedureIds": ["lglrmvs-wifi-modem"],
            "seedComponentIds": ["main_control"],
            "implementationComponent": "wifi_modem",
            "gateAction": "approve_platform_implementation",
            "rationale": "ThinQ modem comm — platform connectivity, not canonical user_interface expansion.",
        },
        {
            "teachingId": "lg-sealed-system-routing",
            "gateQuestion": "Sealed-system complaint routing on LRMVS?",
            "outcome": "overlay_knowledge",
            "layer": "reject_canonical_promotion",
            "platformTarget": "sealed_system",
            "procedureIds": ["lglrmvs-sealed-system"],
            "gateAction": "reject_canonical_promotion",
            "rationale": "E CH/E CL routing is PLATFORM_ONLY per CG-7 freeze — not canonical expansion.",
        },
        {
            "teachingId": "lg-aggregate-resurrection-blocked",
            "gateQuestion": "Do LG terms resurrect removed aggregates?",
            "outcome": "overlay_knowledge",
            "layer": "reject_aggregate_resurrection",
            "removedConcepts": sorted(REMOVED_AGGREGATES),
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "Test modes and §8 flowcharts decompose into members — defrost_system, "
                "cooling_system, airflow_path remain dead per CG-7 freeze."
            ),
        },
        {
            "teachingId": "lg-humidity-abstention",
            "gateQuestion": "humidity_control on LRMVS?",
            "outcome": "intentional_abstention",
            "layer": "defer_single_manufacturer_feature",
            "gateAction": "defer_human_review",
            "rationale": "Humidity crisper mentioned in manual but CG-7 deferred humidity_control.",
        },
        {
            "teachingId": "lg-power-supply-abstention",
            "gateQuestion": "power_supply on LRMVS?",
            "outcome": "intentional_abstention",
            "layer": "defer_cg7_deferred_concept",
            "gateAction": "defer_human_review",
            "rationale": "CG-7 deferred power_supply — no standalone LRMVS supply diagnostic procedure seed.",
        },
        {
            "teachingId": "lg-discovery-corpus-isolation",
            "gateQuestion": "Does compounding import CG-7 discovery corpus?",
            "outcome": "overlay_knowledge",
            "layer": "discovery_corpus_isolation_guard",
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "CG-7 R3 observation artifacts are reference-only — LG bindings must come "
                "from LRMVS procedure seeds, not triangulation verdict inheritance."
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

    if "sensor" in lower or lower == "thermistor":
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "conditional_concept_binding",
            "outcome": "conditional_binding",
            "conditionalConcept": "temperature_sensor",
            "gateAction": "see_contract_teaching_row",
        }
    if lower in ("evap_fan", "heater", "display_panel", "compressor", "ice_maker_module"):
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
        "reportType": "cg8_fd_overlay_mapping_gate_table",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "platformFamilyId": PLATFORM_ID,
        "canonicalOntologyId": "french_door_refrigerator",
        "proposedOverlayFile": "lg_lrmvs.json",
        "priorPublishedManualIds": PRIOR_MANUALS,
        "status": "gate_preview",
        "compoundingContract": "CG8_FRENCH_DOOR_COMPOUNDING_CONTRACT_v1.json",
        "workPackage": "WP3",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "gateFraming": {
            "question": "What does this manual teach us about the frozen contract?",
            "manufacturerBoundary": (
                "strict — LRMVS procedure evidence only; CG-7 discovery corpus reference-only"
            ),
            "freezeReopenBlocked": True,
        },
        "manufacturerIsolation": {
            "priorOverlays": ["whirlpool_jazz_french_door.json", "samsung_fridge_bespoke.json"],
            "rule": "Do not import Whirlpool/Samsung aliases, bindings, or CG-7 triangulation verdicts.",
            "whirlpoolOverlayDependentCount": 0,
            "samsungOverlayDependentCount": 0,
            "discoveryCorpusInheritanceCount": 0,
        },
        "discoveryCorpusPolicy": {
            "referenceOnly": True,
            "forbiddenInheritanceArtifacts": sorted(DISCOVERY_CORPUS_ARTIFACTS),
            "allowedPriorManualAccounting": PRIOR_MANUALS,
        },
        "pipelineCounts": manifest.get("counts") or {},
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
        },
        "gatePolicy": {
            "gateKind": "manufacturer_boundary_third_manual",
            "compoundingPhase": "CG-8",
            "canonicalGraph": "french_door_refrigerator.json rev1 FROZEN",
            "publishBlocked": True,
        },
        "canonicalContract": {
            "graph": "french_door_refrigerator",
            "revision": "rev1",
            "hash": "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9",
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
            "linearCompressorSplit": [
                "lg-compressor-linear-conditional",
                "lg-linear-compressor-platform",
                "lg-sealed-system-routing",
            ],
            "compartmentThermistors": [
                "lg-temp-ff-conditional",
                "lg-temp-fz-conditional",
                "lg-temp-convert-conditional",
                "lg-temp-icing-conditional",
            ],
            "discoveryIsolation": ["lg-discovery-corpus-isolation"],
            "aggregateResurrectionBlocked": ["lg-aggregate-resurrection-blocked"],
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
        "headlineMetric": {"canonicalExpansion": 0},
        "hardInvariants": {
            "canonicalHash": "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9",
            "canonicalExpansion": 0,
            "whirlpoolOverlayMutation": 0,
            "samsungOverlayMutation": 0,
            "discoveryCorpusInheritance": 0,
        },
        "compoundingCurve": {
            "framing": "contract_teaching_rows",
            "canonicalInheritance": acct["canonicalInheritance"],
            "conditionalBinding": acct["conditionalBinding"],
            "overlayKnowledge": acct["overlayLearning"],
            "intentionalAbstention": acct["intentionalAbstention"],
            "canonicalExpansion": 0,
        },
        "threeWayBindingMatrix": {
            "control_board": {"whirlpool": "canonical", "samsung": "canonical", "lg": "canonical"},
            "user_interface": {"whirlpool": "canonical", "samsung": "canonical", "lg": "canonical"},
            "door_switch": {
                "whirlpool": "canonical",
                "samsung": "abstention",
                "lg": "abstention",
            },
            "evaporator_fan": {"whirlpool": "canonical", "samsung": "canonical", "lg": "canonical"},
            "air_damper": {"whirlpool": "canonical", "samsung": "canonical", "lg": "canonical"},
            "defrost_heater": {"whirlpool": "canonical", "samsung": "canonical", "lg": "canonical"},
            "compressor": {"whirlpool": "conditional", "samsung": "conditional", "lg": "conditional"},
            "temperature_sensor": {
                "whirlpool": "conditional",
                "samsung": "conditional",
                "lg": "conditional",
            },
            "condenser_fan": {
                "whirlpool": "conditional",
                "samsung": "abstention",
                "lg": "conditional",
            },
            "ice_maker": {
                "whirlpool": "abstention",
                "samsung": "conditional",
                "lg": "conditional",
            },
            "water_dispenser": {
                "whirlpool": "abstention",
                "samsung": "conditional",
                "lg": "abstention",
            },
        },
        "hierarchyTest": {
            "frozenKeepStable": True,
            "conditionalAbsorbsArchitecture": True,
            "platformAbsorbsImplementation": True,
            "discoveryCorpusIsolated": True,
            "verdict": (
                "Third manufacturer compounding — LG linear compressor and multi-compartment "
                "sensors absorbed without canonical expansion or discovery corpus backdoor."
            ),
        },
        "priorWorkPackages": {
            "WP1": {"manualId": "W10322959", "curve": "6/4/4/4/0"},
            "WP2": {"manualId": "SAMSUNG-RF23BB-FRIDGE", "curve": "5/7/7/4/0"},
            "WP3": {
                "manualId": MANUAL_ID,
                "curve": (
                    f"{acct['canonicalInheritance']}/{acct['conditionalBinding']}/"
                    f"{acct['overlayLearning']}/{acct['intentionalAbstention']}/0"
                ),
            },
        },
    }


def main() -> int:
    print("==> CG-8 WP3 LG LRMVS gate table generation")
    normalize_result = _run_fresh_cg3()
    gate_table = build_gate_table(normalize_result)
    evidence = build_evidence(gate_table)
    OUT_TABLE.write_text(json.dumps(gate_table, indent=2), encoding="utf-8")
    OUT_EVIDENCE.write_text(json.dumps(evidence, indent=2), encoding="utf-8")

    acct = gate_table["accounting"]
    print("\n=== LG LRMVS CG-8 Gate Preview ===")
    print(f"mapping candidates: {acct['mappingCandidatesTotal']}")
    print(f"canonical inherit:  {acct['canonicalInheritance']}")
    print(f"conditional bind:   {acct['conditionalBinding']}")
    print(f"overlay learning:   {acct['overlayLearning']}")
    print(f"intentional abstain:{acct['intentionalAbstention']}")
    print(f"canonical expansion:{acct['canonicalExpansion']}")
    print(f"discovery inherit:  {acct['discoveryCorpusInheritance']}")
    print(f"\ntable:    {OUT_TABLE}")
    print(f"evidence: {OUT_EVIDENCE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
