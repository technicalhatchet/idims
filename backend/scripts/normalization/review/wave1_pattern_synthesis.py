from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR
from .candidate_review_decisions import load_decisions
from .wave1_closure_audit import classify_source_term_pattern
from .wave1_existing_canonical_mapping import (
    REVIEW_CLASS,
    WAVE_ID,
    load_review_index,
    select_wave_candidates,
)

SYNTHESIS_FILENAME = "CG_WAVE1_PATTERN_SYNTHESIS_v1.json"
WAVE1_CLOSURE_COMMIT = "a6bf8815"
CONNECTOR_IDENTIFIERS = ("DP2", "MS2", "PR6")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def synthesis_artifact_path() -> Path:
    return CALIBRATION_DIR / SYNTHESIS_FILENAME


def decision_status(decisions_store: dict[str, Any], candidate_id: str) -> str:
    entry = (decisions_store.get("decisions") or {}).get(candidate_id) or {}
    return str(entry.get("reviewStatus") or "unreviewed")


def summarize_record(record: dict[str, Any], decisions_store: dict[str, Any]) -> dict[str, Any]:
    what = record.get("what") or {}
    maps_to = record.get("mapsTo") or {}
    return {
        "candidateId": record.get("candidateId"),
        "manualId": record.get("manualId"),
        "procedureId": what.get("procedureId"),
        "sourceTerm": what.get("sourceTerm"),
        "proposedCanonicalId": maps_to.get("proposedCanonicalId"),
        "reviewClass": record.get("reviewClass"),
        "reviewStatus": decision_status(decisions_store, str(record.get("candidateId") or "")),
    }


def _same_canonical_functional_accepted_sibling(
    record: dict[str, Any],
    pool: list[dict[str, Any]],
    decisions_store: dict[str, Any],
    *,
    exclude_patterns: set[str],
) -> list[dict[str, Any]]:
    manual_id = record.get("manualId")
    canonical = (record.get("mapsTo") or {}).get("proposedCanonicalId")
    matches = []
    for other in pool:
        if other.get("candidateId") == record.get("candidateId"):
            continue
        if other.get("manualId") != manual_id:
            continue
        if (other.get("mapsTo") or {}).get("proposedCanonicalId") != canonical:
            continue
        term = (other.get("what") or {}).get("sourceTerm")
        pattern = classify_source_term_pattern(term)
        if pattern in exclude_patterns:
            continue
        if decision_status(decisions_store, str(other.get("candidateId") or "")) == "accepted":
            matches.append(summarize_record(other, decisions_store))
    return matches


def _same_procedure_functional_accepted_sibling(
    record: dict[str, Any],
    pool: list[dict[str, Any]],
    decisions_store: dict[str, Any],
    *,
    exclude_patterns: set[str],
) -> list[dict[str, Any]]:
    manual_id = record.get("manualId")
    procedure_id = (record.get("what") or {}).get("procedureId")
    matches = []
    for other in pool:
        if other.get("candidateId") == record.get("candidateId"):
            continue
        if other.get("manualId") != manual_id:
            continue
        if (other.get("what") or {}).get("procedureId") != procedure_id:
            continue
        pattern = classify_source_term_pattern((other.get("what") or {}).get("sourceTerm"))
        if pattern in exclude_patterns:
            continue
        if decision_status(decisions_store, str(other.get("candidateId") or "")) == "accepted":
            matches.append(summarize_record(other, decisions_store))
    return matches


def analyze_pattern_group(
    pattern_id: str,
    wave_records: list[dict[str, Any]],
    corpus_records: list[dict[str, Any]],
    decisions_store: dict[str, Any],
    *,
    exclude_patterns: set[str] | None = None,
) -> dict[str, Any]:
    exclude_patterns = exclude_patterns or {pattern_id}
    wave_matches = [
        record
        for record in wave_records
        if classify_source_term_pattern((record.get("what") or {}).get("sourceTerm")) == pattern_id
    ]
    corpus_matches = [
        record
        for record in corpus_records
        if classify_source_term_pattern((record.get("what") or {}).get("sourceTerm")) == pattern_id
    ]
    by_review_class = Counter(str(record.get("reviewClass") or "") for record in corpus_matches)
    by_wave_status = Counter(
        decision_status(decisions_store, str(record.get("candidateId") or ""))
        for record in wave_matches
    )
    manuals = sorted({str(record.get("manualId") or "") for record in wave_matches})

    sibling_canonical_accepted = 0
    sibling_procedure_accepted = 0
    per_record = []
    for record in wave_matches:
        canonical_siblings = _same_canonical_functional_accepted_sibling(
            record,
            wave_records,
            decisions_store,
            exclude_patterns=exclude_patterns,
        )
        procedure_siblings = _same_procedure_functional_accepted_sibling(
            record,
            wave_records,
            decisions_store,
            exclude_patterns=exclude_patterns,
        )
        if canonical_siblings:
            sibling_canonical_accepted += 1
        if procedure_siblings:
            sibling_procedure_accepted += 1
        per_record.append(
            {
                "record": summarize_record(record, decisions_store),
                "acceptedCanonicalSiblingCount": len(canonical_siblings),
                "acceptedProcedureSiblingCount": len(procedure_siblings),
                "acceptedCanonicalSiblingExamples": canonical_siblings[:3],
                "acceptedProcedureSiblingExamples": procedure_siblings[:3],
            },
        )

    wave_count = len(wave_matches)
    return {
        "patternId": pattern_id,
        "wave1Count": wave_count,
        "wave1ManualIds": manuals,
        "wave1ReviewStatusCounts": dict(by_wave_status),
        "wave1Examples": [summarize_record(record, decisions_store) for record in wave_matches[:8]],
        "wave1Records": per_record,
        "corpusCount": len(corpus_matches),
        "corpusReviewClassCounts": dict(by_review_class),
        "corpusOccursOutsideWave1": len(corpus_matches) > wave_count,
        "wave1WithAcceptedCanonicalSiblingCount": sibling_canonical_accepted,
        "wave1WithAcceptedCanonicalSiblingPercent": round(
            (100.0 * sibling_canonical_accepted / wave_count) if wave_count else 0.0,
            1,
        ),
        "wave1WithAcceptedProcedureSiblingCount": sibling_procedure_accepted,
        "wave1WithAcceptedProcedureSiblingPercent": round(
            (100.0 * sibling_procedure_accepted / wave_count) if wave_count else 0.0,
            1,
        ),
    }


def analyze_connector_identifiers(
    wave_records: list[dict[str, Any]],
    corpus_records: list[dict[str, Any]],
    decisions_store: dict[str, Any],
) -> dict[str, Any]:
    identifier_re = re.compile(r"^[A-Z]{2,3}\d+$")
    items = []
    for identifier in CONNECTOR_IDENTIFIERS:
        wave_hits = [
            record
            for record in wave_records
            if (record.get("what") or {}).get("sourceTerm") == identifier
        ]
        corpus_hits = [
            record
            for record in corpus_records
            if (record.get("what") or {}).get("sourceTerm") == identifier
        ]
        for record in wave_hits:
            canonical_siblings = _same_canonical_functional_accepted_sibling(
                record,
                wave_records,
                decisions_store,
                exclude_patterns={"connector_identifier"},
            )
            items.append(
                {
                    "identifier": identifier,
                    "record": summarize_record(record, decisions_store),
                    "inferredRole": "connector_or_test_point_label",
                    "proposedCanonicalId": (record.get("mapsTo") or {}).get("proposedCanonicalId"),
                    "acceptedCanonicalSiblingExamples": canonical_siblings[:5],
                    "hasAcceptedCanonicalSibling": len(canonical_siblings) > 0,
                },
            )
        items.append(
            {
                "identifier": identifier,
                "wave1Count": len(wave_hits),
                "corpusCount": len(corpus_hits),
                "corpusReviewClassCounts": dict(
                    Counter(str(record.get("reviewClass") or "") for record in corpus_hits),
                ),
            },
        )

    corpus_connector_pattern = [
        record
        for record in corpus_records
        if identifier_re.match(str((record.get("what") or {}).get("sourceTerm") or ""))
    ]
    return {
        "wave1Identifiers": CONNECTOR_IDENTIFIERS,
        "wave1Detail": [item for item in items if "record" in item],
        "identifierCorpusSummary": [
            item for item in items if "wave1Count" in item and "record" not in item
        ],
        "corpusConnectorLikeIdentifierCount": len(corpus_connector_pattern),
        "corpusConnectorLikeReviewClassCounts": dict(
            Counter(str(record.get("reviewClass") or "") for record in corpus_connector_pattern),
        ),
        "corpusConnectorLikeExamples": [
            summarize_record(record, decisions_store) for record in corpus_connector_pattern[:12]
        ],
        "interpretationNote": (
            "DP2/MS2/PR6 on W8178558 map to drain_pump/drive_motor/water_level_sensor with "
            "accepted functional siblings on the same canonical targets in several cases; "
            "treat as schematic connector labels pending corpus-wide evidence before global exclusion."
        ),
    }


def analyze_supply_terminology(
    wave_records: list[dict[str, Any]],
    corpus_records: list[dict[str, Any]],
    decisions_store: dict[str, Any],
) -> dict[str, Any]:
    wave_supply = [
        record
        for record in wave_records
        if (record.get("what") or {}).get("sourceTerm") == "supply"
    ]
    corpus_supply = [
        record
        for record in corpus_records
        if (record.get("what") or {}).get("sourceTerm") == "supply"
    ]

    def bucket(records: list[dict[str, Any]]) -> dict[str, Any]:
        mapping_counts = Counter(
            str((record.get("mapsTo") or {}).get("proposedCanonicalId") or "")
            for record in records
        )
        by_manual: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in records:
            by_manual[str(record.get("manualId") or "")].append(summarize_record(record, decisions_store))
        return {
            "count": len(records),
            "mappingCounts": dict(mapping_counts),
            "manualIds": sorted(by_manual.keys()),
            "byManual": dict(sorted(by_manual.items())),
        }

    wave_buckets = bucket(wave_supply)
    corpus_buckets = bucket(corpus_supply)

    supply_to_supply_wave = [
        record for record in wave_supply
        if (record.get("mapsTo") or {}).get("proposedCanonicalId") == "supply"
    ]
    supply_to_power_wave = [
        record for record in wave_supply
        if (record.get("mapsTo") or {}).get("proposedCanonicalId") == "power_supply"
    ]

    return {
        "wave1": {
            **wave_buckets,
            "supplyToSupply": {
                "count": len(supply_to_supply_wave),
                "reviewStatusCounts": dict(
                    Counter(
                        decision_status(decisions_store, str(record.get("candidateId") or ""))
                        for record in supply_to_supply_wave
                    ),
                ),
                "records": [summarize_record(record, decisions_store) for record in supply_to_supply_wave],
            },
            "supplyToPowerSupply": {
                "count": len(supply_to_power_wave),
                "reviewStatusCounts": dict(
                    Counter(
                        decision_status(decisions_store, str(record.get("candidateId") or ""))
                        for record in supply_to_power_wave
                    ),
                ),
                "manualIds": sorted({str(record.get("manualId") or "") for record in supply_to_power_wave}),
            },
        },
        "corpus": corpus_buckets,
        "terminologyObservation": (
            "Wave 1 uses both proposedCanonicalId 'supply' and 'power_supply' for sourceTerm 'supply'. "
            "Both ids exist in frozen vocabulary. Human review rejected one FlexWash supply→supply mapping "
            "while accepting other supply→supply rows — evidence of semantic inconsistency, not authorization "
            "to impose a single production rule."
        ),
        "electricalPowerSupplyHypothesis": (
            "Procedure context for deferred/rejected supply rows and accepted power_supply rows suggests "
            "'supply' usually denotes electrical inlet/power in service-test sections; accepted supply→supply "
            "rows may reflect shorthand test labels rather than a distinct canonical function from power_supply."
        ),
    }


def cross_corpus_recurrence(
    corpus_records: list[dict[str, Any]],
    decisions_store: dict[str, Any],
) -> dict[str, Any]:
    identifier_re = re.compile(r"^[A-Z]{2,3}\d+$")
    oem = [r for r in corpus_records if classify_source_term_pattern((r.get("what") or {}).get("sourceTerm")) == "oem_test_heading"]
    section = [
        r for r in corpus_records
        if classify_source_term_pattern((r.get("what") or {}).get("sourceTerm")) == "manual_section_heading"
    ]
    connectors = [
        r for r in corpus_records
        if identifier_re.match(str((r.get("what") or {}).get("sourceTerm") or ""))
    ]
    supply_term = [r for r in corpus_records if (r.get("what") or {}).get("sourceTerm") == "supply"]
    maps_supply = [r for r in corpus_records if (r.get("mapsTo") or {}).get("proposedCanonicalId") == "supply"]
    maps_power = [r for r in corpus_records if (r.get("mapsTo") or {}).get("proposedCanonicalId") == "power_supply"]

    return {
        "corpusCandidateCount": len(corpus_records),
        "oemTestHeadingCount": len(oem),
        "manualSectionHeadingCount": len(section),
        "connectorIdentifierPatternCount": len(connectors),
        "sourceTermSupplyCount": len(supply_term),
        "mappingToSupplyCount": len(maps_supply),
        "mappingToPowerSupplyCount": len(maps_power),
        "oemTestHeadingReviewClassCounts": dict(Counter(str(r.get("reviewClass") or "") for r in oem)),
        "manualSectionHeadingReviewClassCounts": dict(Counter(str(r.get("reviewClass") or "") for r in section)),
        "sourceTermSupplyMappingCounts": dict(
            Counter(str((r.get("mapsTo") or {}).get("proposedCanonicalId") or "") for r in supply_term),
        ),
        "examples": {
            "oemTestHeading": [summarize_record(r, decisions_store) for r in oem[:5]],
            "manualSectionHeading": [summarize_record(r, decisions_store) for r in section[:5]],
            "connectorIdentifier": [summarize_record(r, decisions_store) for r in connectors[:8]],
            "sourceTermSupply": [summarize_record(r, decisions_store) for r in supply_term[:6]],
        },
    }


def build_recommended_next_action(analyses: dict[str, Any]) -> dict[str, Any]:
    oem = analyses["oemTestHeadingAnalysis"]
    section = analyses["manualSectionHeadingAnalysis"]
    connector = analyses["connectorIdentifierAnalysis"]
    supply = analyses["supplyTerminologyAnalysis"]
    cross = analyses["crossCorpusRecurrence"]

    recommendations = []
    if oem["corpusCount"] > oem["wave1Count"]:
        recommendations.append(
            {
                "area": "oem_test_heading",
                "action": "candidate_generation_cleanup_candidate",
                "rationale": (
                    f"{oem['corpusCount']} corpus-wide OEM test-heading-shaped candidates "
                    f"({oem['wave1Count']} in Wave 1); "
                    f"{oem['wave1WithAcceptedCanonicalSiblingPercent']}% of deferred Wave 1 headings "
                    "have an accepted functional sibling on the same canonical target."
                ),
            },
        )
    if section["wave1Count"] > 0:
        recommendations.append(
            {
                "area": "manual_section_heading",
                "action": "candidate_generation_cleanup_candidate",
                "rationale": (
                    "Section-heading-shaped source terms mirror OEM heading issue; "
                    "check component-level sibling candidates before any canonical change."
                ),
            },
        )
    if connector["corpusConnectorLikeIdentifierCount"] > len(CONNECTOR_IDENTIFIERS):
        recommendations.append(
            {
                "area": "connector_identifier",
                "action": "requires_separate_architecture_governance_review",
                "rationale": (
                    f"{connector['corpusConnectorLikeIdentifierCount']} connector-like identifiers in corpus; "
                    "only 3 deferred in Wave 1 — global exclusion not yet evidence-backed."
                ),
            },
        )
    recommendations.append(
        {
            "area": "supply_terminology",
            "action": "requires_separate_architecture_governance_review",
            "rationale": (
                "Wave 1 supply term maps to both supply and power_supply with mixed human outcomes; "
                "do not auto-normalize until terminology policy is decided."
            ),
        },
    )
    recommendations.append(
        {
            "area": "wave2_entry",
            "action": "proceed_with_wave2_human_review",
            "rationale": (
                "Wave 1 closed; synthesis is read-only. Enter Wave 2 (newPlatformKnowledge) with "
                "awareness of heading/connector/supply patterns — no pipeline mutation in this gate."
            ),
        },
    )

    return {
        "productionMutationAuthorized": False,
        "items": recommendations,
        "crossCorpusOemTestHeadingCount": cross["oemTestHeadingCount"],
        "crossCorpusSupplySplit": cross["sourceTermSupplyMappingCounts"],
    }


def run_wave1_pattern_synthesis() -> dict[str, Any]:
    index = load_review_index()
    decisions_store = load_decisions()
    wave_records = select_wave_candidates(index)
    corpus_records = list(index.get("candidateRecords") or [])

    oem_analysis = analyze_pattern_group(
        "oem_test_heading",
        wave_records,
        corpus_records,
        decisions_store,
    )
    section_analysis = analyze_pattern_group(
        "manual_section_heading",
        wave_records,
        corpus_records,
        decisions_store,
    )
    connector_analysis = analyze_connector_identifiers(wave_records, corpus_records, decisions_store)
    supply_analysis = analyze_supply_terminology(wave_records, corpus_records, decisions_store)
    cross = cross_corpus_recurrence(corpus_records, decisions_store)

    analyses = {
        "oemTestHeadingAnalysis": oem_analysis,
        "manualSectionHeadingAnalysis": section_analysis,
        "connectorIdentifierAnalysis": connector_analysis,
        "supplyTerminologyAnalysis": supply_analysis,
        "crossCorpusRecurrence": cross,
    }
    recommended = build_recommended_next_action(analyses)

    return {
        "schemaVersion": 1,
        "reportType": "cg_wave1_pattern_synthesis",
        "status": "READ_ONLY_SYNTHESIS_COMPLETE",
        "generatedAt": _utc_now(),
        "wave1Reference": {
            "waveId": WAVE_ID,
            "reviewClass": REVIEW_CLASS,
            "closureCommit": WAVE1_CLOSURE_COMMIT,
            "closureAudit": "CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_AUDIT_v1.json",
            "reviewedCount": 370,
            "acceptedCount": 328,
            "deferredCount": 41,
            "rejectedCount": 1,
        },
        **analyses,
        "recommendedNextAction": recommended,
        "mutationPolicy": {
            "canonicalGraphsMutated": False,
            "candidateArtifactsMutated": False,
            "reviewDecisionsMutated": False,
            "normalizationPipelineMutated": False,
        },
    }


def write_pattern_synthesis(payload: dict[str, Any]) -> Path:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    path = synthesis_artifact_path()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path
