#!/usr/bin/env python3
"""CG-10 R2 — LG-LRE-RANGE electric boundary test vs R1 (no candidate/canonical mutation)."""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANDIDATES = KNOWLEDGE / "normalization" / "candidates"
PROCEDURE_SEED = KNOWLEDGE / "procedures" / "seed" / "lg_freestanding_range"
EXTRACTION_DOC = KNOWLEDGE / "pattern-catalog" / "LG_LRE_RANGE_EXTRACTION.md"
EXTRACTED_TEXT = ROOT / "backend" / "docs" / "manuals" / "LG electric freestanding range-extracted.txt"
CANDIDATE_GRAPH = CALIBRATION / "electric_range_oven_cg10x_candidate_v1.json"
R1_REPORT = CALIBRATION / "W11746350_er_cg10x_observation_v1.json"

TARGET_MANUAL = "LG-LRE-RANGE"
PLATFORM_ID = "lg_freestanding_range"
R1_MANUAL = "W11746350"
FUEL_FILTER = "electric_range"

ELECTRIC_PROCEDURE_IDS = frozenset(
    {
        "lg-range-oven-sensor",
        "lg-range-door-switch",
        "lg-range-oven-lamp",
        "lg-range-door-latch",
        "lg-range-bake-element",
        "lg-range-broil-element",
        "lg-range-convection-element",
        "lg-range-convection-motor",
        "lg-range-warming-drawer",
        "lg-range-cooktop-single",
        "lg-range-warming-zone",
        "lg-range-dual-rf-element",
        "lg-range-no-power",
    }
)

COMPONENT_TESTS: dict[str, dict[str, Any]] = {
    "no_power": {
        "procedureId": "lg-range-no-power",
        "title": "No display / no power",
        "seedComponents": ["control_board"],
    },
    "oven_sensor": {
        "procedureId": "lg-range-oven-sensor",
        "title": "Main oven temperature sensor",
        "seedComponents": ["thermistor"],
    },
    "bake": {
        "procedureId": "lg-range-bake-element",
        "title": "Bake element",
        "seedComponents": ["heater"],
    },
    "broil": {
        "procedureId": "lg-range-broil-element",
        "title": "Broil element",
        "seedComponents": ["heater"],
    },
    "convection_element": {
        "procedureId": "lg-range-convection-element",
        "title": "Convection element",
        "seedComponents": ["heater"],
    },
    "convection_motor": {
        "procedureId": "lg-range-convection-motor",
        "title": "Convection fan motor",
        "seedComponents": ["fan"],
    },
    "door_switch": {
        "procedureId": "lg-range-door-switch",
        "title": "Oven door switch",
        "seedComponents": ["door_switch"],
    },
    "door_latch": {
        "procedureId": "lg-range-door-latch",
        "title": "Door latch motor & micro switch",
        "seedComponents": ["door_latch"],
    },
    "cooktop_single": {
        "procedureId": "lg-range-cooktop-single",
        "title": "Single surface elements LF/LR/RR",
        "seedComponents": ["heater"],
    },
    "warming_zone": {
        "procedureId": "lg-range-warming-zone",
        "title": "Center warming zone",
        "seedComponents": ["heater"],
    },
    "dual_rf": {
        "procedureId": "lg-range-dual-rf-element",
        "title": "Dual surface element RF",
        "seedComponents": ["heater"],
    },
    "warming_drawer": {
        "procedureId": "lg-range-warming-drawer",
        "title": "Warming drawer sensor & element",
        "seedComponents": ["heater", "thermistor"],
    },
    "oven_lamp": {
        "procedureId": "lg-range-oven-lamp",
        "title": "Oven lamp",
        "seedComponents": ["lamp"],
    },
}

CONCEPT_IDS = [
    "power_supply",
    "control_board",
    "user_interface",
    "temperature_sensor",
    "oven_heating_system",
    "bake_heating_element",
    "broil_heating_element",
    "convection_heating_element",
    "surface_heating_system",
    "surface_heating_element",
    "surface_control",
    "oven_cavity",
    "convection_fan",
    "oven_door_switch",
    "door_latch_motor",
    "thermal_protection",
    "cooling_fan",
    "oven_lamp",
    "warming_drawer",
]

R2_WATCHPOINTS = frozenset(
    {
        "oven_heating_system",
        "bake_heating_element",
        "broil_heating_element",
        "convection_heating_element",
        "temperature_sensor",
        "convection_fan",
        "surface_heating_system",
        "surface_heating_element",
        "surface_control",
        "oven_door_switch",
        "thermal_protection",
        "cooling_fan",
    }
)


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
    for path in sorted(PROCEDURE_SEED.glob("lg-range*.json")):
        proc = _load_json(path)
        proc_id = proc.get("id")
        if proc_id and proc_id in ELECTRIC_PROCEDURE_IDS:
            index[proc_id] = proc
    return index


def _manual_text() -> str:
    if EXTRACTED_TEXT.is_file():
        return EXTRACTED_TEXT.read_text(encoding="utf-8", errors="replace")
    return ""


def _text_hits(text: str, phrases: tuple[str, ...]) -> list[str]:
    norm = _normalize(text)
    return [p for p in phrases if _normalize(p) in norm]


def _r2_block(
    *,
    verdict: str,
    rationale: str,
    tests: list[str] | None = None,
    procedure_ids: list[str] | None = None,
    seed_components: list[str] | None = None,
    manual_phrases: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "verdict": verdict,
        "rationale": rationale,
        "componentTests": tests or [],
        "procedureIds": procedure_ids or [],
        "seedComponentIds": seed_components or [],
        "manualPhraseHits": manual_phrases or [],
    }


def _build_r2_concept_evidence(text: str) -> dict[str, dict[str, Any]]:
    """LG-only evidence — no Whirlpool vocabulary imported."""
    evidence: dict[str, dict[str, Any]] = {}

    def add(concept_id: str, **kwargs: Any) -> None:
        evidence[concept_id] = {"conceptId": concept_id, **kwargs}

    add(
        "power_supply",
        **_r2_block(
            verdict="canonical_functional",
            rationale=(
                "§6-1 no-power path and line-voltage prerequisite on LRE electric manual. "
                "LG independently treats mains supply as distinct diagnostic entry."
            ),
            tests=["no_power"],
            procedure_ids=["lg-range-no-power"],
            manual_phrases=_text_hits(text, ("no display", "no power", "line voltage")),
        ),
    )
    add(
        "control_board",
        **_r2_block(
            verdict="canonical_functional",
            rationale=(
                "Main PCB + oven relay PCB + cook-top relay PCB orchestration; F-codes route "
                "through control. Independent control functional role on LG R2."
            ),
            tests=["no_power"],
            procedure_ids=["lg-range-no-power"],
            seed_components=["control_board"],
            manual_phrases=_text_hits(text, ("main pcb", "relay pcb", "power control board")),
        ),
    )
    add(
        "user_interface",
        **_r2_block(
            verdict="canonical_functional",
            rationale=(
                "Key membrane / cook-top display PCB; F-1 key short and no-key-input complaints. "
                "User command surface distinct from main PCB on LG R2."
            ),
            procedure_ids=["lg-range-no-power"],
            manual_phrases=_text_hits(text, ("key membrane", "no key input", "f-1")),
        ),
    )
    add(
        "temperature_sensor",
        **_r2_block(
            verdict="canonical_functional",
            rationale=(
                "§4-3 dedicated oven sensor procedure at 1.09 kΩ ±10% with F-1/F-2/F-3/F-4/F-6 "
                "routing — LG independently treats cavity temperature feedback as a testable "
                "functional role (not merely harness vocabulary)."
            ),
            tests=["oven_sensor"],
            procedure_ids=["lg-range-oven-sensor"],
            seed_components=["thermistor"],
            manual_phrases=_text_hits(text, ("oven sensor", "oven temperature sensor", "f-3")),
        ),
    )
    add(
        "oven_heating_system",
        **_r2_block(
            verdict="reject_monolithic_aggregate",
            rationale=(
                "LG §4-4 provides three independent element tests (bake 14 Ω, broil/convection 17 Ω) "
                "with separate failure routing — not a single undifferentiated oven heat test. "
                "Aggregate oven_heating_system appears orchestration-only on LG R2."
            ),
            tests=["bake", "broil", "convection_element"],
            procedure_ids=[
                "lg-range-bake-element",
                "lg-range-broil-element",
                "lg-range-convection-element",
            ],
            manual_phrases=_text_hits(text, ("bake element", "broil element", "convection element")),
        ),
    )
    add(
        "bake_heating_element",
        **_r2_block(
            verdict="instance_functional_role",
            rationale=(
                "Dedicated §4-4 bake procedure (14 Ω ±10%) with F-9 no-heat routing — LG "
                "independently diagnoses bake as distinct testable function."
            ),
            tests=["bake"],
            procedure_ids=["lg-range-bake-element"],
            seed_components=["heater"],
        ),
    )
    add(
        "broil_heating_element",
        **_r2_block(
            verdict="instance_functional_role",
            rationale=(
                "Dedicated §4-4 broil procedure (17 Ω ±10%) separate from bake — LG independently "
                "diagnoses broil as distinct testable function."
            ),
            tests=["broil"],
            procedure_ids=["lg-range-broil-element"],
            seed_components=["heater"],
        ),
    )
    add(
        "convection_heating_element",
        **_r2_block(
            verdict="instance_functional_role",
            rationale=(
                "Dedicated §4-4 convection element procedure (17 Ω) on LRE electric — LG tests "
                "convection heat path separately from bake/broil. Whirlpool R1 lacked electric "
                "convection element procedure."
            ),
            tests=["convection_element"],
            procedure_ids=["lg-range-convection-element"],
            seed_components=["heater"],
            manual_phrases=_text_hits(text, ("convection element", "convection bake")),
        ),
    )
    add(
        "surface_heating_system",
        **_r2_block(
            verdict="needs_r3_architecture_probe",
            rationale=(
                "LG decomposes surface into single (46 Ω), dual RF (32/55 Ω), and warming zone "
                "(565 Ω) procedures — functional surface heating domain evidenced but granularity "
                "vs infinite-switch LCX (R3) still required."
            ),
            tests=["cooktop_single", "dual_rf", "warming_zone"],
            procedure_ids=[
                "lg-range-cooktop-single",
                "lg-range-dual-rf-element",
                "lg-range-warming-zone",
            ],
            manual_phrases=_text_hits(text, ("single surface unit", "dual surface unit", "warming zone")),
        ),
    )
    add(
        "surface_heating_element",
        **_r2_block(
            verdict="platform_implementation",
            rationale=(
                "Per-element Ω procedures (LF/LR/RR/RF/CR) — physical element instances under "
                "surface heating functional domain."
            ),
            tests=["cooktop_single", "dual_rf", "warming_zone"],
            procedure_ids=[
                "lg-range-cooktop-single",
                "lg-range-dual-rf-element",
                "lg-range-warming-zone",
            ],
            seed_components=["heater"],
        ),
    )
    add(
        "surface_control",
        **_r2_block(
            verdict="deferred",
            rationale=(
                "LG electric uses relay PCB paths for surface elements — no infinite-switch procedure. "
                "R3 W11174426 LCX required to test surface_control as functional vs platform."
            ),
            manual_phrases=_text_hits(text, ("cook-top relay", "relay pcb")),
        ),
    )
    add(
        "oven_cavity",
        **_r2_block(
            verdict="deferred",
            rationale="Cavity referenced in safety/complaint text only — no standalone cavity test on LG R2.",
            manual_phrases=_text_hits(text, ("interior surfaces of an oven", "oven cavity")),
        ),
    )
    add(
        "convection_fan",
        **_r2_block(
            verdict="canonical_functional",
            rationale=(
                "§4-1 convection fan motor procedure (33.5 Ω) separate from convection element — "
                "LG independently tests air circulation actuator distinct from heating element."
            ),
            tests=["convection_motor"],
            procedure_ids=["lg-range-convection-motor"],
            seed_components=["fan"],
            manual_phrases=_text_hits(text, ("convection motor", "fan motor", "fan blade")),
        ),
    )
    add(
        "oven_door_switch",
        **_r2_block(
            verdict="canonical_functional",
            rationale=(
                "Dedicated §4-3 door switch procedure separate from latch motor — LG independently "
                "tests door authorization switch as distinct from latch actuator."
            ),
            tests=["door_switch"],
            procedure_ids=["lg-range-door-switch"],
            seed_components=["door_switch"],
            manual_phrases=_text_hits(text, ("door switch",)),
        ),
    )
    add(
        "door_latch_motor",
        **_r2_block(
            verdict="platform_implementation",
            rationale=(
                "§4-2 latch drive + micro switch (27 Ω / 2.6 kΩ) — actuator implementation of "
                "self-clean lock path; distinct from door switch on LG R2."
            ),
            tests=["door_latch"],
            procedure_ids=["lg-range-door-latch"],
            seed_components=["door_latch"],
            manual_phrases=_text_hits(text, ("latch drive", "door locking motor", "f-2")),
        ),
    )
    add(
        "thermal_protection",
        **_r2_block(
            verdict="needs_r3_architecture_probe",
            rationale=(
                "F-6 oven hot / thermal language in manual but no dedicated thermal-fuse procedure "
                "in LG electric seeds (Whirlpool R1 has thermal-fuse proc). R3 + freeze gate required."
            ),
            manual_phrases=_text_hits(text, ("f-6", "overheat", "hot")),
        ),
    )
    add(
        "cooling_fan",
        **_r2_block(
            verdict="needs_r3_architecture_probe",
            rationale=(
                "LG separates convection motor (§4-1) from element; no explicit electronics cooling "
                "fan procedure. Whirlpool R1 combined vent/convection fan — fan-role split unresolved."
            ),
            tests=["convection_motor"],
            procedure_ids=["lg-range-convection-motor"],
        ),
    )
    add(
        "oven_lamp",
        **_r2_block(
            verdict="platform_implementation",
            rationale="§4-5 oven lamp ≤5 Ω procedure — accessory with independent test on LG R2.",
            tests=["oven_lamp"],
            procedure_ids=["lg-range-oven-lamp"],
            seed_components=["lamp"],
        ),
    )
    add(
        "warming_drawer",
        **_r2_block(
            verdict="needs_second_manual",
            rationale=(
                "Optional warming drawer sensor (4.6 kΩ) + element (95 Ω) on LRE30755 — "
                "feature-domain evidence; freeze as conditional optional pending R3."
            ),
            tests=["warming_drawer"],
            procedure_ids=["lg-range-warming-drawer"],
            seed_components=["heater", "thermistor"],
            manual_phrases=_text_hits(text, ("warming drawer",)),
        ),
    )

    missing = set(CONCEPT_IDS) - set(evidence)
    if missing:
        raise RuntimeError(f"missing R2 concept evaluations: {sorted(missing)}")
    return evidence


def _cross_result(
    concept_id: str,
    r1_status: str,
    r2_status: str,
    *,
    invariant_note: str,
) -> str:
    """Classify cross-manufacturer relationship — NOT 'match' semantics."""
    if r2_status == r1_status and r2_status in {"canonical_functional", "deferred"}:
        return "invariant_functional_posture"
    if concept_id in {"bake_heating_element", "broil_heating_element"}:
        if r1_status == "platform_implementation" and r2_status == "instance_functional_role":
            return "invariant_independent_element_decomposition"
    if concept_id == "convection_heating_element":
        if r2_status == "instance_functional_role":
            return "r2_expands_electric_convection_evidence"
    if concept_id == "oven_heating_system":
        if r1_status == "needs_second_manual" and r2_status == "reject_monolithic_aggregate":
            return "invariant_rejects_monolithic_aggregate"
    if concept_id == "temperature_sensor":
        if r1_status == "needs_second_manual" and r2_status == "canonical_functional":
            return "invariant_temperature_feedback_role"
    if concept_id == "convection_fan":
        if r1_status == "needs_second_manual" and r2_status == "canonical_functional":
            return "invariant_convection_fan_role"
    if concept_id == "oven_door_switch":
        if r2_status == "canonical_functional":
            return "r2_expands_door_switch_procedure_evidence"
    if concept_id == "surface_heating_system":
        return "implementation_granularity_divergence"
    if r2_status.startswith("needs_r3") or r1_status == "needs_second_manual":
        return "unresolved_pending_r3"
    if r2_status == "deferred" and r1_status == "deferred":
        return "both_deferred"
    return invariant_note or "requires_r3_synthesis"


def _candidate_disposition(concept_id: str, r1_status: str, r2_status: str) -> str:
    if concept_id == "oven_heating_system" and r2_status == "reject_monolithic_aggregate":
        return "reject_aggregate_use_instance_scopes"
    if r2_status == "instance_functional_role":
        return "promote_instance_scopes_not_separate_canonical_nodes"
    if r2_status == "canonical_functional" and r1_status in {
        "canonical_functional",
        "needs_second_manual",
    }:
        return "keep_canonical_candidate"
    if r2_status == "platform_implementation":
        return "platform_implementation"
    if r2_status == "needs_r3_architecture_probe":
        return "defer_pending_r3"
    if r2_status == "deferred":
        return "defer"
    return r2_status


def _build_boundary_evaluations(
    r1_evaluations: dict[str, dict[str, Any]],
    r2_evaluations: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    boundary: dict[str, dict[str, Any]] = {}
    for concept_id in CONCEPT_IDS:
        r1_row = r1_evaluations[concept_id]
        r2_row = r2_evaluations[concept_id]
        r1_status = r1_row.get("verdict") or r1_row.get("r1Status")
        r2_status = r2_row["verdict"]
        cross = _cross_result(
            concept_id,
            r1_status,
            r2_status,
            invariant_note="review_at_r3",
        )
        disposition = _candidate_disposition(concept_id, r1_status, r2_status)
        boundary[concept_id] = {
            "conceptId": concept_id,
            "r1Status": r1_status,
            "r2Status": r2_status,
            "candidateDisposition": disposition,
            "crossManufacturerResult": cross,
            "invariantFunctionalRelationship": cross.startswith("invariant_"),
            "r2Evidence": r2_row,
            "r1Rationale": r1_row.get("rationale"),
            "watchpoint": concept_id in R2_WATCHPOINTS,
        }
    return boundary


def _invariant_summary(boundary: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for concept_id in R2_WATCHPOINTS:
        row = boundary[concept_id]
        rows.append(
            {
                "conceptId": concept_id,
                "invariantFunctionalRelationship": row["invariantFunctionalRelationship"],
                "crossManufacturerResult": row["crossManufacturerResult"],
                "candidateDisposition": row["candidateDisposition"],
                "r1Status": row["r1Status"],
                "r2Status": row["r2Status"],
            }
        )
    return rows


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    r1_report = _load_json(R1_REPORT)
    r1_evaluations = r1_report.get("conceptEvaluations") or {}
    if not r1_evaluations:
        raise RuntimeError(f"R1 report missing conceptEvaluations: {R1_REPORT}")

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []
    manual_text = _manual_text()
    r2_evaluations = _build_r2_concept_evidence(manual_text)
    boundary = _build_boundary_evaluations(r1_evaluations, r2_evaluations)

    disposition_histogram = Counter(row["candidateDisposition"] for row in boundary.values())
    cross_histogram = Counter(row["crossManufacturerResult"] for row in boundary.values())
    r2_verdict_histogram = Counter(row["verdict"] for row in r2_evaluations.values())

    disposition_deltas = [
        {
            "conceptId": cid,
            "r1Status": row["r1Status"],
            "r2Status": row["r2Status"],
            "candidateDisposition": row["candidateDisposition"],
        }
        for cid, row in boundary.items()
        if row["r1Status"] != row["r2Status"]
    ]

    invariant_count = sum(1 for row in boundary.values() if row["invariantFunctionalRelationship"])

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg10_electric_range_r2_boundary_observation",
        "experiment": (
            "CG-10 R2 — LG LRE electric range manufacturer boundary test. "
            "Ask which functional relationships remain invariant — NOT whether LG matches Whirlpool."
        ),
        "workstream": "CG-10",
        "stage": "R2_manufacturer_boundary_test",
        "manualId": TARGET_MANUAL,
        "platformId": PLATFORM_ID,
        "fuelFilter": FUEL_FILTER,
        "ontologyId": "electric_range_oven_candidate",
        "ontologyFrozen": False,
        "freezeEligible": False,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "fresh_cg3_observation",
        "publishBlocked": True,
        "gateBlocked": True,
        "canonicalPromotionBlocked": True,
        "canonicalDirectoryMutable": False,
        "candidateSkeletonMutable": False,
        "crossManualInference": False,
        "r2DecisionGate": {
            "question": "Which functional relationships remain invariant despite LG implementation?",
            "notAsked": "Does LG match Whirlpool?",
            "corpusNote": (
                "R2 is genuine cross-manufacturer (Whirlpool vs LG). R3 is same-manufacturer "
                "platform architecture probe — not a third independent manufacturer."
            ),
        },
        "r1Reference": {
            "manualId": R1_MANUAL,
            "platformId": r1_report.get("platformId"),
            "observationArtifact": R1_REPORT.name,
            "verdictHistogram": r1_report.get("verdictHistogram"),
        },
        "graphArtifacts": {
            "cg10xCandidate": str(CANDIDATE_GRAPH.relative_to(ROOT)),
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
            "unresolved": sum(1 for m in mappings if not m.get("canonicalTarget")),
        },
        "componentTestIndex": COMPONENT_TESTS,
        "r2ConceptEvaluations": r2_evaluations,
        "r2VerdictHistogram": dict(r2_verdict_histogram),
        "boundaryEvaluations": boundary,
        "r2WatchpointSummary": _invariant_summary(boundary),
        "dispositionDeltas": disposition_deltas,
        "candidateDispositionHistogram": dict(disposition_histogram),
        "crossManufacturerResultHistogram": dict(cross_histogram),
        "invariantRelationshipCount": invariant_count,
        "recommendation": {
            "freezeCandidateNow": False,
            "rationale": (
                "R2 LG independently decomposes bake/broil/convection elements and separates "
                "convection fan from elements — strengthening reject_monolithic_aggregate for "
                "oven_heating_system. Surface architecture and thermal_protection remain unresolved. "
                "Run R3 W11174426 LCX infinite-switch falsification before freeze recommendation."
            ),
            "nextManual": "W11174426",
            "nextStage": "R3_platform_architecture_falsification_probe",
        },
        "pipelineDiscipline": {
            "r2Constraints": [
                "LG-LRE-RANGE electric procedures only",
                "no candidate skeleton mutation",
                "no canonical/ mutation",
                "invariant-relationship framing — not match scoring",
            ],
        },
    }


def main() -> int:
    print("==> CG-10 R2 LG LRE electric range boundary observation")
    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)
    out = CALIBRATION / "LG_LRE_RANGE_er_cg10x_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("\n=== LG LRE RANGE CG-10 R2 Boundary Observation ===")
    print(f"procedures:              {report['pipelineCounts'].get('procedures')}")
    print(f"R2 verdicts:             {report['r2VerdictHistogram']}")
    print(f"invariant relationships: {report['invariantRelationshipCount']}")
    print(f"cross-manufacturer:      {report['crossManufacturerResultHistogram']}")
    print(f"disposition deltas:      {len(report['dispositionDeltas'])}")
    print(f"freeze now?              {report['recommendation']['freezeCandidateNow']}")
    print(f"next:                    {report['recommendation']['nextStage']} ({report['recommendation']['nextManual']})")
    print(f"report:                  {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
