#!/usr/bin/env python3
"""CG-7 R3 — LG LRMVS French-door triangulation vs R1+R2 (no skeleton/canonical/ changes)."""

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
PROCEDURE_SEED = KNOWLEDGE / "procedures" / "seed" / "lg_lrmvs"
EXTRACTION_DOC = KNOWLEDGE / "pattern-catalog" / "LG_LRMVS3006S_EXTRACTION.md"
EXTRACTED_TEXT = ROOT / "backend" / "docs" / "manuals" / "Lg-lrmvs3006s-refrigerator-svc manual-extracted.txt"
R1_REPORT = CALIBRATION / "W10322959_fd_cg7x_observation_v1.json"
R2_REPORT = CALIBRATION / "SAMSUNG_RF23BB_fd_cg7x_observation_v1.json"
CANDIDATE_GRAPH = CALIBRATION / "french_door_refrigerator_cg7x_candidate_v1.json"

TARGET_MANUAL = "LG-LRMVS-FRIDGE"
PLATFORM_ID = "lg_lrmvs"
R1_MANUAL = "W10322959"
R2_MANUAL = "SAMSUNG-RF23BB-FRIDGE"

VERDICTS = frozenset(
    {
        "canonical_functional",
        "platform_implementation",
        "deferred",
        "needs_second_manual",
    }
)

FREEZE_DISPOSITIONS = frozenset(
    {
        "KEEP",
        "REMOVE",
        "CONDITIONAL",
        "PLATFORM_ONLY",
        "DEFER",
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

R3_FOCUS_BOUNDARIES = [
    "temperature_sensor",
    "defrost_system",
    "defrost_heater",
    "evaporator_fan",
    "air_damper",
    "airflow_path",
    "compressor",
    "cooling_system",
    "control_board",
    "user_interface",
    "door_switch",
    "ice_maker",
    "water_dispenser",
    "humidity_control",
    "water_level_sensor",
    "condenser_fan",
]


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").strip().lower())


def _run_fresh_cg3() -> dict[str, Any]:
    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization

    manifest = load_manifest()
    entry = find_manual_entry(manifest, TARGET_MANUAL)
    print(f"==> CG-3 normalize {TARGET_MANUAL} (fresh)")
    return run_manual_normalization(entry)


def _load_procedure_index() -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for path in sorted(PROCEDURE_SEED.glob("lglrmvs*.json")):
        proc = _load_json(path)
        proc_id = proc.get("id")
        if proc_id:
            index[proc_id] = proc
    bundle_dir = PROCEDURE_SEED / "bundles"
    if bundle_dir.is_dir():
        for path in sorted(bundle_dir.glob("lglrmvs*.json")):
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


def _collect_lg_evidence(
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
            "compressor": _text_hits(manual_text, ("compressor", "linear compressor", "linear")),
            "condenser": _text_hits(manual_text, ("condenser",)),
            "condenser_fan": _text_hits(manual_text, ("condenser fan", "e cf")),
            "door_switch": _text_hits(
                manual_text,
                ("door switch", "refrigerator door switch", "freezer door switch", "h/bar door switch"),
            ),
            "dispenser": _text_hits(manual_text, ("dispenser", "water dispenser", "dispenser motor")),
            "defrost": _text_hits(manual_text, ("defrost heater", "forced defrost", "f dh", "r dh")),
            "humidity": _text_hits(manual_text, ("humidity controlled crisper", "humidity")),
            "ice_maker": _text_hits(manual_text, ("ice maker", "in-door icemaker", "dispenser assembly ice")),
            "fans": _text_hits(manual_text, ("evaporator fan", "e rf", "e ff", "e if", "e cf")),
            "damper": _text_hits(manual_text, ("damper", "22 22")),
            "display": _text_hits(manual_text, ("display", "main pcb test button", "test mode")),
            "sealed_system": _text_hits(manual_text, ("sealed system", "e ch", "e cl", "leak cycle")),
        },
        "errorCodeFamilies": [
            "E_FS",
            "E_rS",
            "E_IS",
            "E_CS",
            "F_dS",
            "r_dS",
            "F_dH",
            "r_dH",
            "E_rF",
            "E_FF",
            "E_IF",
            "E_CF",
            "E_CO",
            "E_CH",
            "E_CL",
            "E_ID",
            "E_IU",
            "E_Od",
        ],
    }


def _r3_evidence_block(
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


def _build_triangulation_evaluations(
    r1_evaluations: dict[str, Any],
    r2_boundary: dict[str, Any],
    lg: dict[str, Any],
    procedure_index: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    phrases = lg["manualPhrases"]

    def r1_status(concept_id: str) -> str:
        return str(r1_evaluations[concept_id]["verdict"])

    def r2_status(concept_id: str) -> str:
        return str(r2_boundary[concept_id]["candidateDisposition"])

    evaluations: dict[str, dict[str, Any]] = {}

    def add(
        concept_id: str,
        *,
        r3: dict[str, Any],
        triangulation: str,
        disposition: str,
        freeze: str,
        boundary_question: str | None = None,
        freeze_rationale: str | None = None,
        platform_implementation_guard: str | None = None,
    ) -> None:
        if disposition not in VERDICTS:
            raise ValueError(disposition)
        if freeze not in FREEZE_DISPOSITIONS:
            raise ValueError(freeze)
        evaluations[concept_id] = {
            "conceptId": concept_id,
            "r1Status": r1_status(concept_id),
            "r2Status": r2_status(concept_id),
            "r3Evidence": r3,
            "triangulationResult": triangulation,
            "candidateDisposition": disposition,
            "freezeRecommendation": freeze,
            "freezeRationale": freeze_rationale,
            "boundaryQuestion": boundary_question,
            "platformImplementationGuard": platform_implementation_guard,
            "freezeEligible": freeze in {"KEEP", "CONDITIONAL", "PLATFORM_ONLY", "REMOVE"},
        }

    add(
        "control_board",
        r3=_r3_evidence_block(
            verdict="canonical_functional",
            rationale=(
                "Main PCB orchestrates test modes (x1/x2/x3), error-code flowcharts, and "
                "display communication (E CO). main_control seed on display-communication procedure."
            ),
            procedure_ids=["lglrmvs-display-communication", "lglrmvs-display-mode"],
            seed_components=["main_control"],
            manual_phrases=phrases["display"],
            diagnostic_codes=["E_CO"],
            oem_refs=["8-12", "9 PCB test modes"],
        ),
        triangulation="functional_role_triangulated",
        disposition="canonical_functional",
        freeze="KEEP",
        freeze_rationale="Independent control domain on all three manufacturers; R1 premature promotion reversed by R2, confirmed by LG.",
    )

    add(
        "user_interface",
        r3=_r3_evidence_block(
            verdict="canonical_functional",
            rationale=(
                "display_panel seed; E CO main-display comm procedure; display/demo mode service path. "
                "HMI surface is a distinct diagnostic domain on LG."
            ),
            procedure_ids=["lglrmvs-display-communication", "lglrmvs-display-mode"],
            seed_components=["display_panel"],
            manual_phrases=phrases["display"],
            diagnostic_codes=["E_CO"],
            oem_refs=["8-12", "13-1-15"],
        ),
        triangulation="functional_role_triangulated",
        disposition="canonical_functional",
        freeze="KEEP",
        freeze_rationale="HMI/display communication recurs across W Jazz, Samsung RF23BB, and LG LRMVS.",
    )

    add(
        "door_switch",
        r3=_r3_evidence_block(
            verdict="canonical_functional",
            rationale=(
                "Manual documents refrigerator, freezer, and HomeBar door switches (10-3-1/2/3) "
                "with troubleshooting steps. Door authorization role distinct from cooling actuators."
            ),
            manual_phrases=phrases["door_switch"],
            oem_refs=["10-3-1", "10-3-2", "10-3-3"],
        ),
        triangulation="functional_role_triangulated",
        disposition="canonical_functional",
        freeze="KEEP",
        freeze_rationale=(
            "Door switch functional role confirmed on all three: Jazz door light, Samsung multi-door, "
            "LG R/F/H-Bar switches."
        ),
    )

    add(
        "temperature_sensor",
        r3=_r3_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "LG splits cabinet sensors (E rS, E FS), icing room (E IS), convert drawer (E CS), "
                "and defrost NTCs (F dS, r dS) — reinforces compartment-specific roles, not a generic sensor."
            ),
            procedure_ids=[
                "lglrmvs-ff-sensor",
                "lglrmvs-fz-sensor",
                "lglrmvs-icing-sensor",
                "lglrmvs-convert-sensor",
                "lglrmvs-ff-defrost-sensor",
                "lglrmvs-fz-defrost-sensor",
            ],
            seed_components=["thermistor"],
            diagnostic_codes=["E_rS", "E_FS", "E_IS", "E_CS", "F_dS", "r_dS"],
            oem_refs=["8-1", "8-2", "8-3", "8-4", "8-5", "8-22-CS"],
        ),
        triangulation="compartment_split_triangulated",
        disposition="platform_implementation",
        freeze="CONDITIONAL",
        freeze_rationale=(
            "Generic temperature_sensor does not survive triangulation. Freeze as compartment-scoped "
            "overlay bindings (FF/FZ/convert/icing/defrost) rather than a single canonical node."
        ),
        boundary_question="Resolved: compartment/function-specific sensors, not one generic canonical sensor.",
    )

    add(
        "compressor",
        r3=_r3_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "LG exposes linear compressor via sealed-system leak cycle (E CH/E CL) and "
                "compressor troubleshooting section — functional refrigeration actuator, but "
                "implementation surface differs from Jazz relay test vs Samsung inverter PBA."
            ),
            procedure_ids=["lglrmvs-sealed-system"],
            seed_components=["compressor", "sealed_system"],
            manual_phrases=phrases["compressor"],
            diagnostic_codes=["E_CH", "E_CL"],
            oem_refs=["8-22-CHCL", "11 compressor troubleshooting"],
        ),
        triangulation="implementation_diverges_functional_role_holds",
        disposition="needs_second_manual",
        freeze="CONDITIONAL",
        freeze_rationale=(
            "Compressor functional node justified with platform overlays for relay (Jazz), inverter (Samsung), "
            "and linear (LG) drive paths. Do not collapse controller/inverter into canonical compressor."
        ),
        boundary_question="Functional compressor node with mandatory platform implementation children.",
        platform_implementation_guard="Never canonicalize inverter/linear drive electronics as compressor.",
    )

    add(
        "compressor_controller",
        r3=_r3_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "LG linear compressor platform uses main PCB test orchestration but no separate "
                "inverter-board procedure like Samsung. Drive electronics remain architecture-dependent."
            ),
            procedure_ids=["lglrmvs-display-communication"],
            seed_components=["main_control"],
            manual_phrases=phrases["compressor"] + phrases["display"],
            oem_refs=["11 compressor troubleshooting"],
        ),
        triangulation="platform_specific_all_manuals",
        disposition="platform_implementation",
        freeze="PLATFORM_ONLY",
        freeze_rationale="Relay vs inverter vs linear PCB domains — overlay only, never canonical expansion.",
        platform_implementation_guard="Demonstrated platform-specific on all three manuals.",
    )

    add(
        "condenser_fan",
        r3=_r3_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "Dedicated condenser fan procedure (E CF) on CON3 — restores evidence missing on Samsung. "
                "Whirlpool bundles with compressor test 2; LG isolates condenser fan."
            ),
            procedure_ids=["lglrmvs-condenser-fan"],
            seed_components=["evap_fan"],
            manual_phrases=phrases["condenser_fan"],
            diagnostic_codes=["E_CF"],
            oem_refs=["8-11"],
        ),
        triangulation="partial_triangulation_2_of_3",
        disposition="needs_second_manual",
        freeze="CONDITIONAL",
        freeze_rationale=(
            "Condenser fan functional role on W+LG but absent as standalone diagnostic on Samsung. "
            "Canonical only with multi-instance/compartment overlay; not universal without Samsung gap noted."
        ),
        boundary_question="2/3 exposure — Samsung C-FAN is convertible/evap path, not condenser.",
    )

    add(
        "evaporator_fan",
        r3=_r3_evidence_block(
            verdict="canonical_functional",
            rationale=(
                "Three evaporator-path fans on LG (E rF fridge, E FF freezer, E IF icing) plus "
                "condenser fan separate — multi-fan topology matches W and Samsung decomposition."
            ),
            procedure_ids=["lglrmvs-ff-fan", "lglrmvs-fz-fan", "lglrmvs-icing-fan"],
            seed_components=["evap_fan"],
            manual_phrases=phrases["fans"],
            diagnostic_codes=["E_rF", "E_FF", "E_IF"],
            oem_refs=["8-8", "8-9", "8-10"],
        ),
        triangulation="functional_role_triangulated_multi_instance",
        disposition="canonical_functional",
        freeze="KEEP",
        freeze_rationale="Evaporator fan functional role triangulated; canonical node accepts multi-instance overlay per compartment.",
    )

    add(
        "air_damper",
        r3=_r3_evidence_block(
            verdict="canonical_functional",
            rationale=(
                "Damper test mode (test button x2, display 22 22) closes damper and verifies "
                "chill-room airflow — functional airflow control distinct from fan actuators."
            ),
            procedure_ids=["lglrmvs-damper-test"],
            manual_phrases=phrases["damper"],
            oem_refs=["9 test mode 2", "damper test bundle"],
        ),
        triangulation="functional_role_triangulated_implementation_varies",
        disposition="canonical_functional",
        freeze="KEEP",
        freeze_rationale=(
            "Air damper functional role on all three: Jazz service test 6, Samsung damper heater path, "
            "LG damper close test. Implementation surfaces differ; functional node holds."
        ),
    )

    add(
        "airflow_path",
        r3=_r3_evidence_block(
            verdict="deferred",
            rationale=(
                "LG decomposes into compartment fans + damper test — no airflow_path aggregate "
                "named in manual, seeds, or error-code families."
            ),
            procedure_ids=[
                "lglrmvs-ff-fan",
                "lglrmvs-fz-fan",
                "lglrmvs-icing-fan",
                "lglrmvs-damper-test",
            ],
            manual_phrases=phrases["fans"] + phrases["damper"],
        ),
        triangulation="aggregate_rejected_all_manuals",
        disposition="deferred",
        freeze="REMOVE",
        freeze_rationale="No independent diagnostic meaning on any manufacturer; redundant with fan+damper members.",
    )

    add(
        "defrost_system",
        r3=_r3_evidence_block(
            verdict="deferred",
            rationale=(
                "LG exposes separate FF/FZ defrost heaters and defrost sensors plus forced defrost "
                "via test mode — aggregate defrost_system never appears as a test target."
            ),
            procedure_ids=[
                "lglrmvs-ff-defrost-heater",
                "lglrmvs-fz-defrost-heater",
                "lglrmvs-ff-defrost-sensor",
                "lglrmvs-fz-defrost-sensor",
            ],
            manual_phrases=phrases["defrost"],
            diagnostic_codes=["F_dH", "r_dH", "F_dS", "r_dS"],
            oem_refs=["8-4", "8-5", "8-6", "8-7"],
        ),
        triangulation="aggregate_rejected_decomposes_to_components",
        disposition="deferred",
        freeze="REMOVE",
        freeze_rationale="Defrost orchestration decomposes to heater/sensor/fan members on all three manuals.",
    )

    add(
        "defrost_heater",
        r3=_r3_evidence_block(
            verdict="canonical_functional",
            rationale=(
                "Separate freezer (F dH) and fresh-food (r dH) defrost heater procedures with "
                "distinct error codes — third manufacturer confirming compartment-scoped heater role."
            ),
            procedure_ids=["lglrmvs-fz-defrost-heater", "lglrmvs-ff-defrost-heater"],
            seed_components=["heater"],
            manual_phrases=phrases["defrost"],
            diagnostic_codes=["F_dH", "r_dH"],
            oem_refs=["8-6", "8-7"],
        ),
        triangulation="functional_role_triangulated",
        disposition="canonical_functional",
        freeze="KEEP",
        freeze_rationale="Defrost heater functional role confirmed W+S+LG; may require FF/FZ overlay instances.",
    )

    add(
        "defrost_sensor",
        r3=_r3_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "F dS and r dS compartment defrost NTC procedures — same compartment-split pattern "
                "as Samsung F-DEF/R-DEF and Jazz bimetal terminology."
            ),
            procedure_ids=["lglrmvs-fz-defrost-sensor", "lglrmvs-ff-defrost-sensor"],
            seed_components=["thermistor"],
            diagnostic_codes=["F_dS", "r_dS"],
            oem_refs=["8-4", "8-5"],
        ),
        triangulation="platform_specific_all_manuals",
        disposition="platform_implementation",
        freeze="PLATFORM_ONLY",
        freeze_rationale="Compartment-specific defrost termination vocabulary — platform overlay, not canonical node.",
        platform_implementation_guard="Do not canonicalize defrost_sensor from equivalent hardware on three manuals.",
    )

    add(
        "cooling_system",
        r3=_r3_evidence_block(
            verdict="deferred",
            rationale=(
                "LG sealed-system procedure targets leak cycle (E CH/E CL) on compressor path — "
                "not a cooling_system aggregate. Complaint routing still decomposes to members."
            ),
            procedure_ids=["lglrmvs-sealed-system"],
            manual_phrases=phrases["sealed_system"] + phrases["compressor"],
            diagnostic_codes=["E_CH", "E_CL"],
            oem_refs=["8-22-CHCL"],
        ),
        triangulation="aggregate_rejected_all_manuals",
        disposition="deferred",
        freeze="REMOVE",
        freeze_rationale="cooling_system adds no diagnostic structure beyond compressor/fan/defrost members.",
    )

    add(
        "power_supply",
        r3=_r3_evidence_block(
            verdict="deferred",
            rationale=(
                "Electrical safety and voltage tables present; no dedicated supply-path service test "
                "on LG — same implied-only posture as R1 and R2."
            ),
            manual_phrases=_text_hits(
                _manual_text(),
                ("115 vac", "120 vac", "disconnect power", "voltage"),
            ),
        ),
        triangulation="implied_only_all_manuals",
        disposition="deferred",
        freeze="DEFER",
        freeze_rationale="No manufacturer exposes appliance-level power_supply as an independent diagnostic target.",
    )

    add(
        "condenser",
        r3=_r3_evidence_block(
            verdict="deferred",
            rationale="Physical sealed-system component described — no component-level diagnostic procedure on LG.",
            manual_phrases=phrases["condenser"],
        ),
        triangulation="physical_component_no_diagnostic",
        disposition="deferred",
        freeze="DEFER",
    )

    add(
        "evaporator",
        r3=_r3_evidence_block(
            verdict="deferred",
            rationale="No evaporator coil component test on LG — physical node still not earned.",
            manual_phrases=["evaporator"],
        ),
        triangulation="physical_component_no_diagnostic",
        disposition="deferred",
        freeze="DEFER",
    )

    add(
        "door_heater",
        r3=_r3_evidence_block(
            verdict="deferred",
            rationale="No door/mullion anti-sweat heater diagnostic procedure on LG.",
        ),
        triangulation="no_diagnostic_exposure",
        disposition="deferred",
        freeze="DEFER",
    )

    add(
        "water_inlet_valve",
        r3=_r3_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "LG dispenser troubleshooting references dispenser motor/duct — water inlet path tied "
                "to feature hardware, not standalone inlet valve procedure (same as Samsung)."
            ),
            manual_phrases=phrases["dispenser"],
            oem_refs=["10-4", "10-5"],
        ),
        triangulation="platform_specific_all_manuals",
        disposition="platform_implementation",
        freeze="PLATFORM_ONLY",
        platform_implementation_guard="Inlet valve remains feature/platform vocabulary only.",
    )

    add(
        "water_dispenser",
        r3=_r3_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "LG documents dispenser motor, ice/water/crushed modes, and dispenser assembly — "
                "feature domain on Samsung+LG, absent on Jazz R1."
            ),
            manual_phrases=phrases["dispenser"],
            oem_refs=["10-4", "10-5", "3-11"],
        ),
        triangulation="optional_feature_2_of_3",
        disposition="needs_second_manual",
        freeze="CONDITIONAL",
        freeze_rationale=(
            "Optional feature-domain node — include in rev1 only as conditional/optional appliance feature, "
            "not core refrigeration canonical set."
        ),
    )

    add(
        "water_level_sensor",
        r3=_r3_evidence_block(
            verdict="deferred",
            rationale=(
                "No AutoFill/overflow or fill-level diagnostic procedure on LG — remains Samsung-only "
                "diagnostic exposure from R2."
            ),
            manual_phrases=phrases["dispenser"],
        ),
        triangulation="samsung_only_diagnostic",
        disposition="deferred",
        freeze="DEFER",
        freeze_rationale="Insufficient cross-manufacturer diagnostic evidence for water_level_sensor.",
    )

    add(
        "ice_maker",
        r3=_r3_evidence_block(
            verdict="needs_second_manual",
            rationale=(
                "lglrmvs-ice-maker-electrical (E ID / E IU) — ice maker kit electrical diagnostics "
                "on LG; Samsung has richer ice subsystem; Jazz R1 absent."
            ),
            procedure_ids=["lglrmvs-ice-maker-electrical"],
            seed_components=["ice_maker_module"],
            manual_phrases=phrases["ice_maker"],
            diagnostic_codes=["E_ID", "E_IU"],
            oem_refs=["8-24"],
        ),
        triangulation="optional_feature_2_of_3",
        disposition="needs_second_manual",
        freeze="CONDITIONAL",
        freeze_rationale=(
            "Optional feature domain with 2/3 manufacturer evidence (Samsung+LG). Conditional canonical "
            "only if human freeze accepts optional-feature nodes."
        ),
    )

    add(
        "humidity_control",
        r3=_r3_evidence_block(
            verdict="deferred",
            rationale=(
                "Humidity-controlled crisper described in product overview only — no humidity sensor "
                "diagnostic procedure on LG (contrast Samsung humidity-sensor procedure)."
            ),
            manual_phrases=phrases["humidity"],
        ),
        triangulation="samsung_only_diagnostic",
        disposition="deferred",
        freeze="DEFER",
        freeze_rationale="Diagnostic exposure remains Samsung-only; LG has mechanical crisper only.",
    )

    add(
        "sealed_system",
        r3=_r3_evidence_block(
            verdict="platform_implementation",
            rationale=(
                "LG has explicit sealed-system leak cycle procedure (E CH/E CL) — aggregate diagnostic "
                "unique to LG among the three manuals; W and Samsung decompose sealed path."
            ),
            procedure_ids=["lglrmvs-sealed-system"],
            seed_components=["sealed_system", "compressor"],
            manual_phrases=phrases["sealed_system"],
            diagnostic_codes=["E_CH", "E_CL"],
            oem_refs=["8-22-CHCL"],
        ),
        triangulation="lg_only_aggregate_diagnostic",
        disposition="platform_implementation",
        freeze="PLATFORM_ONLY",
        freeze_rationale="sealed_system aggregate is LG-platform diagnostic vocabulary, not triangulated canonical.",
    )

    missing = set(CONCEPT_IDS) - set(evaluations)
    if missing:
        raise RuntimeError(f"missing triangulation evaluations: {sorted(missing)}")
    return evaluations


def _new_observation_candidates(procedure_index: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """LG findings outside the 24-concept skeleton — record only, do not expand candidate graph."""
    candidates: list[dict[str, Any]] = []
    if "lglrmvs-wifi-modem" in procedure_index:
        candidates.append(
            {
                "suggestedId": "wifi_modem",
                "rationale": (
                    "LG E Od Wi-Fi modem communication procedure — connected-appliance overlay domain, "
                    "not refrigeration canonical."
                ),
                "procedureIds": ["lglrmvs-wifi-modem"],
                "diagnosticCodes": ["E_Od"],
                "action": "observation_only_do_not_add_to_skeleton",
            }
        )
    candidates.append(
        {
            "suggestedId": "icing_compartment",
            "rationale": (
                "LG icing room fan (E IF) and sensor (E IS) — compartment extension under "
                "temperature_sensor / evaporator_fan overlays, not a new skeleton concept."
            ),
            "procedureIds": ["lglrmvs-icing-fan", "lglrmvs-icing-sensor"],
            "diagnosticCodes": ["E_IF", "E_IS"],
            "action": "observation_only_do_not_add_to_skeleton",
        }
    )
    return candidates


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    r1_report = _load_json(R1_REPORT)
    r2_report = _load_json(R2_REPORT)
    r1_evaluations = r1_report.get("conceptEvaluations") or {}
    r2_boundary = r2_report.get("boundaryEvaluations") or {}
    if not r1_evaluations:
        raise RuntimeError(f"R1 report missing conceptEvaluations: {R1_REPORT}")
    if not r2_boundary:
        raise RuntimeError(f"R2 report missing boundaryEvaluations: {R2_REPORT}")

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []
    procedure_index = _load_procedure_index()
    manual_text = _manual_text()
    lg = _collect_lg_evidence(procedure_index, manual_text)
    triangulation = _build_triangulation_evaluations(
        r1_evaluations, r2_boundary, lg, procedure_index
    )

    disposition_histogram = Counter(row["candidateDisposition"] for row in triangulation.values())
    triangulation_histogram = Counter(row["triangulationResult"] for row in triangulation.values())
    freeze_histogram = Counter(row["freezeRecommendation"] for row in triangulation.values())

    boundary_focus_summary = []
    for concept_id in R3_FOCUS_BOUNDARIES:
        row = triangulation[concept_id]
        boundary_focus_summary.append(
            {
                "conceptId": concept_id,
                "r1Status": row["r1Status"],
                "r2Status": row["r2Status"],
                "candidateDisposition": row["candidateDisposition"],
                "triangulationResult": row["triangulationResult"],
                "freezeRecommendation": row["freezeRecommendation"],
                "boundaryQuestion": row.get("boundaryQuestion"),
            }
        )

    r2_to_r3_deltas = []
    for concept_id, row in triangulation.items():
        if row["r2Status"] != row["candidateDisposition"]:
            r2_to_r3_deltas.append(
                {
                    "conceptId": concept_id,
                    "r2Status": row["r2Status"],
                    "candidateDisposition": row["candidateDisposition"],
                    "freezeRecommendation": row["freezeRecommendation"],
                }
            )

    r1_trio_recovery = [
        {
            "conceptId": cid,
            "r1Status": triangulation[cid]["r1Status"],
            "r2Status": triangulation[cid]["r2Status"],
            "candidateDisposition": triangulation[cid]["candidateDisposition"],
            "freezeRecommendation": triangulation[cid]["freezeRecommendation"],
        }
        for cid in ("control_board", "user_interface", "door_switch")
    ]

    keep_count = freeze_histogram.get("KEEP", 0)
    freeze_eligible = keep_count > 0

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg7_fd_refrigerator_r3_triangulation_observation",
        "experiment": (
            "CG-7 R3 — LG LRMVS French-door triangulation tie-breaker against R1 Whirlpool Jazz "
            "and R2 Samsung RF23BB. Focus on accumulated boundary questions; no skeleton/canonical mutation."
        ),
        "workstream": "CG-7",
        "stage": "R3_triangulation",
        "manualId": TARGET_MANUAL,
        "platformId": PLATFORM_ID,
        "ontologyId": "french_door_refrigerator",
        "ontologyFrozen": False,
        "canonicalExpansion": 0,
        "freezeEligible": freeze_eligible,
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
        "r2Reference": {
            "manualId": R2_MANUAL,
            "platformId": r2_report.get("platformId"),
            "observationArtifact": R2_REPORT.name,
            "candidateDispositionHistogram": r2_report.get("candidateDispositionHistogram"),
        },
        "graphArtifacts": {
            "cg7xCandidate": str(CANDIDATE_GRAPH.relative_to(ROOT)),
            "r1Observation": R1_REPORT.name,
            "r2Observation": R2_REPORT.name,
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
        "lgEvidenceSummary": lg,
        "triangulationEvaluations": triangulation,
        "boundaryFocusSummary": boundary_focus_summary,
        "r1TrioRecovery": r1_trio_recovery,
        "r2ToR3DispositionDeltas": r2_to_r3_deltas,
        "newObservationCandidates": _new_observation_candidates(procedure_index),
        "candidateDispositionHistogram": dict(disposition_histogram),
        "triangulationResultHistogram": dict(triangulation_histogram),
        "freezeRecommendationHistogram": dict(freeze_histogram),
        "recommendation": {
            "humanFreezeGateReady": True,
            "rationale": (
                "R3 triangulation complete across Whirlpool Jazz, Samsung RF23BB, and LG LRMVS. "
                "Six KEEP nodes (control_board, user_interface, door_switch, evaporator_fan, "
                "air_damper, defrost_heater), four REMOVE aggregates (airflow_path, defrost_system, "
                "cooling_system), CONDITIONAL nodes for compressor/temperature_sensor/condenser_fan/"
                "optional features, PLATFORM_ONLY for drive/defrost-sensor/sealed_system, DEFER for "
                "implied-only and physical nodes. Human freeze gate required before canonical/ rev1."
            ),
            "nextStage": "HUMAN_FREEZE_GATE",
            "freezeArtifact": "FRENCH_DOOR_REFRIGERATOR_CG7_FREEZE_RECOMMENDATION_v1.json",
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
            "r3Constraints": [
                "LG-LRMVS-FRIDGE only",
                "no candidate skeleton mutation",
                "no canonical/ mutation",
                "no gate",
                "no publish",
                "no automatic freeze",
            ],
        },
    }


def build_freeze_recommendation(r3_report: dict[str, Any]) -> dict[str, Any]:
    evaluations = r3_report["triangulationEvaluations"]
    by_freeze: dict[str, list[str]] = {k: [] for k in sorted(FREEZE_DISPOSITIONS)}
    concept_rows = []
    for concept_id in CONCEPT_IDS:
        row = evaluations[concept_id]
        freeze = row["freezeRecommendation"]
        by_freeze[freeze].append(concept_id)
        concept_rows.append(
            {
                "conceptId": concept_id,
                "r1Status": row["r1Status"],
                "r2Status": row["r2Status"],
                "candidateDisposition": row["candidateDisposition"],
                "triangulationResult": row["triangulationResult"],
                "freezeRecommendation": freeze,
                "freezeRationale": row.get("freezeRationale"),
            }
        )

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg7_fd_refrigerator_freeze_recommendation",
        "workstream": "CG-7",
        "stage": "freeze_recommendation_draft",
        "ontologyId": "french_door_refrigerator",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "canonicalExpansion": 0,
        "humanApprovalRequired": True,
        "canonicalDirectoryMutable": False,
        "observationArtifacts": {
            "r1": R1_REPORT.name,
            "r2": R2_REPORT.name,
            "r3": "LG_LRMVS_fd_cg7x_observation_v1.json",
        },
        "manufacturers": [
            {"round": "R1", "manualId": R1_MANUAL, "platformId": "whirlpool_jazz_french_door"},
            {"round": "R2", "manualId": R2_MANUAL, "platformId": "samsung_fridge_bespoke"},
            {"round": "R3", "manualId": TARGET_MANUAL, "platformId": PLATFORM_ID},
        ],
        "freezeRecommendationHistogram": r3_report["freezeRecommendationHistogram"],
        "dispositionBuckets": by_freeze,
        "conceptRecommendations": concept_rows,
        "summary": {
            "keep": by_freeze["KEEP"],
            "remove": by_freeze["REMOVE"],
            "conditional": by_freeze["CONDITIONAL"],
            "platformOnly": by_freeze["PLATFORM_ONLY"],
            "defer": by_freeze["DEFER"],
        },
        "gateNote": (
            "This artifact is a draft freeze recommendation only. No changes to "
            "french_door_refrigerator_cg7x_candidate_v1.json or canonical/ until human approval."
        ),
    }


def main() -> int:
    print("==> CG-7 R3 LG LRMVS French-door triangulation observation")
    if not R1_REPORT.is_file():
        print(f"FAIL: missing R1 report {R1_REPORT}", file=sys.stderr)
        return 1
    if not R2_REPORT.is_file():
        print(f"FAIL: missing R2 report {R2_REPORT}", file=sys.stderr)
        return 1

    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)
    out = CALIBRATION / "LG_LRMVS_fd_cg7x_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    freeze = build_freeze_recommendation(report)
    freeze_out = CALIBRATION / "FRENCH_DOOR_REFRIGERATOR_CG7_FREEZE_RECOMMENDATION_v1.json"
    freeze_out.write_text(json.dumps(freeze, indent=2), encoding="utf-8")

    print("\n=== LG LRMVS FD CG-7 R3 Triangulation Observation ===")
    print(f"procedures:     {report['pipelineCounts'].get('procedures')}")
    print(f"mappings:       {report['mappingSummary']['total']}")
    print(f"dispositions:   {report['candidateDispositionHistogram']}")
    print(f"triangulation:  {report['triangulationResultHistogram']}")
    print(f"freeze recs:    {report['freezeRecommendationHistogram']}")
    print(f"R2->R3 deltas:  {len(report['r2ToR3DispositionDeltas'])} concepts changed disposition")
    print(f"freeze gate?    {report['recommendation']['humanFreezeGateReady']}")
    print("\nR1 trio recovery (canonical_functional -> triangulated KEEP):")
    for row in report["r1TrioRecovery"]:
        print(
            f"  {row['conceptId']:18} R1={row['r1Status']:22} R2={row['r2Status']:22} "
            f"R3={row['candidateDisposition']:22} freeze={row['freezeRecommendation']}"
        )
    print("\nBoundary focus (highest-value R3 questions):")
    for row in report["boundaryFocusSummary"]:
        print(
            f"  {row['conceptId']:22} [{row['triangulationResult']}] "
            f"-> {row['freezeRecommendation']}"
        )
    print(f"\nreport:  {out}")
    print(f"freeze:  {freeze_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
