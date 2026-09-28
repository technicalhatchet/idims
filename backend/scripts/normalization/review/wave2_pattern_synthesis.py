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
from .wave2_new_platform_knowledge import (
    EXPECTED_CANDIDATE_COUNT,
    REVIEW_CLASS,
    WAVE_ID,
    load_review_index,
    select_wave_candidates,
)

SYNTHESIS_FILENAME = "CG_WAVE2_PATTERN_SYNTHESIS_v1.json"
WAVE2_CLOSURE_COMMIT = "pending"


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
        "candidateType": maps_to.get("candidateType"),
        "platformId": (record.get("context") or {}).get("platformId"),
        "reviewStatus": decision_status(decisions_store, str(record.get("candidateId") or "")),
    }


def classify_wave2_source_pattern(source_term: str | None) -> str:
    term = (source_term or "").strip()
    if not term:
        return "empty_or_missing"
    if term.startswith("overlay-") or term.startswith("overlay_"):
        return "generated_overlay_identifier"
    if re.match(r"^[A-Z]\d{1,2}\s*[—\-–:]", term) or re.match(r"^[EF][0-9A-Z]{1,3}\s", term):
        return "error_code_prefixed_label"
    pattern = classify_source_term_pattern(term)
    if pattern in {"oem_test_heading", "manual_section_heading", "connector_identifier"}:
        return "structural_title_noise"
    return "human_readable_label"


def measurement_provenance(record: dict[str, Any]) -> dict[str, Any] | None:
    sources = (record.get("where") or {}).get("provenanceSources") or []
    for source in sources:
        if source.get("type") == "measurement":
            return source
    return None


def build_pattern_finding(
    pattern_id: str,
    records: list[dict[str, Any]],
    decisions_store: dict[str, Any],
    *,
    evidence: str,
    recommended_disposition: str,
) -> dict[str, Any]:
    status_counts = Counter(
        decision_status(decisions_store, str(record.get("candidateId") or ""))
        for record in records
    )
    return {
        "pattern": pattern_id,
        "count": len(records),
        "exampleCandidateIds": [str(record.get("candidateId") or "") for record in records[:8]],
        "decisionDistribution": dict(status_counts),
        "examples": [summarize_record(record, decisions_store) for record in records[:6]],
        "evidence": evidence,
        "recommendedDisposition": recommended_disposition,
    }


def analyze_wave2_patterns(
    wave_records: list[dict[str, Any]],
    decisions_store: dict[str, Any],
) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in wave_records:
        term = (record.get("what") or {}).get("sourceTerm")
        groups[classify_wave2_source_pattern(term)].append(record)

    findings: list[dict[str, Any]] = []
    findings.append(
        build_pattern_finding(
            "measurementBinding",
            [r for r in wave_records if (r.get("mapsTo") or {}).get("candidateType") == "measurementBinding"],
            decisions_store,
            evidence="mapsTo.candidateType=measurementBinding; often pairs with measurement provenanceSources.",
            recommended_disposition="retain_as_platform_knowledge_when_measurement_provenance_present",
        ),
    )
    findings.append(
        build_pattern_finding(
            "procedureTestBinding",
            [r for r in wave_records if (r.get("mapsTo") or {}).get("candidateType") == "procedureTestBinding"],
            decisions_store,
            evidence="mapsTo.candidateType=procedureTestBinding; OEM test / overlay procedure bindings.",
            recommended_disposition="human_review_procedure_and_canonical_target_context",
        ),
    )

    overlay = groups["generated_overlay_identifier"]
    findings.append(
        build_pattern_finding(
            "generated_overlay_identifier",
            overlay,
            decisions_store,
            evidence="sourceTerm begins with overlay- (generator artifact); substantive context in procedureId/mapsTo.",
            recommended_disposition="candidate_generation_label_cleanup_candidate_not_auto_reject",
        ),
    )

    structural = groups["structural_title_noise"]
    findings.append(
        build_pattern_finding(
            "structural_title_noise",
            structural,
            decisions_store,
            evidence="OEM TEST #, section headings, or connector-like labels in sourceTerm.",
            recommended_disposition="prefer_procedure_maps_to_candidate_type_over_sourceTerm_label",
        ),
    )

    error_prefixed = groups["error_code_prefixed_label"]
    findings.append(
        build_pattern_finding(
            "error_code_prefixed_label",
            error_prefixed,
            decisions_store,
            evidence="sourceTerm prefixed with fault/error style codes (e.g. E8 —).",
            recommended_disposition="treat_code_prefix_as_noise_review_procedure_binding",
        ),
    )

    human = groups["human_readable_label"]
    findings.append(
        build_pattern_finding(
            "human_readable_platform_label",
            human,
            decisions_store,
            evidence="Human-readable sourceTerm without overlay/test-heading/error-prefix patterns.",
            recommended_disposition="default_accept_path_when_procedure_and_maps_to_coherent",
        ),
    )

    with_measurement = [r for r in wave_records if measurement_provenance(r)]
    findings.append(
        build_pattern_finding(
            "legitimate_platform_measurement_spec",
            with_measurement,
            decisions_store,
            evidence="where.provenanceSources includes type=measurement with stepTitle/measurementKnowledgeId.",
            recommended_disposition="retain_as_implementation_knowledge",
        ),
    )

    deferred = [
        r
        for r in wave_records
        if decision_status(decisions_store, str(r.get("candidateId") or "")) == "deferred"
    ]
    findings.append(
        build_pattern_finding(
            "deferred_possible_canonical_gap",
            deferred,
            decisions_store,
            evidence="Human deferred — may indicate architecture/canonical abstraction uncertainty.",
            recommended_disposition="architecture_review_before_wave3_not_auto_promotion",
        ),
    )

    rejected = [
        r
        for r in wave_records
        if decision_status(decisions_store, str(r.get("candidateId") or "")) == "rejected"
    ]
    findings.append(
        build_pattern_finding(
            "rejected_extraction_or_noise",
            rejected,
            decisions_store,
            evidence="Human rejected — not legitimate platform knowledge per Wave 2 criteria.",
            recommended_disposition="candidate_generation_suppression_candidate_after_human_evidence_review",
        ),
    )

    return sorted(findings, key=lambda item: (-int(item["count"]), item["pattern"]))


def run_wave2_pattern_synthesis() -> dict[str, Any]:
    index = load_review_index()
    decisions_store = load_decisions()
    wave_records = select_wave_candidates(index)
    findings = analyze_wave2_patterns(wave_records, decisions_store)

    status_counts = Counter(
        decision_status(decisions_store, str(record.get("candidateId") or ""))
        for record in wave_records
    )

    return {
        "schemaVersion": 1,
        "reportType": "cg_wave2_pattern_synthesis",
        "status": "READ_ONLY_SYNTHESIS_COMPLETE",
        "generatedAt": _utc_now(),
        "wave2Reference": {
            "waveId": WAVE_ID,
            "reviewClass": REVIEW_CLASS,
            "closureAudit": "CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_CLOSURE_AUDIT_v1.json",
            "expectedCandidateCount": EXPECTED_CANDIDATE_COUNT,
            "reviewedCandidateCount": len(wave_records),
            "decisionDistribution": dict(status_counts),
        },
        "findings": findings,
        "summary": {
            "measurementBindingCount": sum(
                1
                for record in wave_records
                if (record.get("mapsTo") or {}).get("candidateType") == "measurementBinding"
            ),
            "procedureTestBindingCount": sum(
                1
                for record in wave_records
                if (record.get("mapsTo") or {}).get("candidateType") == "procedureTestBinding"
            ),
            "generatedOverlayIdentifierCount": sum(
                1
                for record in wave_records
                if classify_wave2_source_pattern((record.get("what") or {}).get("sourceTerm"))
                == "generated_overlay_identifier"
            ),
            "structuralTitleNoiseCount": sum(
                1
                for record in wave_records
                if classify_wave2_source_pattern((record.get("what") or {}).get("sourceTerm"))
                == "structural_title_noise"
            ),
        },
        "mutationPolicy": {
            "canonicalGraphsMutated": False,
            "candidateArtifactsMutated": False,
            "reviewDecisionsMutated": False,
            "normalizationPipelineMutated": False,
            "automaticFilteringRulesApplied": False,
        },
        "interpretationNote": (
            "Governance-only synthesis after Wave 2 closure. Patterns inform future generator "
            "improvement review; do not auto-apply filters or promotions."
        ),
    }


def write_pattern_synthesis(payload: dict[str, Any]) -> Path:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    path = synthesis_artifact_path()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path
