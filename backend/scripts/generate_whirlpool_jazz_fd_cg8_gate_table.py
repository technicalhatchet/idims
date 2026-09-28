#!/usr/bin/env python3
"""CG-8 — Generate Whirlpool Jazz W10322959 overlay gate table against frozen french_door rev1.

Gate question: what does this manual teach us about the frozen contract?
Not: what components does this manual contain?
"""

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
PROCEDURE_SEED = KNOWLEDGE / "procedures" / "seed" / "whirlpool_jazz_french_door"

MANUAL_ID = "W10322959"
PLATFORM_ID = "whirlpool_jazz_french_door"
OUT_TABLE = CALIBRATION / "WHIRLPOOL_JAZZ_FD_overlay_mapping_table_v1.json"
OUT_EVIDENCE = CALIBRATION / "WHIRLPOOL_JAZZ_FD_CG8_COMPOUNDING_EVIDENCE_v1.json"
CONTRACT = CALIBRATION / "CG8_FRENCH_DOOR_COMPOUNDING_CONTRACT_v1.json"

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
CONDITIONAL = frozenset(
    {
        "temperature_sensor",
        "compressor",
        "condenser_fan",
        "ice_maker",
        "water_dispenser",
    }
)
PLATFORM_ONLY = frozenset(
    {
        "compressor_controller",
        "defrost_sensor",
        "water_inlet_valve",
        "sealed_system",
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


def _procedure_index() -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for path in sorted(PROCEDURE_SEED.glob("w10322959*.json")):
        proc = _load_json(path)
        if proc.get("id"):
            index[str(proc["id"])] = proc
    for path in sorted((PROCEDURE_SEED / "bundles").glob("w10322959*.json")):
        proc = _load_json(path)
        if proc.get("id"):
            index[str(proc["id"])] = proc
    return index


def _contract_teaching_rows() -> list[dict[str, Any]]:
    """Authoritative gate rows — contract teaching units, not raw matcher inventory."""
    return [
        {
            "teachingId": "jazz-control-board-vocabulary",
            "gateQuestion": "What does Jazz teach about frozen control_board?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "control_board",
            "procedureIds": [
                "w10322959-programming-mode",
                "w10322959-service-test-entry",
            ],
            "seedComponentIds": ["control_board"],
            "proposedAliases": {
                "jazz control board": "control_board",
                "programming mode": "control_board",
                "service test mode": "control_board",
            },
            "gateAction": "approve_human",
            "rationale": (
                "P-E programming, S-E orchestration, and service-test entry are independent "
                "control-domain diagnostics on Jazz — maps to frozen control_board."
            ),
        },
        {
            "teachingId": "jazz-door-switch-service-entry",
            "gateQuestion": "What does Jazz teach about frozen door_switch?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "door_switch",
            "procedureIds": [
                "w10322959-service-test-entry",
                "w10322959-forced-defrost-entry",
            ],
            "procedureRoleEvidence": True,
            "signalPhrases": ["door light switch", "hold door switch", "release door switch"],
            "gateAction": "approve_procedure_role_evidence",
            "rationale": (
                "No standalone door-switch component test — door authorization role evidenced in "
                "S-E / F-d / P-E entry steps. Maps to frozen door_switch; distinct from lock/latch."
            ),
        },
        {
            "teachingId": "jazz-user-interface-keypad",
            "gateQuestion": "What does Jazz teach about frozen user_interface?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "user_interface",
            "procedureIds": ["w10322959-service-test-entry", "w10322959-programming-mode"],
            "procedureRoleEvidence": True,
            "signalPhrases": ["refrigerator up", "freezer down", "keypad", "display shows"],
            "gateAction": "approve_procedure_role_evidence",
            "rationale": (
                "Jazz HMI is door keypad + segment display codes (S-E, F-d, P-E) — no separate "
                "display-panel comm procedure. Functional user_interface via entry/test interaction."
            ),
        },
        {
            "teachingId": "jazz-defrost-heater-test1",
            "gateQuestion": "What does Jazz teach about frozen defrost_heater?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "defrost_heater",
            "procedureIds": ["w10322959-test-01-defrost"],
            "seedComponentIds": ["defrost_heater"],
            "gateAction": "approve_human",
            "rationale": "Service test 1 heater path with cu-ft Ω specs — direct frozen defrost_heater inheritance.",
        },
        {
            "teachingId": "jazz-defrost-bimetal-platform",
            "gateQuestion": "What does Jazz teach about defrost termination sensing?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_platform_implementation",
            "platformTarget": "defrost_sensor",
            "conditionalConceptBinding": None,
            "procedureIds": ["w10322959-test-01-defrost"],
            "seedComponentIds": ["defrost_thermostat"],
            "implementationComponent": "defrost_thermostat",
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "Jazz bimetal/defrost_thermostat seed is platform termination vocabulary — "
                "maps to PLATFORM_ONLY defrost_sensor, not canonical expansion."
            ),
        },
        {
            "teachingId": "jazz-compressor-relay-conditional",
            "gateQuestion": "What does Jazz teach about frozen conditional compressor?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "compressor",
            "instanceScope": "relay_drive_em2y60",
            "procedureIds": ["w10322959-test-02-compressor"],
            "seedComponentIds": ["compressor"],
            "gateAction": "approve_conditional_binding",
            "rationale": (
                "Service test 2 exercises compressor actuator via relay-drive EM2Y60 path — "
                "conditionalConcept binding with Jazz relay/cap implementation overlay. "
                "Does NOT promote compressor to components[]."
            ),
        },
        {
            "teachingId": "jazz-compressor-relay-platform",
            "gateQuestion": "What does Jazz teach about compressor drive electronics?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_platform_implementation",
            "platformTarget": "compressor_controller",
            "procedureIds": ["w10322959-test-02-compressor"],
            "implementationComponents": ["relay", "start_capacitor", "em2y60"],
            "gateAction": "approve_platform_implementation",
            "rationale": (
                "Relay/cap/start-winding diagnostics on won't-run complaints — Jazz implementation "
                "of drive path. PLATFORM_ONLY compressor_controller — not canonical compressor."
            ),
        },
        {
            "teachingId": "jazz-condenser-fan-conditional",
            "gateQuestion": "What does Jazz teach about conditional condenser_fan?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "condenser_fan",
            "procedureIds": ["w10322959-test-02-compressor"],
            "seedComponentIds": ["condenser_fan"],
            "gateAction": "approve_conditional_binding",
            "rationale": (
                "Bundled with compressor test 2 — conditionalConcept condenser_fan binding. "
                "2/3 triangulation posture preserved; not unconditional canonical."
            ),
        },
        {
            "teachingId": "jazz-evaporator-fan-test3",
            "gateQuestion": "What does Jazz teach about frozen evaporator_fan?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "evaporator_fan",
            "instanceScope": "freezer",
            "procedureIds": ["w10322959-test-03-evap-fan"],
            "seedComponentIds": ["evap_fan"],
            "proposedAliases": {"evap_fan": "evaporator_fan", "freezer fan": "evaporator_fan"},
            "gateAction": "approve_human",
            "rationale": (
                "Service test 3 freezer/evaporator fan actuator — frozen evaporator_fan with "
                "freezer instance scope (multi-fan overlay later)."
            ),
        },
        {
            "teachingId": "jazz-ff-thermistor-conditional",
            "gateQuestion": "What does Jazz teach about conditional temperature_sensor (FF)?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "fresh_food",
            "procedureIds": ["w10322959-test-04-ff-thermistor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
            "rationale": (
                "FF thermistor service test 4 — compartment-scoped conditionalConcept binding. "
                "Generic undifferentiated temperature_sensor not created in canonical graph."
            ),
        },
        {
            "teachingId": "jazz-fz-thermistor-conditional",
            "gateQuestion": "What does Jazz teach about conditional temperature_sensor (FZ)?",
            "outcome": "conditional_binding",
            "layer": "conditional_concept_binding",
            "conditionalConcept": "temperature_sensor",
            "instanceScope": "freezer",
            "procedureIds": ["w10322959-test-05-fz-thermistor"],
            "seedComponentIds": ["thermistor"],
            "gateAction": "approve_conditional_binding",
            "rationale": "FZ thermistor service test 5 — separate instance scope under same conditionalConcept.",
        },
        {
            "teachingId": "jazz-air-damper-test6",
            "gateQuestion": "What does Jazz teach about frozen air_damper?",
            "outcome": "canonical_inheritance",
            "layer": "canonical_reuse",
            "canonicalTarget": "air_damper",
            "procedureIds": ["w10322959-test-06-damper"],
            "seedComponentIds": ["damper_motor"],
            "gateAction": "approve_human",
            "rationale": (
                "Service test 6 damper open/close toggle — functional air_damper. "
                "damper_motor seed is Jazz implementation surface in overlay."
            ),
        },
        {
            "teachingId": "jazz-damper-motor-platform",
            "gateQuestion": "What does Jazz teach about damper implementation?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_platform_implementation",
            "canonicalFunctionalRole": ["air_damper"],
            "implementationComponent": "damper_motor",
            "procedureIds": ["w10322959-test-06-damper"],
            "gateAction": "approve_platform_implementation",
            "rationale": "damper_motor seed implements frozen air_damper on Jazz — platform vocabulary.",
        },
        {
            "teachingId": "jazz-ff-performance-calibration",
            "gateQuestion": "What does test 7 teach about the frozen contract?",
            "outcome": "unresolved",
            "layer": "defer_platform_calibration",
            "procedureIds": ["w10322959-test-07-ff-performance"],
            "gateAction": "defer_human_review",
            "rationale": (
                "FF performance offset is control-board calibration parameter — not a new canonical "
                "or conditional component. Valid unresolved outcome."
            ),
        },
        {
            "teachingId": "jazz-fz-performance-calibration",
            "gateQuestion": "What does test 8 teach about the frozen contract?",
            "outcome": "unresolved",
            "layer": "defer_platform_calibration",
            "procedureIds": ["w10322959-test-08-fz-performance"],
            "gateAction": "defer_human_review",
            "rationale": "FZ performance offset — board calibration, not ontology expansion.",
        },
        {
            "teachingId": "jazz-defrost-interval-scheduling",
            "gateQuestion": "What does test 9 teach about the frozen contract?",
            "outcome": "unresolved",
            "layer": "defer_overlay_scheduling",
            "procedureIds": ["w10322959-test-09-defrost-interval"],
            "gateAction": "defer_human_review",
            "rationale": (
                "Adaptive vs fixed defrost interval is control-board scheduling knowledge — "
                "does NOT resurrect removed defrost_system aggregate."
            ),
        },
        {
            "teachingId": "jazz-sealed-system-complaint-routing",
            "gateQuestion": "Does Jazz warm-both routing teach sealed_system canonical?",
            "outcome": "overlay_knowledge",
            "layer": "whirlpool_model_specific",
            "platformTarget": "sealed_system",
            "gateAction": "reject_canonical_promotion",
            "rationale": (
                "Complaint routing mentions sealed system on warm-both — PLATFORM_ONLY vocabulary "
                "per CG-7 freeze. No procedure aggregate test; do not promote."
            ),
        },
        {
            "teachingId": "jazz-water-dispenser-gap",
            "gateQuestion": "Does optional water path teach conditional water_dispenser?",
            "outcome": "unresolved",
            "layer": "defer_optional_feature",
            "gateAction": "defer_human_review",
            "rationale": (
                "Extraction notes dual valve on equipped models only — insufficient Jazz procedure "
                "evidence to bind conditional water_dispenser. Unresolved is valid."
            ),
        },
    ]


def _classify_mapping_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    term = str(candidate.get("sourceTerm") or "")
    proc_id = (candidate.get("provenance") or {}).get("procedureId")
    cid = candidate.get("id")

    if term.startswith("Service Test") or term.startswith("Programming mode"):
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "reject_procedural_title",
            "outcome": "procedural_noise",
            "gateAction": "reject_procedural_title",
            "rationale": "OEM service-test title — bind by procedureId via contract teaching rows.",
        }

    term_lower = term.lower().replace(" ", "_")
    if term_lower in KEEP or term in KEEP:
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "canonical_reuse",
            "outcome": "canonical_inheritance",
            "gateAction": "see_contract_teaching_row",
        }
    if term_lower in ("evap_fan",):
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "canonical_reuse",
            "outcome": "canonical_inheritance",
            "canonicalTarget": "evaporator_fan",
            "gateAction": "see_contract_teaching_row",
        }
    if term_lower in ("compressor", "condenser_fan") or term in CONDITIONAL:
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "conditional_concept_binding",
            "outcome": "conditional_binding",
            "gateAction": "see_contract_teaching_row",
        }
    if term_lower in ("thermistor",):
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "conditional_concept_binding",
            "outcome": "conditional_binding",
            "conditionalConcept": "temperature_sensor",
            "gateAction": "see_contract_teaching_row",
        }
    if term_lower in ("defrost_thermostat",):
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "whirlpool_platform_implementation",
            "outcome": "overlay_knowledge",
            "platformTarget": "defrost_sensor",
            "gateAction": "see_contract_teaching_row",
        }
    if term_lower in ("damper_motor",):
        return {
            "candidateId": cid,
            "sourceTerm": term,
            "procedureId": proc_id,
            "disposition": "whirlpool_platform_implementation",
            "outcome": "overlay_knowledge",
            "gateAction": "see_contract_teaching_row",
        }
    return {
        "candidateId": cid,
        "sourceTerm": term,
        "procedureId": proc_id,
        "disposition": "unresolved",
        "outcome": "unresolved",
        "gateAction": "defer_human_review",
    }


def _flatten_mappings(teaching_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Gate table mappings[] compatible with dishwasher/TL gate publishers."""
    rows: list[dict[str, Any]] = []
    for row in teaching_rows:
        base = {
            "teachingId": row["teachingId"],
            "gateQuestion": row["gateQuestion"],
            "outcome": row["outcome"],
            "layer": row["layer"],
            "gateAction": row["gateAction"],
            "rationale": row["rationale"],
            "procedureIds": row.get("procedureIds") or [],
            "candidateIds": [],
        }
        if row.get("canonicalTarget"):
            base["manualConcept"] = row.get("seedComponentIds", [row["canonicalTarget"]])[0]
            base["candidate"] = row["canonicalTarget"]
        elif row.get("conditionalConcept"):
            base["manualConcept"] = (row.get("seedComponentIds") or [row["conditionalConcept"]])[0]
            base["conditionalConcept"] = row["conditionalConcept"]
            base["instanceScope"] = row.get("instanceScope")
        elif row.get("platformTarget"):
            base["manualConcept"] = row.get("implementationComponent") or row["platformTarget"]
            base["platformTarget"] = row["platformTarget"]
        else:
            base["manualConcept"] = row["teachingId"]
        rows.append(base)
    return rows


def build_gate_table(normalize_result: dict[str, Any]) -> dict[str, Any]:
    mapping_doc = _load_json(CANDIDATES / MANUAL_ID / "canonical_mapping_candidates.json")
    manifest = _load_json(CANDIDATES / MANUAL_ID / "pipeline_manifest.json")
    candidates = mapping_doc.get("candidates") or []
    teaching_rows = _contract_teaching_rows()
    candidate_dispositions = [_classify_mapping_candidate(c) for c in candidates]

    outcome_hist = Counter(r["outcome"] for r in teaching_rows)
    layer_hist = Counter(r["layer"] for r in teaching_rows)

    canonical_inheritance = sum(1 for r in teaching_rows if r["outcome"] == "canonical_inheritance")
    conditional_binding = sum(1 for r in teaching_rows if r["outcome"] == "conditional_binding")
    overlay_knowledge = sum(1 for r in teaching_rows if r["outcome"] == "overlay_knowledge")
    unresolved = sum(1 for r in teaching_rows if r["outcome"] == "unresolved")

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg8_fd_overlay_mapping_gate_table",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "platformFamilyId": PLATFORM_ID,
        "canonicalOntologyId": "french_door_refrigerator",
        "proposedOverlayFile": "whirlpool_jazz_french_door.json",
        "priorPublishedManualIds": [],
        "status": "gate_preview",
        "compoundingContract": "CG8_FRENCH_DOOR_COMPOUNDING_CONTRACT_v1.json",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "gateFraming": {
            "question": "What does this manual teach us about the frozen contract?",
            "not": "What components does this manual contain?",
            "validOutcomes": [
                "canonical_inheritance",
                "conditional_binding",
                "overlay_knowledge",
                "unresolved",
            ],
        },
        "pipelineManifest": str((CANDIDATES / MANUAL_ID / "pipeline_manifest.json").relative_to(ROOT)),
        "observationArtifact": "W10322959_fd_cg7x_observation_v1.json",
        "discoveryReferenceOnly": "CG-7 R1 observation — context only, not auto-inheritance",
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
        },
        "pipelineCounts": manifest.get("counts") or {},
        "gatePolicy": {
            "gateKind": "manufacturer_boundary_first_manual",
            "compoundingPhase": "CG-8",
            "canonicalGraph": "french_door_refrigerator.json rev1 FROZEN — zero new canonical concepts.",
            "freezeReopenBlocked": True,
            "publishBlocked": True,
        },
        "canonicalContract": {
            "graph": "french_door_refrigerator",
            "revision": "rev1",
            "frozen": True,
            "allowedCanonicalIds": sorted(KEEP),
            "conditionalBindingIds": sorted(CONDITIONAL),
            "overlayOnlyIds": sorted(PLATFORM_ONLY),
            "contractRule": "Conditional concepts bind in overlay — never promote to components[].",
        },
        "layerDefinitions": {
            "canonical_reuse": "Maps to one of 6 frozen KEEP components.",
            "conditional_concept_binding": "Maps to conditionalConcept with instance/drive scope — not components[].",
            "whirlpool_platform_implementation": "Jazz implementation vocabulary — overlay add.components / oemTermAliases.",
            "whirlpool_manufacturer_vocabulary": "Whirlpool OEM seed-id aliases independent of Samsung/LG.",
            "defer_platform_calibration": "Board calibration/scheduling — valid unresolved.",
            "defer_overlay_scheduling": "Adaptive defrost interval — not defrost_system aggregate.",
            "defer_optional_feature": "Optional equipped feature — insufficient procedure evidence.",
            "reject_procedural_title": "Service test title noise — procedureId binding only.",
        },
        "contractTeachingRows": teaching_rows,
        "mappings": _flatten_mappings(teaching_rows),
        "mappingCandidateDispositions": candidate_dispositions,
        "auditBoundaries": {
            "compressorRelayPath": [
                "jazz-compressor-relay-conditional",
                "jazz-compressor-relay-platform",
            ],
            "compartmentThermistors": [
                "jazz-ff-thermistor-conditional",
                "jazz-fz-thermistor-conditional",
            ],
            "jazzControlVocabulary": [
                "jazz-control-board-vocabulary",
                "jazz-user-interface-keypad",
                "jazz-door-switch-service-entry",
            ],
        },
        "accounting": {
            "contractTeachingRows": len(teaching_rows),
            "canonicalInheritance": canonical_inheritance,
            "conditionalBinding": conditional_binding,
            "overlayKnowledge": overlay_knowledge,
            "unresolved": unresolved,
            "mappingCandidatesTotal": len(candidates),
            "mappingCandidatesProceduralNoise": sum(
                1 for c in candidate_dispositions if c["outcome"] == "procedural_noise"
            ),
            "semanticLearningDecisions": 0,
            "matcherRoutingCorrections": 0,
            "canonicalExpansion": 0,
        },
        "outcomeHistogram": dict(outcome_hist),
        "layerHistogram": dict(layer_hist),
    }


def build_evidence(gate_table: dict[str, Any]) -> dict[str, Any]:
    acct = gate_table["accounting"]
    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg8_fd_compounding_evidence",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "compoundingPhase": "CG-8",
        "compoundingSequence": 1,
        "generatedAt": gate_table["generatedAt"],
        "canonicalOntology": {
            "id": "french_door_refrigerator",
            "revision": "rev1",
            "immutable": True,
        },
        "gateArtifact": OUT_TABLE.name,
        "compoundingCurve": {
            "framing": "contract_teaching_rows",
            "canonicalInheritance": acct["canonicalInheritance"],
            "conditionalBinding": acct["conditionalBinding"],
            "overlayKnowledge": acct["overlayKnowledge"],
            "unresolved": acct["unresolved"],
            "canonicalExpansion": 0,
            "note": (
                "First refrigerator compounding against frozen rev1 — compare curve shape to "
                "washer/dryer/dishwasher gate previews after human publish."
            ),
        },
        "hierarchyTest": {
            "frozenKeepStable": acct["canonicalInheritance"] >= 6,
            "conditionalAbsorbsArchitecture": acct["conditionalBinding"] >= 3,
            "platformAbsorbsImplementation": acct["overlayKnowledge"] >= 3,
            "unresolvedAllowed": acct["unresolved"] >= 3,
            "verdict": (
                "Jazz gate separates reusable functional knowledge (6 KEEP inheritance paths) "
                "from relay/thermistor/bimetal implementation (conditional + platform) without "
                "canonical expansion — hierarchy behaving as designed."
            ),
        },
        "nextSteps": [
            "Human review contractTeachingRows",
            "Approve gate actions",
            "Scaffold whirlpool_jazz_french_door.json overlay from approved rows",
            "Promotion dry-run then publish with promotion ID",
        ],
    }


def main() -> int:
    print("==> CG-8 Whirlpool Jazz W10322959 gate table generation")
    normalize_result = _run_fresh_cg3()
    gate_table = build_gate_table(normalize_result)
    evidence = build_evidence(gate_table)

    OUT_TABLE.write_text(json.dumps(gate_table, indent=2), encoding="utf-8")
    OUT_EVIDENCE.write_text(json.dumps(evidence, indent=2), encoding="utf-8")

    acct = gate_table["accounting"]
    print("\n=== Whirlpool Jazz CG-8 Gate Preview ===")
    print(f"mapping candidates: {acct['mappingCandidatesTotal']}")
    print(f"contract teaching:  {acct['contractTeachingRows']}")
    print(f"  canonical:        {acct['canonicalInheritance']}")
    print(f"  conditional:      {acct['conditionalBinding']}")
    print(f"  overlay:          {acct['overlayKnowledge']}")
    print(f"  unresolved:       {acct['unresolved']}")
    print(f"canonical expansion:{acct['canonicalExpansion']}")
    print(f"\ntable:    {OUT_TABLE}")
    print(f"evidence: {OUT_EVIDENCE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
