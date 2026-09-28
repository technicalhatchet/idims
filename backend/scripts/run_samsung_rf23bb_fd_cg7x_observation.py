#!/usr/bin/env python3
"""CG-7 R2 — Samsung RF23BB French-door boundary test vs R1 (no skeleton/canonical/ changes)."""

from __future__ import annotations

import json
import re
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
PROCEDURE_SEED = KNOWLEDGE / "procedures" / "seed" / "samsung_fridge_bespoke"
EXTRACTION_DOC = (
    KNOWLEDGE / "pattern-catalog" / "SAMSUNG_RF23BB_BESPOKE_FRIDGE_EXTRACTION.md"
)
EXTRACTED_TEXT = ROOT / "backend" / "docs" / "manuals" / "samsung fridge rf23bb-extracted.txt"
R1_REPORT = CALIBRATION / "W10322959_fd_cg7x_observation_v1.json"
CANDIDATE_GRAPH = CALIBRATION / "french_door_refrigerator_cg7x_candidate_v1.json"

TARGET_MANUAL = "SAMSUNG-RF23BB-FRIDGE"
PLATFORM_ID = "samsung_fridge_bespoke"
R1_MANUAL = "W10322959"

VERDICTS = frozenset(
    {
        "canonical_functional",
        "platform_implementation",
        "deferred",
        "needs_second_manual",
    }
)

CONCEPT_IDS = [
    "power_supply",
    "control_board",
    "user_interface",
    "temperature_sensor",
    "compressor",
    "compressor_controller",
    "condenser",
    "evaporator",
    "condenser_fan",
    "evaporator_fan",
    "air_damper",
    "airflow_path",
    "defrost_system",
    "defrost_heater",
    "defrost_sensor",
    "cooling_system",
    "door_switch",
    "door_heater",
    "water_inlet_valve",
    "water_dispenser",
    "water_level_sensor",
    "ice_maker",
    "humidity_control",
    "sealed_system",
]

R1_BOUNDARY_PRESSURE_POINTS = [
    "compressor",
    "compressor_controller",
    "condenser_fan",
    "evaporator_fan",
    "air_damper",
    "airflow_path",
    "temperature_sensor",
    "defrost_system",
    "defrost_heater",
    "cooling_system",
    "power_supply",
]

R1_PLATFORM_IMPLEMENTATION_CANDIDATES = [
    "compressor_controller",
    "defrost_sensor",
    "water_inlet_valve",
]


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def _run_fresh_cg3() -> dict[str, Any]:
    import sys

    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization

    manifest = load_manifest()
    entry = find_manual_entry(manifest, TARGET_MANUAL)
    print(f"==> CG-3 normalize {TARGET_MANUAL} (fresh)")
    return run_manual_normalization(entry)


def _load_procedure_index() -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for path in sorted(PROCEDURE_SEED.glob("samsungbespoke*.json")):
        proc = _load_json(path)
        proc_id = proc.get("id")
        if proc_id:
            index[proc_id] = proc
    return index


def _manual_text() -> str:
    return EXTRACTED_TEXT.read_text(encoding="utf-8") if EXTRACTED_TEXT.is_file() else ""


def _text_hits(text: str, patterns: tuple[str, ...]) -> list[str]:
    lower = _normalize(text)
    return [p for p in patterns if p in lower]


def _collect_samsung_evidence(
    procedure_index: dict[str, dict[str, Any]],
    manual_text: str,
) -> dict[str, Any]:
    seed_usage: Counter[str] = Counter()
    tag_usage: Counter[str] = Counter()
    procedure_by_seed: dict[str, list[str]] = {}
    for proc_id, proc in procedure_index.items():
        for seed_id in proc.get("componentIds") or []:
            seed_usage[str(seed_id)] += 1
            procedure_by_seed.setdefault(str(seed_id), []).append(proc_id)
        for tag in proc.get("tags") or []:
            tag_usage[str(tag)] += 1

    return {
        "procedureCount": len(procedure_index),
        "seedComponentUsage": dict(seed_usage),
        "tagUsage": dict(tag_usage.most_common(30)),
        "procedureBySeed": procedure_by_seed,
        "manualPhrases": {
            "compressor": _text_hits(manual_text, ("compressor", "inverter comp", "inverter pba")),
            "condenser": _text_hits(manual_text, ("condenser",)),
            "condenser_fan": _text_hits(manual_text, ("condenser fan",)),
            "door_switch": _text_hits(
                manual_text,
                ("door switch", "flex zone door switch", "freezer door switch"),
            ),
            "dispenser": _text_hits(manual_text, ("water dispenser", "dispenser", "autofill")),
            "defrost": _text_hits(manual_text, ("forced defrost", "f-def", "r-def", "defrost heater")),
            "humidity": _text_hits(manual_text, ("humidity",)),
            "ice_maker": _text_hits(manual_text, ("ice maker", "ice pipe", "ice room")),
            "inverter": _text_hits(manual_text, ("inverter pcb", "inverter pba", "main pcb and inverter")),
            "fans": _text_hits(manual_text, ("f-fan", "fridge fan", "c-fan")),
            "damper": _text_hits(manual_text, ("damper", "flex damper")),
        },
        "selfDiagnosisRows": [
            "freezer_sensor",
            "fridge_sensor",
            "defrost_sensor",
            "evap_fan",
            "defrost_heater",
            "damper_heater",
            "compressor",
            "inverter_board",
            "humidity_sensor",
            "ice_maker_sensor",
            "autofill",
        ],
    }


def _r2_evidence_block(
    *,
    verdict: str,
    rationale: str,
    procedure_ids: list[str] | None = None,
    seed_components: list[str] | None = None,
    manual_phrases: list[str] | None = None,
    diagnostic_codes: list[str] | None = None,
    oem_refs: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "verdict": verdict,
        "rationale": rationale,
        "procedureIds": procedure_ids or [],
        "seedComponentIds": seed_components or [],
        "manualPhrases": manual_phrases or [],
        "diagnosticCodes": diagnostic_codes or [],
        "oemRefs": oem_refs or [],
    }


def _build_boundary_evaluations(
    r1_evaluations: dict[str, Any],
    samsung: dict[str, Any],
    procedure_index: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    proc = procedure_index
    phrases = samsung["manualPhrases"]
    by_seed = samsung["procedureBySeed"]

    def r1_status(concept_id: str) -> str:
        return str(r1_evaluations[concept_id]["verdict"])

    evaluations: dict[str, dict[str, Any]] = {}

    def add(
        concept_id: str,
        *,
        r2: dict[str, Any],
        cross: str,
        disposition: str,
        boundary_question: str | None = None,
        platform_implementation_guard: str | None = None,
    ) -> None:
        if disposition not in VERDICTS:
            raise ValueError(disposition)
        evaluations[concept_id] = {
            "conceptId": concept_id,
            "r1Status": r1_status(concept_id),
            "r2Evidence": r2,
            "crossManufacturerResult": cross,
            "candidateDisposition": disposition,
            "boundaryQuestion": boundary_question,
            "platformImplementationGuard": platform_implementation_guard,
            "freezeEligible": False,
        }

    add(
        "compressor",
        r2=_r2_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "Samsung diagnostics route compressor faults through inverter PBA "
                "(44E/84C) and samsungbespoke-compressor-inverter — not a standalone "
                "compressor component procedure. §6-6 inverter COMP troubleshooting."
            ),
            procedure_ids=["samsungbespoke-compressor-inverter", "samsungbespoke-main-inverter-comm"],
            seed_components=["inverter_board"],
            manual_phrases=phrases["compressor"] + phrases["inverter"],
            diagnostic_codes=["44E", "84C"],
            oem_refs=["§5-1-2", "§6-6"],
        ),
        cross="implementation_diverges",
        disposition="needs_second_manual",
        boundary_question="Whirlpool exposes compressor as service-test actuator; Samsung exposes inverter architecture — canonical compressor node unresolved.",
        platform_implementation_guard="Do not canonicalize compressor from Samsung inverter exposure alone.",
    )

    add(
        "compressor_controller",
        r2=_r2_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "Distinct main↔inverter harness diagnostics (44Er) and inverter_board seed. "
                "Controller domain is explicit on Samsung inverter platforms."
            ),
            procedure_ids=["samsungbespoke-compressor-inverter", "samsungbespoke-main-inverter-comm"],
            seed_components=["inverter_board"],
            diagnostic_codes=["44E", "84C"],
            oem_refs=["§5-1-2"],
        ),
        cross="platform_specific_both_manuals",
        disposition="platform_implementation",
        boundary_question="Relay-drive Jazz vs inverter PBA — remains overlay implementation, not canonical expansion.",
        platform_implementation_guard="Must not become canonical merely because both manuals expose drive electronics.",
    )

    add(
        "condenser_fan",
        r2=_r2_evidence_block(
            verdict="deferred",
            rationale=(
                "No condenser_fan procedure or self-diagnosis row on RF23BB. C-FAN refers to "
                "convertible/evaporator-path fan, not condenser fan."
            ),
            procedure_ids=["samsungbespoke-convertible-fan"],
            seed_components=["evap_fan"],
            manual_phrases=phrases["fans"],
            diagnostic_codes=["22C"],
        ),
        cross="whirlpool_only_evidence",
        disposition="needs_second_manual",
        boundary_question="Whirlpool bundles condenser fan with compressor test 2; Samsung has no equivalent exposure in R2.",
    )

    add(
        "evaporator_fan",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "Three independent fan diagnostics: freezer-fan (22E), fridge-fan, convertible-fan (22C). "
                "Functional airflow actuator role recurs but architecture is multi-fan."
            ),
            procedure_ids=[
                "samsungbespoke-freezer-fan",
                "samsungbespoke-fridge-fan",
                "samsungbespoke-convertible-fan",
            ],
            seed_components=["evap_fan"],
            manual_phrases=phrases["fans"],
            diagnostic_codes=["22E", "22C"],
            oem_refs=["§5-1-2"],
        ),
        cross="functional_role_confirmed_needs_r3",
        disposition="needs_second_manual",
        boundary_question="Same functional role or architecture-dependent fan topology?",
    )

    add(
        "air_damper",
        r2=_r2_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "Samsung exposes damper_heater Ω checks on damper_motor seed — not damper position "
                "toggle like Whirlpool service test 6. Different implementation surface."
            ),
            procedure_ids=["samsungbespoke-damper-heater-135", "samsungbespoke-damper-heater-24"],
            seed_components=["damper_motor"],
            manual_phrases=phrases["damper"],
            oem_refs=["§5-1-2"],
        ),
        cross="implementation_diverges",
        disposition="needs_second_manual",
        boundary_question="Does fresh-food airflow control survive as functional air_damper across implementations?",
    )

    add(
        "airflow_path",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "Samsung decomposes into multiple evap_fan procedures plus damper heaters — no "
                "airflow_path aggregate named in manual or seeds."
            ),
            procedure_ids=[
                "samsungbespoke-fridge-fan",
                "samsungbespoke-freezer-fan",
                "samsungbespoke-convertible-fan",
                "samsungbespoke-damper-heater-135",
            ],
            manual_phrases=phrases["fans"] + phrases["damper"],
        ),
        cross="aggregate_unresolved_both_manuals",
        disposition="needs_second_manual",
        boundary_question="Does airflow deserve a canonical functional node vs fan+damper members?",
    )

    add(
        "temperature_sensor",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "Self-diagnosis splits fridge, freezer, flex-zone, ambient, and defrost NTCs into "
                "separate procedures — pressures generic temperature_sensor vs compartment roles."
            ),
            procedure_ids=[
                "samsungbespoke-fridge-sensor",
                "samsungbespoke-freezer-sensor",
                "samsungbespoke-flex-sensor",
                "samsungbespoke-ambient-sensor",
                "samsungbespoke-fridge-defrost-sensor",
                "samsungbespoke-freezer-defrost-sensor",
            ],
            seed_components=["thermistor"],
            diagnostic_codes=["F", "R"],
            oem_refs=["§5-1-2"],
        ),
        cross="compartment_split_pressure",
        disposition="needs_second_manual",
        boundary_question="Can generic temperature_sensor survive without prematurely splitting FF/FZ/flex/defrost domains?",
    )

    add(
        "defrost_system",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "Forced defrost in test mode (Fd) plus separate F-DEF/R-DEF sensor procedures and "
                "freezer-defrost-heater — evidence decomposes aggregate into components."
            ),
            procedure_ids=[
                "samsungbespoke-freezer-defrost-heater",
                "samsungbespoke-freezer-defrost-sensor",
                "samsungbespoke-fridge-defrost-sensor",
            ],
            manual_phrases=phrases["defrost"],
            oem_refs=["§5-1-2", "Test mode Fd"],
        ),
        cross="aggregate_vs_components",
        disposition="needs_second_manual",
        boundary_question="Does defrost_system aggregate recur or must canonical layer use separate functions?",
    )

    add(
        "defrost_heater",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "freezer-defrost-heater procedure with 63 Ω spec on CN20 — distinct actuator evidence "
                "matching Whirlpool test 1 heater path."
            ),
            procedure_ids=["samsungbespoke-freezer-defrost-heater"],
            seed_components=["heater"],
            manual_phrases=phrases["defrost"],
            oem_refs=["§5-1-2"],
        ),
        cross="functional_role_confirmed_needs_r3",
        disposition="needs_second_manual",
        boundary_question="Functional canonical defrost_heater vs implementation of broader defrost function?",
    )

    add(
        "defrost_sensor",
        r2=_r2_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "F-DEF and R-DEF NTC procedures use thermistor seed with defrost_sensor tags — "
                "compartment-specific platform naming, not a single canonical termination sensor."
            ),
            procedure_ids=[
                "samsungbespoke-freezer-defrost-sensor",
                "samsungbespoke-fridge-defrost-sensor",
            ],
            seed_components=["thermistor"],
            manual_phrases=phrases["defrost"],
            oem_refs=["§5-1-2"],
        ),
        cross="platform_specific_both_manuals",
        disposition="platform_implementation",
        boundary_question="Jazz bimetal vs Samsung F-DEF/R-DEF NTC — platform vocabulary only.",
        platform_implementation_guard="Do not canonicalize defrost_sensor from equivalent hardware exposure.",
    )

    add(
        "cooling_system",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "Complaint routing decomposes to inverter compressor, fans, and defrost components — "
                "no cooling_system aggregate test on Samsung."
            ),
            procedure_ids=["samsungbespoke-compressor-inverter"],
            manual_phrases=phrases["compressor"],
            oem_refs=["§6-6"],
        ),
        cross="aggregate_unresolved_both_manuals",
        disposition="needs_second_manual",
        boundary_question="Useful canonical abstraction or redundant with member actuators?",
    )

    add(
        "power_supply",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "Manual includes electrical safety and connector voltage tables but no dedicated "
                "supply-path service test — same implied-only posture as R1 Whirlpool."
            ),
            manual_phrases=_text_hits(
                _manual_text(),
                ("115 vac", "120 vac", "disconnect power", "voltage"),
            ),
        ),
        cross="both_implied_only",
        disposition="needs_second_manual",
        boundary_question="Functional appliance-level power_supply vs architecture-dependent implementation?",
    )

    add(
        "control_board",
        r2=_r2_evidence_block(
            verdict="canonical_functional",
            rationale=(
                "Main PBA orchestrates engineer/test mode, self-diagnosis, and inverter comm. "
                "Independent control domain on Samsung R2 evidence."
            ),
            procedure_ids=["samsungbespoke-main-panel-comm"],
            manual_phrases=phrases["inverter"] + ["engineer mode", "test mode"],
            diagnostic_codes=["41E", "46E"],
            oem_refs=["§5-1-2"],
        ),
        cross="functional_role_confirmed_needs_r3",
        disposition="needs_second_manual",
        boundary_question="R1 canonical_functional survives Samsung boundary — LG triangulation still required.",
    )

    add(
        "user_interface",
        r2=_r2_evidence_block(
            verdict="canonical_functional",
            rationale=(
                "display_panel seed for main-panel-comm; service entry via Fridge+FlexZone key holds "
                "and digital inner display test mode paths."
            ),
            procedure_ids=["samsungbespoke-main-panel-comm"],
            seed_components=["display_panel"],
            manual_phrases=["engineer mode", "test mode", "display"],
            diagnostic_codes=["41E"],
        ),
        cross="functional_role_confirmed_needs_r3",
        disposition="needs_second_manual",
        boundary_question="HMI surface confirmed on both manufacturers — freeze still blocked until R3.",
    )

    add(
        "door_switch",
        r2=_r2_evidence_block(
            verdict="canonical_functional",
            rationale=(
                "Manual documents Flex Zone door switch and Freezer door switch assemblies (§4-8, §4-9). "
                "Door authorization role distinct from cooling actuators."
            ),
            manual_phrases=phrases["door_switch"],
            oem_refs=["§4-8", "§4-9"],
        ),
        cross="functional_role_confirmed_needs_r3",
        disposition="needs_second_manual",
        boundary_question="R1 door light switch entry vs Samsung multi-door switches — functional role holds, naming differs.",
    )

    add(
        "condenser",
        r2=_r2_evidence_block(
            verdict="deferred",
            rationale="Condenser described as sealed-system physical component (§4-37) — no component-level diagnostic procedure.",
            manual_phrases=phrases["condenser"],
            oem_refs=["§4-37"],
        ),
        cross="both_deferred",
        disposition="deferred",
    )

    add(
        "evaporator",
        r2=_r2_evidence_block(
            verdict="deferred",
            rationale="No evaporator coil component test — physical node still not earned on Samsung.",
            manual_phrases=["evaporator"],
        ),
        cross="both_deferred",
        disposition="deferred",
    )

    add(
        "door_heater",
        r2=_r2_evidence_block(
            verdict="deferred",
            rationale="No door/mullion anti-sweat heater procedure — damper/ice duct heaters are distinct domains.",
            manual_phrases=phrases["damper"],
        ),
        cross="both_deferred",
        disposition="deferred",
    )

    add(
        "water_inlet_valve",
        r2=_r2_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "AutoFill overflow sensor on ice_maker_module — water path tied to dispenser/ice feature "
                "hardware, not standalone inlet valve procedure."
            ),
            procedure_ids=["samsungbespoke-autofill-overflow"],
            seed_components=["ice_maker_module"],
            manual_phrases=phrases["dispenser"],
        ),
        cross="platform_specific_both_manuals",
        disposition="platform_implementation",
        platform_implementation_guard="Do not canonicalize inlet valve from Samsung AutoFill overflow path alone.",
    )

    add(
        "water_dispenser",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale="§6-12 dispenser troubleshooting and AutoFill overflow procedure — feature domain evidenced on Samsung only.",
            procedure_ids=["samsungbespoke-autofill-overflow"],
            manual_phrases=phrases["dispenser"],
            oem_refs=["§6-12"],
        ),
        cross="samsung_only_feature_evidence",
        disposition="needs_second_manual",
        boundary_question="Optional feature domain — canonical only if LG triangulation agrees.",
    )

    add(
        "water_level_sensor",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale="AutoFill overflow voltage check (CN90) is fill/overflow sensing for dispenser feature.",
            procedure_ids=["samsungbespoke-autofill-overflow"],
            manual_phrases=["autofill", "overflow"],
        ),
        cross="samsung_only_feature_evidence",
        disposition="needs_second_manual",
    )

    add(
        "ice_maker",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "Multiple ice procedures: ice-maker-sensor, ice-pipe-heater, ice-room-fan/heater, "
                "ice-duct-heater — feature domain present on Samsung, absent on Jazz R1."
            ),
            procedure_ids=[
                "samsungbespoke-ice-maker-sensor",
                "samsungbespoke-ice-pipe-heater-72",
                "samsungbespoke-ice-room-fan",
                "samsungbespoke-ice-room-heater",
            ],
            seed_components=["ice_maker_module", "ice_pipe_heater"],
            manual_phrases=phrases["ice_maker"],
        ),
        cross="samsung_only_feature_evidence",
        disposition="needs_second_manual",
        boundary_question="Optional ice_maker canonical domain vs platform module — LG third vote required.",
    )

    add(
        "humidity_control",
        r2=_r2_evidence_block(
            verdict="needs_second_manual",
            rationale="humidity-sensor procedure on CN60 — absent on Jazz R1.",
            procedure_ids=["samsungbespoke-humidity-sensor"],
            seed_components=["thermistor"],
            manual_phrases=phrases["humidity"],
            oem_refs=["§5-1-2"],
        ),
        cross="samsung_only_feature_evidence",
        disposition="needs_second_manual",
    )

    add(
        "sealed_system",
        r2=_r2_evidence_block(
            verdict="deferred",
            rationale=(
                "Compressor/inverter troubleshooting decomposes sealed path — no sealed_system aggregate test."
            ),
            procedure_ids=["samsungbespoke-compressor-inverter"],
            manual_phrases=phrases["compressor"] + phrases["condenser"],
            oem_refs=["§6-6"],
        ),
        cross="both_deferred",
        disposition="deferred",
    )

    missing = set(CONCEPT_IDS) - set(evaluations)
    if missing:
        raise RuntimeError(f"missing boundary evaluations: {sorted(missing)}")
    return evaluations


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    r1_report = _load_json(R1_REPORT)
    r1_evaluations = r1_report.get("conceptEvaluations") or {}
    if not r1_evaluations:
        raise RuntimeError(f"R1 report missing conceptEvaluations: {R1_REPORT}")

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []
    procedure_index = _load_procedure_index()
    manual_text = _manual_text()
    samsung = _collect_samsung_evidence(procedure_index, manual_text)
    boundary = _build_boundary_evaluations(r1_evaluations, samsung, procedure_index)

    disposition_histogram = Counter(row["candidateDisposition"] for row in boundary.values())
    cross_histogram = Counter(row["crossManufacturerResult"] for row in boundary.values())

    boundary_pressure_summary = []
    for concept_id in R1_BOUNDARY_PRESSURE_POINTS:
        row = boundary[concept_id]
        boundary_pressure_summary.append(
            {
                "conceptId": concept_id,
                "r1Status": row["r1Status"],
                "candidateDisposition": row["candidateDisposition"],
                "crossManufacturerResult": row["crossManufacturerResult"],
                "boundaryQuestion": row.get("boundaryQuestion"),
            }
        )

    platform_guard_summary = [
        {
            "conceptId": concept_id,
            "r1Status": boundary[concept_id]["r1Status"],
            "candidateDisposition": boundary[concept_id]["candidateDisposition"],
            "guard": boundary[concept_id].get("platformImplementationGuard"),
        }
        for concept_id in R1_PLATFORM_IMPLEMENTATION_CANDIDATES
    ]

    disposition_deltas = []
    for concept_id, row in boundary.items():
        if row["r1Status"] != row["candidateDisposition"]:
            disposition_deltas.append(
                {
                    "conceptId": concept_id,
                    "r1Status": row["r1Status"],
                    "candidateDisposition": row["candidateDisposition"],
                }
            )

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg7_fd_refrigerator_r2_boundary_observation",
        "experiment": (
            "CG-7 R2 — Samsung RF23BB bespoke French-door boundary test against R1 Whirlpool "
            "Jazz evidence. Delta-focused; no cross-manual inference beyond W10322959 + RF23BB."
        ),
        "workstream": "CG-7",
        "stage": "R2_boundary_test",
        "manualId": TARGET_MANUAL,
        "platformId": PLATFORM_ID,
        "ontologyId": "french_door_refrigerator",
        "ontologyFrozen": False,
        "canonicalExpansion": 0,
        "freezeEligible": False,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "fresh_cg3_observation",
        "publishBlocked": True,
        "gateBlocked": True,
        "canonicalPromotionBlocked": True,
        "canonicalDirectoryMutable": False,
        "candidateSkeletonMutable": False,
        "crossManualInference": False,
        "r1Reference": {
            "manualId": R1_MANUAL,
            "platformId": r1_report.get("platformId"),
            "observationArtifact": R1_REPORT.name,
            "verdictHistogram": r1_report.get("verdictHistogram"),
        },
        "graphArtifacts": {
            "cg7xCandidate": str(CANDIDATE_GRAPH.relative_to(ROOT)),
            "r1Observation": R1_REPORT.name,
            "extractionDoc": str(EXTRACTION_DOC.relative_to(ROOT)),
            "extractedText": str(EXTRACTED_TEXT.relative_to(ROOT)),
            "procedureSeedDir": str(PROCEDURE_SEED.relative_to(ROOT)),
        },
        "pipelineCounts": manifest.get("counts") or {},
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
        },
        "conflicts": len(conflicts),
        "mappingSummary": {
            "total": len(mappings),
            "unresolved": sum(1 for m in mappings if m.get("status") == "UNRESOLVED_TERM"),
        },
        "samsungEvidenceSummary": samsung,
        "boundaryEvaluations": boundary,
        "boundaryPressureSummary": boundary_pressure_summary,
        "platformImplementationGuards": platform_guard_summary,
        "dispositionDeltas": disposition_deltas,
        "candidateDispositionHistogram": dict(disposition_histogram),
        "crossManufacturerResultHistogram": dict(cross_histogram),
        "recommendation": {
            "freezeCandidateNow": False,
            "rationale": (
                "R2 confirms functional-vs-implementation pressure on compressor path, temperature "
                "compartment split, multi-fan topology, and defrost decomposition. Platform candidates "
                "(compressor_controller, defrost_sensor, water_inlet_valve) must not auto-promote. "
                "Run R3 LG LRMVS triangulation before human freeze gate."
            ),
            "nextManual": "LG-LRMVS-FRIDGE",
            "nextStage": "R3_triangulation",
        },
        "pipelineDiscipline": {
            "flow": [
                "MANUAL_EVIDENCE",
                "R1_OBSERVATION",
                "CANDIDATE_GRAPH",
                "R2_BOUNDARY_TEST",
                "R3_TRIANGULATION",
                "HUMAN_FREEZE_GATE",
                "CANONICAL_REV1",
            ],
            "r2Constraints": [
                "SAMSUNG-RF23BB-FRIDGE only",
                "no candidate skeleton mutation",
                "no canonical/ mutation",
                "no gate",
                "no publish",
                "no freeze",
            ],
        },
    }


def main() -> int:
    print("==> CG-7 R2 Samsung RF23BB French-door boundary observation")
    if not R1_REPORT.is_file():
        print(f"FAIL: missing R1 report {R1_REPORT}", file=sys.stderr)
        return 1

    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)
    out = CALIBRATION / "SAMSUNG_RF23BB_fd_cg7x_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    pressure = report["boundaryPressureSummary"]
    print("\n=== SAMSUNG RF23BB FD CG-7 R2 Boundary Observation ===")
    print(f"procedures:     {report['pipelineCounts'].get('procedures')}")
    print(f"mappings:       {report['mappingSummary']['total']}")
    print(f"dispositions:   {report['candidateDispositionHistogram']}")
    print(f"cross results:  {report['crossManufacturerResultHistogram']}")
    print(f"R1->R2 deltas:   {len(report['dispositionDeltas'])} concepts changed disposition")
    print(f"freeze now?     {report['recommendation']['freezeCandidateNow']}")
    print(f"next:           {report['recommendation']['nextStage']} ({report['recommendation']['nextManual']})")
    print("\nBoundary pressure (R1 needs_second_manual focus):")
    for row in pressure:
        print(
            f"  {row['conceptId']:22} R1={row['r1Status']:22} "
            f"R2={row['candidateDisposition']:22} [{row['crossManufacturerResult']}]"
        )
    print(f"\nreport: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
