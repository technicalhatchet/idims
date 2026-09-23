#!/usr/bin/env python3
"""CG-10 R1 — W11746350 electric range observation (no gate, no publish, no canonical/)."""

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
PROCEDURE_SEED = KNOWLEDGE / "procedures" / "seed" / "whirlpool_freestanding_range"
EXTRACTION_DOC = (
    KNOWLEDGE / "pattern-catalog" / "WHIRLPOOL_W11746350_FREESTANDING_RANGE_EXTRACTION.md"
)
EXTRACTED_TEXT = (
    ROOT
    / "backend"
    / "docs"
    / "manuals"
    / "technical-manual-w11746350-revf-extracted.txt"
)
CANDIDATE_GRAPH = CALIBRATION / "electric_range_oven_cg10x_candidate_v1.json"
DISCOVERY_CONTRACT = CALIBRATION / "CG10_ELECTRIC_RANGE_ONTOLOGY_DISCOVERY_CONTRACT_v1.json"

TARGET_MANUAL = "W11746350"
PLATFORM_ID = "whirlpool_freestanding_range"
FUEL_FILTER = "electric_range"

COMPONENT_TESTS: dict[str, dict[str, Any]] = {
    "acu_power": {
        "procedureId": "w11746350-acu-power",
        "title": "ACU power & communication",
        "seedComponents": ["control_board"],
    },
    "hmi": {
        "procedureId": "w11746350-hmi",
        "title": "Touch HMI",
        "seedComponents": ["display_panel"],
    },
    "oven_sensor": {
        "procedureId": "w11746350-oven-sensor",
        "title": "Main oven RTD",
        "seedComponents": ["thermistor"],
    },
    "bake": {
        "procedureId": "w11746350-bake-element",
        "title": "Hidden bake element",
        "seedComponents": ["heater"],
        "fuel": "electric_range",
    },
    "broil": {
        "procedureId": "w11746350-broil-element",
        "title": "Broil element",
        "seedComponents": ["heater"],
        "fuel": "electric_range",
    },
    "vent_fan": {
        "procedureId": "w11746350-vent-fan",
        "title": "Vent / convection fan",
        "seedComponents": ["fan"],
    },
    "door_latch": {
        "procedureId": "w11746350-door-latch",
        "title": "Rear door latch motor",
        "seedComponents": ["door_latch"],
    },
    "bridge_surface": {
        "procedureId": "w11746350-bridge-element",
        "title": "Bridge / surface element",
        "seedComponents": ["heater"],
        "fuel": "electric_range",
    },
    "thermal_fuse": {
        "procedureId": "w11746350-thermal-fuse",
        "title": "Thermal fuse / hi-limit",
        "seedComponents": ["thermal_fuse"],
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
    for path in sorted(PROCEDURE_SEED.glob("w11746350*.json")):
        proc = _load_json(path)
        proc_id = proc.get("id")
        if proc_id:
            index[proc_id] = proc
    return index


def _manual_text() -> str:
    if EXTRACTED_TEXT.is_file():
        return EXTRACTED_TEXT.read_text(encoding="utf-8", errors="replace")
    return ""


def _text_hits(text: str, phrases: tuple[str, ...]) -> list[str]:
    norm = _normalize(text)
    return [p for p in phrases if _normalize(p) in norm]


def _collect_mapping_evidence(mappings: list[dict[str, Any]]) -> dict[str, Any]:
    source_terms: set[str] = set()
    unresolved = 0
    false_refrigerator_hits = 0
    for row in mappings:
        term = str(row.get("sourceTerm") or row.get("oemTerm") or "")
        if term:
            source_terms.add(term)
        if row.get("status") == "unresolved" or not row.get("canonicalTarget"):
            unresolved += 1
        target = str(row.get("canonicalTarget") or row.get("suggestedTarget") or "").lower()
        if "refrigerator" in target or "compressor" in target:
            false_refrigerator_hits += 1
    return {
        "totalMappings": len(mappings),
        "unresolvedMappings": unresolved,
        "uniqueSourceTerms": len(source_terms),
        "falseRefrigeratorTemplateHits": false_refrigerator_hits,
    }


def _build_concept_evidence(
    *,
    manual_text: str,
    procedure_index: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    text = manual_text
    evidence: dict[str, dict[str, Any]] = {}

    def add(
        concept_id: str,
        *,
        verdict: str,
        rationale: str,
        tests: list[str] | None = None,
        procedure_ids: list[str] | None = None,
        seed_components: list[str] | None = None,
        boundary_question: str | None = None,
        manual_phrases: list[str] | None = None,
    ) -> None:
        evidence[concept_id] = {
            "conceptId": concept_id,
            "verdict": verdict,
            "rationale": rationale,
            "componentTests": tests or [],
            "procedureIds": procedure_ids or [],
            "seedComponentIds": seed_components or [],
            "boundaryQuestion": boundary_question,
            "manualPhraseHits": manual_phrases or [],
        }

    add(
        "power_supply",
        verdict="canonical_functional",
        rationale=(
            "120/240 VAC supply checks are prerequisite on every diagnostic path (pre-service + ACU power). "
            "Functional power input distinct from control orchestration on R1."
        ),
        tests=["acu_power"],
        procedure_ids=["w11746350-acu-power"],
        manual_phrases=_text_hits(text, ("120/240 vac", "line voltage", "supply voltage")),
    )
    add(
        "control_board",
        verdict="canonical_functional",
        rationale=(
            "Copernicus ACU orchestrates component activation, relay drive, F1E1/F6E1 comm faults, "
            "and service diagnostics entry. Independent control functional role on R1."
        ),
        tests=["acu_power"],
        procedure_ids=["w11746350-acu-power"],
        seed_components=["control_board"],
        manual_phrases=_text_hits(text, ("acu", "appliance control unit", "relay")),
    )
    add(
        "user_interface",
        verdict="canonical_functional",
        rationale=(
            "Touch HMI with service diagnostics entry (111111111), stuck-key F2E1/F2E2, and P3 12 VDC feed. "
            "User command surface distinct from ACU on R1."
        ),
        tests=["hmi"],
        procedure_ids=["w11746350-hmi"],
        seed_components=["display_panel"],
        manual_phrases=_text_hits(text, ("touch", "hmi", "service diagnostics")),
    )
    add(
        "temperature_sensor",
        verdict="needs_second_manual",
        rationale=(
            "Main oven RTD 1000–1200 Ω with dedicated F3E0 procedure. Functional temperature feedback "
            "evidenced but single-sensor scope — R2 LG must confirm cross-manufacturer abstraction."
        ),
        tests=["oven_sensor"],
        procedure_ids=["w11746350-oven-sensor"],
        seed_components=["thermistor"],
        boundary_question="temperature_feedback_unification",
        manual_phrases=_text_hits(text, ("oven sensor", "rtd", "f3e0")),
    )
    add(
        "oven_heating_system",
        verdict="needs_second_manual",
        rationale=(
            "Manual decomposes oven heat into separate bake (FEE6) and broil (FEE7) element tests with "
            "distinct Ω specs — aggregate may be orchestration-only. R2/R3 must decide bake/broil instance "
            "semantics vs separate canonical nodes."
        ),
        tests=["bake", "broil"],
        procedure_ids=["w11746350-bake-element", "w11746350-broil-element"],
        boundary_question="oven_heating_abstraction",
        manual_phrases=_text_hits(text, ("bake element", "broil element", "hidden bake")),
    )
    add(
        "bake_heating_element",
        verdict="platform_implementation",
        rationale=(
            "Hidden bake 23.3 Ω P4 with FEE6 — strong instance-level procedure evidence. Likely "
            "instance of oven_heating_system rather than independent canonical node pending R2/R3."
        ),
        tests=["bake"],
        procedure_ids=["w11746350-bake-element"],
        seed_components=["heater"],
        boundary_question="oven_element_decomposition",
    )
    add(
        "broil_heating_element",
        verdict="platform_implementation",
        rationale=(
            "Broil 10–40 Ω P80 with FEE7 — separate procedure from bake. Supports instance decomposition "
            "hypothesis; canonical promotion deferred."
        ),
        tests=["broil"],
        procedure_ids=["w11746350-broil-element"],
        seed_components=["heater"],
        boundary_question="oven_element_decomposition",
    )
    add(
        "convection_heating_element",
        verdict="deferred",
        rationale=(
            "W11746350 convect-element procedure is gas_range templateIds only. Electric convection on "
            "this manual is fan-mediated (F7E5/F7E6) — element path not evidenced for electric R1."
        ),
        procedure_ids=["w11746350-convect-element"],
        manual_phrases=_text_hits(text, ("convection", "convect")),
    )
    add(
        "surface_heating_system",
        verdict="needs_second_manual",
        rationale=(
            "Bridge/single/warming surface element Ω procedures exist but cooktop control is ACU-relay "
            "mediated on Copernicus. surface_heating_system vs per-element canonical split needs LG + LCX "
            "infinite-switch contrast (R2/R3)."
        ),
        tests=["bridge_surface"],
        procedure_ids=["w11746350-bridge-element"],
        boundary_question="surface_heating_abstraction",
        manual_phrases=_text_hits(text, ("bridge element", "surface element", "cooktop")),
    )
    add(
        "surface_heating_element",
        verdict="platform_implementation",
        rationale=(
            "Bridge element procedure with distinct Ω — physical element instance. Diagnostic routing "
            "through ACU relays — platform implementation candidate."
        ),
        tests=["bridge_surface"],
        procedure_ids=["w11746350-bridge-element"],
        seed_components=["heater"],
    )
    add(
        "surface_control",
        verdict="deferred",
        rationale=(
            "Copernicus uses ACU relay drive for surface elements — no infinite-switch procedure on "
            "W11746350. LCX manual (R3) required to test surface_control as functional vs platform."
        ),
        boundary_question="surface_architecture_granularity",
    )
    add(
        "oven_cavity",
        verdict="deferred",
        rationale=(
            "Cavity referenced in complaint routing but no standalone cavity test — likely routing "
            "vocabulary only unless R2/R3 show independent diagnostic role."
        ),
        manual_phrases=_text_hits(text, ("cavity", "oven cavity")),
        boundary_question="oven_cavity_aggregate",
    )
    add(
        "convection_fan",
        verdict="needs_second_manual",
        rationale=(
            "Vent/convection fan 85 Ω + 12 VDC P6 with F7E5/F7E6. Functional air circulation evidenced "
            "but relationship to oven heating mode needs cross-manufacturer confirmation."
        ),
        tests=["vent_fan"],
        procedure_ids=["w11746350-vent-fan"],
        seed_components=["fan"],
        boundary_question="convection_canonical_role",
        manual_phrases=_text_hits(text, ("convection fan", "vent fan", "f7e5")),
    )
    add(
        "oven_door_switch",
        verdict="needs_second_manual",
        rationale=(
            "F5E0/F5E1 door/latch switch disagree codes reference switch logic but primary procedure "
            "targets latch motor Ω. door_switch vs latch motor functional split needs R2/R3."
        ),
        tests=["door_latch"],
        procedure_ids=["w11746350-door-latch"],
        boundary_question="door_switch_vs_latch",
        manual_phrases=_text_hits(text, ("door switch", "f5e0", "latch switch")),
    )
    add(
        "door_latch_motor",
        verdict="platform_implementation",
        rationale=(
            "Self-clean latch motor 500–3000 Ω P8 — actuator implementation of door authorization. "
            "Platform layer unless R2/R3 elevate latch to canonical functional node."
        ),
        tests=["door_latch"],
        procedure_ids=["w11746350-door-latch"],
        seed_components=["door_latch"],
    )
    add(
        "thermal_protection",
        verdict="needs_second_manual",
        rationale=(
            "Thermal fuse / hi-limit continuity procedure exists for overheat complaints. Functional "
            "safety role evidenced but fuse vs hi-limit vs cutout naming varies by platform — R2/R3."
        ),
        tests=["thermal_fuse"],
        procedure_ids=["w11746350-thermal-fuse"],
        seed_components=["thermal_fuse"],
        boundary_question="thermal_protection_abstraction",
        manual_phrases=_text_hits(text, ("thermal fuse", "hi-limit", "overheat")),
    )
    add(
        "cooling_fan",
        verdict="needs_second_manual",
        rationale=(
            "Vent fan procedure may serve convection and/or electronics cooling — same motor on R1. "
            "Must determine if cooling_fan and convection_fan are one functional role or two."
        ),
        tests=["vent_fan"],
        procedure_ids=["w11746350-vent-fan"],
        boundary_question="convection_fan_vs_cooling_fan",
    )
    add(
        "oven_lamp",
        verdict="deferred",
        rationale="No oven lamp procedure on W11746350 electric seeds — deferred until multi-manual evidence.",
    )
    add(
        "warming_drawer",
        verdict="deferred",
        rationale="Warming drawer not in W11746350 procedure catalog — deferred.",
    )

    missing = set(CONCEPT_IDS) - set(evidence)
    if missing:
        raise RuntimeError(f"missing concept evaluations: {sorted(missing)}")
    return evidence


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    candidate_graph = _load_json(CANDIDATE_GRAPH)
    contract = _load_json(DISCOVERY_CONTRACT)
    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    overlays = _load_json(target_dir / "overlay_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []
    procedure_index = _load_procedure_index()
    manual_text = _manual_text()
    mapping_evidence = _collect_mapping_evidence(mappings)
    concept_evaluations = _build_concept_evidence(
        manual_text=manual_text,
        procedure_index=procedure_index,
    )

    verdict_histogram = Counter(v["verdict"] for v in concept_evaluations.values())
    test_coverage = {
        key: {
            "procedureId": spec["procedureId"],
            "seedComponents": spec.get("seedComponents") or [],
            "conceptHits": [
                cid
                for cid, row in concept_evaluations.items()
                if key in (row.get("componentTests") or [])
            ],
        }
        for key, spec in COMPONENT_TESTS.items()
    }

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg10_electric_range_r1_observation",
        "experiment": (
            "CG-10 R1 — first Whirlpool electric range manual (W11746350 Copernicus) vs unfrozen "
            "electric_range_oven candidate graph. No cross-manual inference."
        ),
        "workstream": "CG-10",
        "stage": "R1_observation",
        "manualId": TARGET_MANUAL,
        "platformId": PLATFORM_ID,
        "fuelFilter": FUEL_FILTER,
        "ontologyId": "electric_range_oven_candidate",
        "ontologyFrozen": False,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "fresh_cg3_observation",
        "publishBlocked": True,
        "gateBlocked": True,
        "canonicalPromotionBlocked": True,
        "canonicalDirectoryMutable": False,
        "crossManualInference": False,
        "discoveryContract": str(DISCOVERY_CONTRACT.relative_to(ROOT)),
        "graphArtifacts": {
            "cg10xCandidate": str(CANDIDATE_GRAPH.relative_to(ROOT)),
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
            "total": mapping_evidence["totalMappings"],
            "unresolved": mapping_evidence["unresolvedMappings"],
            "uniqueSourceTerms": mapping_evidence["uniqueSourceTerms"],
            "overlayBindings": len(overlays),
        },
        "matcherHygiene": {
            "falseRefrigeratorTemplateHits": mapping_evidence["falseRefrigeratorTemplateHits"],
            "note": (
                "Refrigerator/compressor template leakage on range manual is infrastructure — "
                "not R1 semantic learning."
            ),
            "classification": "infrastructure_not_canonical_discovery",
        },
        "componentTestIndex": COMPONENT_TESTS,
        "componentTestCoverage": test_coverage,
        "conceptEvaluations": concept_evaluations,
        "verdictHistogram": dict(verdict_histogram),
        "boundaryQuestionHits": {
            q["id"]: [
                cid
                for cid, row in concept_evaluations.items()
                if row.get("boundaryQuestion") == q["id"]
            ]
            for q in contract.get("boundaryQuestions") or []
        },
        "candidateGraphCrossCheck": {
            "candidateConceptCount": len(candidate_graph.get("candidateConcepts") or []),
            "evaluatedConceptCount": len(concept_evaluations),
            "componentsInCandidateGraph": len(candidate_graph.get("components") or []),
            "componentsCanonical": 0,
            "note": "Candidate graph has zero canonical components by design.",
        },
        "recommendation": {
            "freezeCandidateNow": False,
            "rationale": (
                "R1 Copernicus manual supports functional decomposition via component tests but cannot "
                "freeze electric range ontology. Bake/broil instance split, surface architecture, and "
                "fan-role ambiguity require R2 LG-LRE electric then R3 W11174426 LCX falsification."
            ),
            "nextManual": "LG-LRE-RANGE",
            "nextStage": "R2_manufacturer_boundary_test",
        },
        "pipelineDiscipline": candidate_graph.get("pipelineDiscipline"),
    }


def main() -> int:
    print("==> CG-10 R1 electric range observation (W11746350)")
    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)
    out = CALIBRATION / "W11746350_er_cg10x_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    hist = report["verdictHistogram"]
    print("\n=== W11746350 ER CG-10 R1 Observation ===")
    print(f"procedures:        {report['pipelineCounts'].get('procedures')}")
    print(f"mappings:          {report['mappingSummary']['total']}")
    print(f"unresolved:        {report['mappingSummary']['unresolved']}")
    print(f"verdicts:          {hist}")
    print(f"freeze now?        {report['recommendation']['freezeCandidateNow']}")
    print(f"next:              {report['recommendation']['nextStage']} ({report['recommendation']['nextManual']})")
    print(f"report:            {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
