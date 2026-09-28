#!/usr/bin/env python3
"""CG-10 R3 — W11174426 LCX/LCC platform architecture falsification probe."""

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
    KNOWLEDGE / "pattern-catalog" / "WHIRLPOOL_W11174426_FREESTANDING_RANGE_EXTRACTION.md"
)
EXTRACTED_TEXT = (
    ROOT
    / "backend"
    / "docs"
    / "manuals"
    / "technical-manual-w11174426-revb whirlpool maytag amana ranges-extracted.txt"
)
CANDIDATE_GRAPH = CALIBRATION / "electric_range_oven_cg10x_candidate_v1.json"
R1_REPORT = CALIBRATION / "W11746350_er_cg10x_observation_v1.json"
R2_REPORT = CALIBRATION / "LG_LRE_RANGE_er_cg10x_observation_v1.json"

TARGET_MANUAL = "W11174426"
PLATFORM_ID = "whirlpool_freestanding_range"
R1_MANUAL = "W11746350"
R1_PLATFORM_LABEL = "Copernicus_ACU_relay_surface"
R3_PLATFORM_LABEL = "LCX_LCC_infinite_switch_surface"
FUEL_FILTER = "electric_range"

ELECTRIC_PROCEDURE_IDS = frozenset(
    {
        "w11174426-acu-power",
        "w11174426-hmi",
        "w11174426-oven-sensor",
        "w11174426-door-latch",
        "w11174426-bake-element",
        "w11174426-broil-element",
        "w11174426-infinite-switch",
    }
)

COMPONENT_TESTS: dict[str, dict[str, Any]] = {
    "acu_power": {
        "procedureId": "w11174426-acu-power",
        "title": "Control supply / terminal block",
        "seedComponents": ["control_board"],
    },
    "hmi": {
        "procedureId": "w11174426-hmi",
        "title": "Keypad harness",
        "seedComponents": ["display_panel"],
    },
    "oven_sensor": {
        "procedureId": "w11174426-oven-sensor",
        "title": "Oven RTD",
        "seedComponents": ["thermistor"],
    },
    "bake": {
        "procedureId": "w11174426-bake-element",
        "title": "Bake element",
        "seedComponents": ["heater"],
    },
    "broil": {
        "procedureId": "w11174426-broil-element",
        "title": "Broil element",
        "seedComponents": ["heater"],
    },
    "infinite_switch": {
        "procedureId": "w11174426-infinite-switch",
        "title": "Cooktop infinite switches",
        "seedComponents": ["bake_element"],
    },
    "door_latch": {
        "procedureId": "w11174426-door-latch",
        "title": "Door latch motor",
        "seedComponents": ["door_latch"],
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


def _manual_text() -> str:
    if EXTRACTED_TEXT.is_file():
        return EXTRACTED_TEXT.read_text(encoding="utf-8", errors="replace")
    return ""


def _text_hits(text: str, phrases: tuple[str, ...]) -> list[str]:
    norm = _normalize(text)
    return [p for p in phrases if _normalize(p) in norm]


def _r3_block(
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


def _build_r3_concept_evidence(text: str) -> dict[str, dict[str, Any]]:
    evidence: dict[str, dict[str, Any]] = {}

    def add(concept_id: str, **kwargs: Any) -> None:
        evidence[concept_id] = {"conceptId": concept_id, **kwargs}

    add(
        "power_supply",
        **_r3_block(
            verdict="canonical_functional",
            rationale="240 VAC prerequisite and terminal-block checks on LCX/LCC — same functional power role as R1/R2.",
            tests=["acu_power"],
            procedure_ids=["w11174426-acu-power"],
            manual_phrases=_text_hits(text, ("240 vac", "terminal block", "f9e0")),
        ),
    )
    add(
        "control_board",
        **_r3_block(
            verdict="canonical_functional",
            rationale=(
                "LCX/LCC control board orchestrates oven relay tests and diagnostics entry "
                "(CANCEL×2+START). Independent of surface switch implementation."
            ),
            tests=["acu_power"],
            procedure_ids=["w11174426-acu-power"],
            seed_components=["control_board"],
        ),
    )
    add(
        "user_interface",
        **_r3_block(
            verdict="canonical_functional",
            rationale="Keypad P11 harness; F2E1 shorted keypad — UI functional role unchanged across Whirlpool platforms.",
            tests=["hmi"],
            procedure_ids=["w11174426-hmi"],
            seed_components=["display_panel"],
        ),
    )
    add(
        "temperature_sensor",
        **_r3_block(
            verdict="canonical_functional",
            rationale=(
                "RTD 1000–1200 Ω Con3/P3 with F3E0/F6E1 — third independent manual family "
                "confirms oven cavity temperature feedback as functional role."
            ),
            tests=["oven_sensor"],
            procedure_ids=["w11174426-oven-sensor"],
            seed_components=["thermistor"],
        ),
    )
    add(
        "oven_heating_system",
        **_r3_block(
            verdict="reject_monolithic_aggregate",
            rationale=(
                "LCX chart lists separate bake and broil element Ω rows — same decomposition "
                "posture as R1 Copernicus and R2 LG. Monolithic aggregate not supported."
            ),
            tests=["bake", "broil"],
            procedure_ids=["w11174426-bake-element", "w11174426-broil-element"],
        ),
    )
    add(
        "bake_heating_element",
        **_r3_block(
            verdict="instance_functional_role",
            rationale="Dedicated bake element procedure 10–40 Ω — invariant across all three probes.",
            tests=["bake"],
            procedure_ids=["w11174426-bake-element"],
            seed_components=["heater"],
        ),
    )
    add(
        "broil_heating_element",
        **_r3_block(
            verdict="instance_functional_role",
            rationale="Dedicated broil element procedure separate from bake on LCX.",
            tests=["broil"],
            procedure_ids=["w11174426-broil-element"],
            seed_components=["heater"],
        ),
    )
    add(
        "convection_heating_element",
        **_r3_block(
            verdict="deferred",
            rationale=(
                "No convection element procedure on LCX electric chart — convection fan mentioned "
                "in operation notes only. Electric convection element evidenced on R2 LG only."
            ),
            manual_phrases=_text_hits(text, ("convection fan", "convection bake")),
        ),
    )
    add(
        "surface_heating_system",
        **_r3_block(
            verdict="canonical_functional",
            rationale=(
                "Cooktop heat generation is a testable functional domain via infinite-switch "
                "procedure — but switching mechanism is implementation detail (see surface_control)."
            ),
            tests=["infinite_switch"],
            procedure_ids=["w11174426-infinite-switch"],
            manual_phrases=_text_hits(text, ("infinite switch", "cooktop on")),
        ),
    )
    add(
        "surface_heating_element",
        **_r3_block(
            verdict="platform_implementation",
            rationale=(
                "LCX tests infinite switches in aggregate — not per-zone element procedures like LG. "
                "Physical elements are platform instances; zone granularity is model/overlay scope."
            ),
            tests=["infinite_switch"],
            procedure_ids=["w11174426-infinite-switch"],
        ),
    )
    add(
        "surface_control",
        **_r3_block(
            verdict="platform_implementation",
            rationale=(
                "Infinite switch is LCX surface control implementation — NOT a candidate for "
                "canonical promotion. Functional invariant is control_board → surface_heating_system "
                "(heat generation command path), analogous to compressor_controller on refrigerators."
            ),
            tests=["infinite_switch"],
            procedure_ids=["w11174426-infinite-switch"],
            manual_phrases=_text_hits(text, ("infinite switch", "replace the infinite switch")),
        ),
    )
    add(
        "oven_cavity",
        **_r3_block(
            verdict="deferred",
            rationale="Cavity referenced in convection fan door-interlock notes — no standalone cavity test.",
            manual_phrases=_text_hits(text, ("oven door is opened", "oven cavity")),
        ),
    )
    add(
        "convection_fan",
        **_r3_block(
            verdict="needs_procedure_evidence",
            rationale=(
                "Manual documents convection fan door-interlock behavior but no dedicated fan "
                "procedure on LCX seeds (unlike R1 vent-fan and R2 convection-motor procs)."
            ),
            manual_phrases=_text_hits(text, ("convection fan will shut off", "convection fan turns on")),
        ),
    )
    add(
        "oven_door_switch",
        **_r3_block(
            verdict="platform_implementation",
            rationale=(
                "Door switch logic embedded in latch procedure on LCX (F5E1) — not standalone "
                "door-switch proc like R2 LG. Functional door authorization evidenced; test style varies."
            ),
            tests=["door_latch"],
            procedure_ids=["w11174426-door-latch"],
        ),
    )
    add(
        "door_latch_motor",
        **_r3_block(
            verdict="platform_implementation",
            rationale="Latch motor 500–3000 Ω — self-clean actuator implementation on LCX.",
            tests=["door_latch"],
            procedure_ids=["w11174426-door-latch"],
            seed_components=["door_latch"],
        ),
    )
    add(
        "thermal_protection",
        **_r3_block(
            verdict="implementation_specific",
            rationale=(
                "F6E1 over-temp routes to oven sensor procedure — no dedicated thermal-fuse proc "
                "on LCX (R1 Copernicus has thermal-fuse seed). Protection may be fuse hardware on "
                "some platforms, sensor-limited path on others — platform/conditional not canonical."
            ),
            procedure_ids=["w11174426-oven-sensor"],
            manual_phrases=_text_hits(text, ("f6e1", "over-temp", "over temp")),
        ),
    )
    add(
        "cooling_fan",
        **_r3_block(
            verdict="deferred",
            rationale=(
                "No electronics cooling fan procedure on LCX. R1 combined vent/convection fan; "
                "no functional distinction preserved in LCX procedure seeds."
            ),
        ),
    )
    add(
        "oven_lamp",
        **_r3_block(
            verdict="deferred",
            rationale="No oven lamp procedure on W11174426 electric seeds.",
        ),
    )
    add(
        "warming_drawer",
        **_r3_block(
            verdict="deferred",
            rationale="Warming drawer not in W11174426 procedure catalog.",
        ),
    )

    missing = set(CONCEPT_IDS) - set(evidence)
    if missing:
        raise RuntimeError(f"missing R3 evaluations: {sorted(missing)}")
    return evidence


def _platform_probe_answers(
    r1_evals: dict[str, dict[str, Any]],
    r2_evals: dict[str, dict[str, Any]],
    r3_evals: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    return [
        {
            "probeId": "surface_control",
            "question": "Does surface_control remain functional when implementation changes to infinite switches?",
            "finding": (
                "No — infinite_switch is platform implementation on LCX; Copernicus uses ACU relay "
                "mediation (R1 bridge-element). Invariant functional relationship: "
                "control_board → surface_heating_system (surface heat generation command). "
                "Switching mechanism stays platform knowledge — do NOT promote infinite_switch to canonical."
            ),
            "infiniteSwitchCanonicalGuard": True,
            "canonicalPromotion": "rejected",
            "functionalInvariant": "control_board commands surface_heating_system",
            "r1Posture": r1_evals.get("surface_control", {}).get("verdict"),
            "r2Posture": r2_evals.get("surface_control", {}).get("verdict"),
            "r3Posture": r3_evals["surface_control"]["verdict"],
        },
        {
            "probeId": "surface_heating_zones",
            "question": "Are individual surface zones still independently testable functions?",
            "finding": (
                "Conditionally — LG R2 decomposes LF/LR/RR/RF/CR zones with separate procedures. "
                "LCX R3 tests infinite switches in aggregate (one procedure). Copernicus R1 tests "
                "bridge/single elements via ACU relay. Zone independence is instance/overlay scope "
                "when OEM provides per-zone tests — not a required canonical split."
            ),
            "zoneGranularity": "instance_overlay_when_evidenced",
            "r1Posture": r1_evals.get("surface_heating_system", {}).get("verdict"),
            "r2Posture": r2_evals.get("surface_heating_system", {}).get("verdict"),
            "r3Posture": r3_evals["surface_heating_system"]["verdict"],
        },
        {
            "probeId": "thermal_protection",
            "question": "Does dedicated thermal-fuse procedure presence make thermal_protection implementation-specific?",
            "finding": (
                "Yes — R1 Copernicus has w11746350-thermal-fuse procedure; R2 LG and R3 LCX route "
                "over-temp via oven sensor (F6E1/F-6) without dedicated fuse proc. thermal_protection "
                "is better modeled as conditional/platform vocabulary (fuse vs sensor-limited path) "
                "than canonical component — analogous to refrigerator conditional concepts."
            ),
            "canonicalPromotion": "conditional_or_platform_only",
            "r1Posture": r1_evals.get("thermal_protection", {}).get("verdict"),
            "r2Posture": r2_evals.get("thermal_protection", {}).get("verdict"),
            "r3Posture": r3_evals["thermal_protection"]["verdict"],
        },
        {
            "probeId": "cooling_vs_convection",
            "question": "Does evidence preserve electronics cooling vs oven convection as distinct functions?",
            "finding": (
                "No clear canonical split — R1 combines vent/convection in one procedure; R2 separates "
                "convection motor from element; R3 documents convection fan behavior without fan "
                "procedure. convection_fan may earn canonical/conditional role when procedure evidence "
                "exists; cooling_fan remains deferred (no tri-manual procedure support)."
            ),
            "convectionFanDisposition": "conditional_when_procedure_evidence",
            "coolingFanDisposition": "deferred",
            "r1Posture": r1_evals.get("convection_fan", {}).get("verdict"),
            "r2Posture": r2_evals.get("convection_fan", {}).get("verdict"),
            "r3Posture": r3_evals["convection_fan"]["verdict"],
        },
    ]


def _triangulation_synthesis(
    r1_evals: dict[str, dict[str, Any]],
    r2_evals: dict[str, dict[str, Any]],
    r3_evals: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    stable_canonical = []
    instance_scoped_heat = []
    platform_only = []
    rejected_aggregates = []
    deferred = []

    for concept_id in CONCEPT_IDS:
        r1v = r1_evals[concept_id]["verdict"]
        r2v = r2_evals[concept_id]["verdict"]
        r3v = r3_evals[concept_id]["verdict"]
        votes = {r1v, r2v, r3v}

        if concept_id in {"bake_heating_element", "broil_heating_element"}:
            if all(v in {"platform_implementation", "instance_functional_role"} for v in (r1v, r2v, r3v)):
                instance_scoped_heat.append(concept_id)
        if concept_id == "oven_heating_system" and "reject_monolithic_aggregate" in votes:
            rejected_aggregates.append(concept_id)
        if concept_id in {"power_supply", "control_board", "user_interface", "temperature_sensor"}:
            if sum(1 for v in (r1v, r2v, r3v) if v == "canonical_functional") >= 2:
                stable_canonical.append(concept_id)
        if concept_id == "surface_control":
            platform_only.append(concept_id)
        if concept_id == "infinite_switch":
            platform_only.append("infinite_switch_impl_vocabulary")
        if all(v == "deferred" for v in (r1v, r2v, r3v)):
            deferred.append(concept_id)

    return {
        "stableCanonicalCandidates": stable_canonical,
        "instanceScopedHeatGeneration": instance_scoped_heat,
        "rejectedMonolithicAggregates": rejected_aggregates,
        "platformImplementationOnly": platform_only,
        "allThreeDeferred": deferred,
        "heatGenerationArchitecture": (
            "Functional domain: oven heat generation with bake/broil/convection as "
            "instance-scoped diagnostic functions — NOT three canonical component types."
        ),
        "surfaceArchitecture": (
            "Functional domain: surface_heating_system with control→heat invariant; "
            "infinite_switch / relay / per-zone elements remain platform."
        ),
    }


def _freeze_outcome_recommendation(synthesis: dict[str, Any]) -> dict[str, Any]:
    """A/B/C outcomes — human gate still required."""
    if not synthesis.get("rejectedMonolithicAggregates") and not synthesis.get("stableCanonicalCandidates"):
        outcome = "C"
        label = "electric_range_not_one_functional_model"
        rationale = "Insufficient cross-probe functional convergence — do not freeze."
    elif synthesis.get("rejectedMonolithicAggregates") and synthesis.get("stableCanonicalCandidates"):
        outcome = "A"
        label = "candidate_survives_with_refinement"
        rationale = (
            "Functional model holds across Whirlpool Copernicus, LG LRE, and Whirlpool LCX. "
            "Refine: reject oven_heating_system aggregate; use instance scopes for bake/broil/"
            "convection; keep surface_control and infinite_switch as platform; thermal_protection "
            "conditional/platform. Human freeze gate must earn every node."
        )
    else:
        outcome = "B"
        label = "candidate_needs_structural_revision"
        rationale = "Mixed probe results — revise candidate skeleton before freeze."

    return {
        "outcome": outcome,
        "label": label,
        "rationale": rationale,
        "allowedOutcomes": {
            "A": "candidate_survives_with_refinement",
            "B": "candidate_needs_structural_revision",
            "C": "electric_range_not_one_canonical_functional_model",
        },
        "automaticFreeze": False,
        "humanFreezeGateRequired": True,
    }


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    r1_report = _load_json(R1_REPORT)
    r2_report = _load_json(R2_REPORT)
    r1_evals = r1_report.get("conceptEvaluations") or {}
    r2_evals = r2_report.get("r2ConceptEvaluations") or {}
    if not r1_evals or not r2_evals:
        raise RuntimeError("R1/R2 reports required for R3 synthesis")

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    manual_text = _manual_text()
    r3_evals = _build_r3_concept_evidence(manual_text)
    probes = _platform_probe_answers(r1_evals, r2_evals, r3_evals)
    synthesis = _triangulation_synthesis(r1_evals, r2_evals, r3_evals)
    freeze_outcome = _freeze_outcome_recommendation(synthesis)

    r3_histogram = Counter(row["verdict"] for row in r3_evals.values())

    platform_deltas = []
    for concept_id in CONCEPT_IDS:
        r1v = r1_evals[concept_id]["verdict"]
        r3v = r3_evals[concept_id]["verdict"]
        if r1v != r3v:
            platform_deltas.append(
                {
                    "conceptId": concept_id,
                    "copernicusR1": r1v,
                    "lcxR3": r3v,
                    "disappearsOnLcx": r1v != "deferred" and r3v == "deferred",
                    "emergesOnLcx": r1v == "deferred" and r3v not in {"deferred"},
                }
            )

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg10_electric_range_r3_platform_probe_observation",
        "experiment": (
            "CG-10 R3 — Whirlpool W11174426 LCX/LCC platform architecture falsification within "
            "same manufacturer. Ask which concepts disappear when surface-control architecture "
            "changes — NOT whether LCX validates Copernicus."
        ),
        "workstream": "CG-10",
        "stage": "R3_platform_architecture_falsification_probe",
        "manualId": TARGET_MANUAL,
        "platformId": PLATFORM_ID,
        "fuelFilter": FUEL_FILTER,
        "ontologyId": "electric_range_oven_candidate",
        "ontologyFrozen": False,
        "freezeEligible": False,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "publishBlocked": True,
        "gateBlocked": True,
        "canonicalPromotionBlocked": True,
        "candidateSkeletonMutable": False,
        "r3DecisionGate": {
            "question": (
                "Which apparent Whirlpool concepts disappear when surface-control architecture "
                "changes (LCX infinite-switch vs Copernicus ACU relay)?"
            ),
            "notAsked": "Does LCX validate Copernicus?",
            "corpusLimitation": (
                "R3 is NOT a third independent manufacturer — document alongside R1/R2. "
                "Samsung electric range manual absent from corpus."
            ),
        },
        "platformContrast": {
            "r1Platform": R1_PLATFORM_LABEL,
            "r3Platform": R3_PLATFORM_LABEL,
            "sameManufacturer": True,
            "surfaceControlDelta": "ACU_relay_mediated vs infinite_switch",
        },
        "r1Reference": {"observationArtifact": R1_REPORT.name, "manualId": R1_MANUAL},
        "r2Reference": {"observationArtifact": R2_REPORT.name, "manualId": "LG-LRE-RANGE"},
        "graphArtifacts": {
            "cg10xCandidate": str(CANDIDATE_GRAPH.relative_to(ROOT)),
            "extractionDoc": str(EXTRACTION_DOC.relative_to(ROOT)),
            "extractedText": str(EXTRACTED_TEXT.relative_to(ROOT)),
        },
        "pipelineCounts": manifest.get("counts") or {},
        "mappingSummary": {"total": len(mappings)},
        "r3ConceptEvaluations": r3_evals,
        "r3VerdictHistogram": dict(r3_histogram),
        "platformProbeAnswers": probes,
        "copernicusToLcxDeltas": platform_deltas,
        "triangulationSynthesis": synthesis,
        "freezeOutcomeRecommendation": freeze_outcome,
        "recommendation": {
            "freezeCandidateNow": False,
            "rationale": freeze_outcome["rationale"],
            "provisionalOutcome": freeze_outcome["outcome"],
            "nextStage": "human_freeze_gate",
            "nextArtifact": "CG10_ELECTRIC_RANGE_FREEZE_RECOMMENDATION_v1.json",
        },
    }


def main() -> int:
    print("==> CG-10 R3 W11174426 LCX platform architecture probe")
    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)
    out = CALIBRATION / "W11174426_er_cg10x_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    fo = report["freezeOutcomeRecommendation"]
    print("\n=== W11174426 ER CG-10 R3 Platform Probe ===")
    print(f"R3 verdicts:           {report['r3VerdictHistogram']}")
    print(f"platform deltas:       {len(report['copernicusToLcxDeltas'])}")
    print(f"provisional outcome:   {fo['outcome']} — {fo['label']}")
    print(f"freeze now?            {report['recommendation']['freezeCandidateNow']}")
    print(f"next:                  {report['recommendation']['nextStage']}")
    print(f"report:                {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
