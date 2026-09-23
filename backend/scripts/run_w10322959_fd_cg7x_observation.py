#!/usr/bin/env python3
"""CG-7 R1 — W10322959 French-door refrigerator observation (no gate, no publish, no canonical/)."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANDIDATES = KNOWLEDGE / "normalization" / "candidates"
PROCEDURE_SEED = KNOWLEDGE / "procedures" / "seed" / "whirlpool_jazz_french_door"
EXTRACTION_DOC = (
    KNOWLEDGE / "pattern-catalog" / "WHIRLPOOL_JAZZ_FD_W10322959_EXTRACTION.md"
)
EXTRACTED_TEXT = (
    ROOT
    / "backend"
    / "docs"
    / "manuals"
    / "techsheet-w10322959-revb whirlpool FD fridge 2013-extracted.txt"
)
CANDIDATE_GRAPH = CALIBRATION / "french_door_refrigerator_cg7x_candidate_v1.json"

TARGET_MANUAL = "W10322959"
PLATFORM_ID = "whirlpool_jazz_french_door"

VERDICTS = frozenset(
    {
        "canonical_functional",
        "platform_implementation",
        "deferred",
        "needs_second_manual",
    }
)

SERVICE_TESTS: dict[int, dict[str, Any]] = {
    1: {
        "procedureId": "w10322959-test-01-defrost",
        "title": "Defrost thermostat & heater",
        "seedComponents": ["defrost_heater", "defrost_thermostat"],
    },
    2: {
        "procedureId": "w10322959-test-02-compressor",
        "title": "Compressor & condenser fan",
        "seedComponents": ["compressor", "condenser_fan"],
    },
    3: {
        "procedureId": "w10322959-test-03-evap-fan",
        "title": "Evaporator / freezer fan",
        "seedComponents": ["evap_fan"],
    },
    4: {
        "procedureId": "w10322959-test-04-ff-thermistor",
        "title": "Fresh food thermistor",
        "seedComponents": ["thermistor"],
    },
    5: {
        "procedureId": "w10322959-test-05-fz-thermistor",
        "title": "Freezer thermistor",
        "seedComponents": ["thermistor"],
    },
    6: {
        "procedureId": "w10322959-test-06-damper",
        "title": "Fresh food damper",
        "seedComponents": ["damper_motor"],
    },
    7: {
        "procedureId": "w10322959-test-07-ff-performance",
        "title": "FF performance offset",
        "seedComponents": ["control_board"],
    },
    8: {
        "procedureId": "w10322959-test-08-fz-performance",
        "title": "FZ performance offset",
        "seedComponents": ["control_board"],
    },
    9: {
        "procedureId": "w10322959-test-09-defrost-interval",
        "title": "Defrost interval adaptive/fixed",
        "seedComponents": ["control_board"],
    },
}

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
    for path in sorted(PROCEDURE_SEED.glob("w10322959*.json")):
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


def _collect_mapping_evidence(mappings: list[dict[str, Any]]) -> dict[str, Any]:
    by_term: dict[str, list[dict[str, Any]]] = defaultdict(list)
    unresolved = 0
    false_washer_hits = 0
    for row in mappings:
        term = str(row.get("sourceTerm") or "")
        by_term[term].append(row)
        if row.get("status") == "UNRESOLVED_TERM":
            unresolved += 1
        if row.get("canonicalId") == "wash_ntc":
            false_washer_hits += 1
    return {
        "totalMappings": len(mappings),
        "unresolvedMappings": unresolved,
        "uniqueSourceTerms": len(by_term),
        "falseWasherTemplateHits": false_washer_hits,
        "byTerm": dict(by_term),
    }


def _build_concept_evidence(
    *,
    manual_text: str,
    procedure_index: dict[str, dict[str, Any]],
    mapping_evidence: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    text = _normalize(manual_text)
    seed_usage: Counter[str] = Counter()
    procedure_hits: dict[str, list[str]] = defaultdict(list)
    for proc_id, proc in procedure_index.items():
        for seed_id in proc.get("componentIds") or []:
            seed_usage[str(seed_id)] += 1
            procedure_hits[str(seed_id)].append(proc_id)

    def service_tests_for(*keywords: str) -> list[int]:
        hits = []
        for num, spec in SERVICE_TESTS.items():
            blob = _normalize(spec["title"] + " " + " ".join(spec["seedComponents"]))
            if any(k in blob for k in keywords):
                hits.append(num)
        return hits

    evidence: dict[str, dict[str, Any]] = {}

    def add(
        concept_id: str,
        *,
        verdict: str,
        rationale: str,
        service_tests: list[int] | None = None,
        procedure_ids: list[str] | None = None,
        seed_components: list[str] | None = None,
        manual_phrases: list[str] | None = None,
        measurement_knowledge: list[str] | None = None,
    ) -> None:
        if verdict not in VERDICTS:
            raise ValueError(f"invalid verdict {verdict}")
        evidence[concept_id] = {
            "conceptId": concept_id,
            "verdict": verdict,
            "rationale": rationale,
            "serviceTests": service_tests or [],
            "procedureIds": procedure_ids or [],
            "seedComponentIds": seed_components or [],
            "manualPhrases": manual_phrases or [],
            "measurementKnowledgeIds": measurement_knowledge or [],
        }

    add(
        "power_supply",
        verdict="needs_second_manual",
        rationale=(
            "Manual documents line voltage, wattage, and run-time tables but provides no "
            "dedicated service test. Functional supply role implied — canonical vs overlay TBD."
        ),
        manual_phrases=_text_hits(text, ("115 vac", "120 vac", "disconnect power")),
    )
    add(
        "control_board",
        verdict="canonical_functional",
        rationale=(
            "Jazz control board orchestrates programming mode, adaptive defrost, forced defrost, "
            "and all service tests (P-E, F-d, S-E). Independent functional control domain on R1 evidence."
        ),
        service_tests=[7, 8, 9],
        procedure_ids=[
            "w10322959-programming-mode",
            "w10322959-test-07-ff-performance",
            "w10322959-test-08-fz-performance",
            "w10322959-test-09-defrost-interval",
        ],
        seed_components=["control_board"],
        manual_phrases=_text_hits(
            text,
            ("control board", "programming mode", "adaptive defrost", "software version"),
        ),
    )
    add(
        "user_interface",
        verdict="canonical_functional",
        rationale=(
            "All service-mode entry (S-E, F-d, P-E) and test activation use refrigerator display "
            "and keypad. Distinct functional HMI surface from control orchestration on R1 evidence."
        ),
        procedure_ids=["w10322959-programming-mode"],
        manual_phrases=_text_hits(
            text,
            ("refrigerator temperature", "freezer temperature", "keypad", "display"),
        ),
    )
    add(
        "temperature_sensor",
        verdict="needs_second_manual",
        rationale=(
            "Service tests 4 and 5 provide independent FF and FZ thermistor circuit tests. "
            "Compartment split vs single canonical temperature_sensor requires R2/R3 boundary test."
        ),
        service_tests=[4, 5],
        procedure_ids=[
            "w10322959-test-04-ff-thermistor",
            "w10322959-test-05-fz-thermistor",
        ],
        seed_components=["thermistor"],
        manual_phrases=_text_hits(text, ("thermistor", "fresh food thermistor", "freezer thermistor")),
        measurement_knowledge=["whirlpoolJazzFdThermistorOhms"],
    )
    add(
        "compressor",
        verdict="needs_second_manual",
        rationale=(
            "Service test 2 operates compressor/condenser fan circuit; EM2Y60 run/start specs on sheet. "
            "Strong refrigeration actuator evidence — single-manual cannot freeze canonical vs platform."
        ),
        service_tests=[2],
        procedure_ids=["w10322959-test-02-compressor"],
        seed_components=["compressor"],
        manual_phrases=_text_hits(text, ("compressor", "em2y60", "compressor run")),
        measurement_knowledge=["whirlpoolJazzFdCompressorRunOhms", "whirlpoolJazzFdCompressorStartOhms"],
    )
    add(
        "compressor_controller",
        verdict="platform_implementation",
        rationale=(
            "Jazz sheet tests compressor drive via control-board relay circuit (test 2 toggle). "
            "No separate inverter/VFD domain on this manual — likely platform implementation of control_board."
        ),
        service_tests=[2],
        procedure_ids=["w10322959-test-02-compressor"],
        manual_phrases=_text_hits(text, ("compressor drive circuit", "relay", "start winding")),
    )
    add(
        "condenser",
        verdict="deferred",
        rationale=(
            "Condenser coil appears in performance/no-load tables only. No independent component "
            "test or procedure seed on W10322959 — physical node not earned at R1."
        ),
        manual_phrases=_text_hits(text, ("condenser",)),
    )
    add(
        "evaporator",
        verdict="deferred",
        rationale=(
            "Evaporator inlet/outlet temperature specs on performance table only. No evaporator "
            "coil component test — physical node deferred pending sealed-system evidence in R2/R3."
        ),
        manual_phrases=_text_hits(text, ("evaporator inlet", "evaporator outlet", "evaporator")),
    )
    add(
        "condenser_fan",
        verdict="needs_second_manual",
        rationale=(
            "Service test 2 jointly exercises compressor and condenser fan circuit. Independent "
            "airflow actuator evidence — bundled test leaves canonical boundary for R2/R3."
        ),
        service_tests=[2],
        procedure_ids=["w10322959-test-02-compressor"],
        seed_components=["condenser_fan"],
        manual_phrases=_text_hits(text, ("condenser fan",)),
    )
    add(
        "evaporator_fan",
        verdict="needs_second_manual",
        rationale=(
            "Service test 3 dedicated to evaporator/freezer fan with independent toggle. "
            "Strong functional actuator candidate — triangulation required before freeze."
        ),
        service_tests=[3],
        procedure_ids=["w10322959-test-03-evap-fan"],
        seed_components=["evap_fan"],
        manual_phrases=_text_hits(text, ("freezer fan", "evaporator", "fan drive circuit")),
    )
    add(
        "air_damper",
        verdict="needs_second_manual",
        rationale=(
            "Service test 6 exercises fresh-food damper open/close. Seed id damper_motor is "
            "platform implementation; functional damper/air-tower role needs Samsung/LG compare."
        ),
        service_tests=[6],
        procedure_ids=["w10322959-test-06-damper"],
        seed_components=["damper_motor"],
        manual_phrases=_text_hits(text, ("damper", "open damper", "air tower")),
    )
    add(
        "airflow_path",
        verdict="needs_second_manual",
        rationale=(
            "Manual separates evaporator fan and fresh-food damper tests but does not name an "
            "airflow_path aggregate. Functional distribution hypothesis only — scrutinize vs fan+damper nodes."
        ),
        service_tests=[3, 6],
        manual_phrases=_text_hits(text, ("damper", "fan", "air")),
    )
    add(
        "defrost_system",
        verdict="needs_second_manual",
        rationale=(
            "Adaptive defrost orchestration documented on control board; tests 1 and 9 cover "
            "heater/thermostat and interval. Functional defrost domain vs component trio needs R2/R3."
        ),
        service_tests=[1, 9],
        procedure_ids=["w10322959-test-01-defrost", "w10322959-test-09-defrost-interval"],
        manual_phrases=_text_hits(
            text,
            ("defrost interval", "adaptive defrost", "forced defrost", "defrost cycle"),
        ),
    )
    add(
        "defrost_heater",
        verdict="needs_second_manual",
        rationale=(
            "Service test 1 energizes defrost heater with Ω specs by cu ft. Distinct actuator "
            "from defrost_sensor on R1 — canonical split plausible but not frozen on one manual."
        ),
        service_tests=[1],
        procedure_ids=["w10322959-test-01-defrost"],
        seed_components=["defrost_heater"],
        manual_phrases=_text_hits(text, ("defrost heater",)),
        measurement_knowledge=["whirlpoolJazzFdDefrostHeaterOhms"],
    )
    add(
        "defrost_sensor",
        verdict="platform_implementation",
        rationale=(
            "Manual uses defrost thermostat/bimetal terminology with open/short states in test 1. "
            "Termination sensor role is functional but Jazz naming and bimetal specs are platform-specific."
        ),
        service_tests=[1],
        procedure_ids=["w10322959-test-01-defrost"],
        seed_components=["defrost_thermostat"],
        manual_phrases=_text_hits(text, ("defrost thermostat", "bimetal")),
        measurement_knowledge=["whirlpoolJazzFdDefrostBimetalOhms"],
    )
    add(
        "cooling_system",
        verdict="needs_second_manual",
        rationale=(
            "Complaint routing references sealed-system path; service tests decompose into "
            "compressor, fans, and damper. Cooling aggregate may be orchestration-only — R2/R3 required."
        ),
        service_tests=[2, 3, 6],
        manual_phrases=_text_hits(text, ("compressor", "sealed", "cooling")),
    )
    add(
        "door_switch",
        verdict="canonical_functional",
        rationale=(
            "Refrigerator door light switch is required to enter S-E, F-d, and P-E modes on every "
            "diagnostic path. Independent authorization functional role on R1 evidence."
        ),
        manual_phrases=_text_hits(
            text,
            ("door light switch", "refrigerator door light switch", "fresh food door light"),
        ),
    )
    add(
        "door_heater",
        verdict="deferred",
        rationale="No door heater, anti-sweat, or mullion heater reference on W10322959 tech sheet.",
    )
    add(
        "water_inlet_valve",
        verdict="platform_implementation",
        rationale=(
            "Dual-coil valve wattages (brown/yellow) on schematic page but no service test or "
            "procedure seed. Hardware reference only — platform implementation, not functional domain."
        ),
        manual_phrases=_text_hits(text, ("brown coil", "yellow coil", "valve")),
    )
    add(
        "water_dispenser",
        verdict="deferred",
        rationale="Extraction doc notes in-door dispenser specifics absent; no dispenser test on Jazz sheet.",
    )
    add(
        "water_level_sensor",
        verdict="deferred",
        rationale="No reservoir or fill-level sensor evidence on W10322959.",
    )
    add(
        "ice_maker",
        verdict="deferred",
        rationale=(
            "Extraction doc explicitly gaps ice maker diagnostics — modular IM uses separate 2225623 doc. "
            "Not in W10322959 scope."
        ),
    )
    add(
        "humidity_control",
        verdict="deferred",
        rationale="No humidity, crispers, or moisture-control diagnostics on W10322959.",
    )
    add(
        "sealed_system",
        verdict="deferred",
        rationale=(
            "Complaint routing mentions sealed system path but manual provides no sealed-system "
            "component test — aggregate deferred until multi-manufacturer refrigeration evidence."
        ),
        manual_phrases=_text_hits(text, ("suction", "head pressure", "refrigerant")),
    )

    missing = set(CONCEPT_IDS) - set(evidence)
    if missing:
        raise RuntimeError(f"missing concept evaluations: {sorted(missing)}")
    return evidence


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    candidate_graph = _load_json(CANDIDATE_GRAPH)
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
        mapping_evidence=mapping_evidence,
    )

    verdict_histogram = Counter(v["verdict"] for v in concept_evaluations.values())
    service_test_coverage = {
        str(n): {
            "procedureId": spec["procedureId"],
            "seedComponents": spec["seedComponents"],
            "conceptHits": [
                cid
                for cid, row in concept_evaluations.items()
                if n in (row.get("serviceTests") or [])
            ],
        }
        for n, spec in SERVICE_TESTS.items()
    }

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg7_fd_refrigerator_r1_observation",
        "experiment": (
            "CG-7 R1 — first Whirlpool French-door manual (W10322959 Jazz) vs unfrozen "
            "french_door_refrigerator candidate graph. No cross-manual inference."
        ),
        "workstream": "CG-7",
        "stage": "R1_observation",
        "manualId": TARGET_MANUAL,
        "platformId": PLATFORM_ID,
        "ontologyId": "french_door_refrigerator",
        "ontologyFrozen": False,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "fresh_cg3_observation",
        "publishBlocked": True,
        "gateBlocked": True,
        "canonicalPromotionBlocked": True,
        "canonicalDirectoryMutable": False,
        "crossManualInference": False,
        "graphArtifacts": {
            "cg7xCandidate": str(CANDIDATE_GRAPH.relative_to(ROOT)),
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
            "falseWasherTemplateHits": mapping_evidence["falseWasherTemplateHits"],
            "note": (
                "thermistor → wash_ntc is washer-template leakage on refrigerator manual. "
                "Routing hygiene correction is infrastructure — not R1 semantic learning."
            ),
            "classification": "infrastructure_not_canonical_discovery",
        },
        "serviceTestIndex": SERVICE_TESTS,
        "serviceTestCoverage": service_test_coverage,
        "conceptEvaluations": concept_evaluations,
        "verdictHistogram": dict(verdict_histogram),
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
                "R1 Whirlpool Jazz manual supports functional decomposition via service tests 1–9 "
                "but cannot freeze french_door_refrigerator rev1. Run R2 Samsung French-door "
                "(RF23BB/RFC bespoke) then R3 LG (LRMVS) before human freeze gate."
            ),
            "nextManual": "SAMSUNG-RF23BB",
            "nextStage": "R2_boundary_test",
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
            "r1Constraints": [
                "W10322959 only",
                "no gate",
                "no publish",
                "no canonical/ mutation",
                "no cross-manual inference",
            ],
        },
    }


def main() -> int:
    print("==> CG-7 R1 French-door refrigerator observation (W10322959)")
    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)
    out = CALIBRATION / "W10322959_fd_cg7x_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    hist = report["verdictHistogram"]
    print("\n=== W10322959 FD CG-7 R1 Observation ===")
    print(f"procedures:        {report['pipelineCounts'].get('procedures')}")
    print(f"mappings:          {report['mappingSummary']['total']}")
    print(f"unresolved:        {report['mappingSummary']['unresolved']}")
    print(f"false washer hits: {report['matcherHygiene']['falseWasherTemplateHits']}")
    print(f"verdicts:          {hist}")
    print(f"freeze now?        {report['recommendation']['freezeCandidateNow']}")
    print(f"next:              {report['recommendation']['nextStage']} ({report['recommendation']['nextManual']})")
    print(f"report:            {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
