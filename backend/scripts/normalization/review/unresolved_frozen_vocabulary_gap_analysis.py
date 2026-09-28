from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .frozen_canonical_vocabulary import load_frozen_canonical_ids
from .unresolved_pool_analysis import (
    BATCH_RUN_ID,
    classify_terminology_problem,
    decomposition_evidence,
    has_meaningful_diagnostic_evidence,
    pool_content_hash,
    select_unresolved_candidates,
    structural_source_only,
)
from .wave1_closure_audit import (
    BATCH_LOCK_FILE,
    classify_source_term_pattern,
    validate_frozen_hashes,
)
from .wave1_existing_canonical_mapping import load_review_index
from .wave3_new_canonical_knowledge import select_wave_candidates as select_wave3

ANALYSIS_FILENAME = "CG_UNRESOLVED_FROZEN_VOCABULARY_GAP_ANALYSIS_v1.json"
AUDIT_FILENAME = "CG_UNRESOLVED_FROZEN_VOCABULARY_GAP_ANALYSIS_AUDIT_v1.json"
WAVE1_CLOSURE = REVIEW_DIR / "waves" / "CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_AUDIT_v1.json"
WAVE2_CLOSURE = REVIEW_DIR / "waves" / "CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_CLOSURE_AUDIT_v1.json"
WAVE3_DEFINITION = REVIEW_DIR / "waves" / "CG_WAVE3_NEW_CANONICAL_KNOWLEDGE_REVIEW_v1.json"

ACCEPTED_REVIEW_CLASSES = frozenset({"existingCanonicalMapping", "newPlatformKnowledge"})

ANALYSIS_CATEGORIES = frozenset(
    {
        "EXISTING_FROZEN_MAPPING_MISSED",
        "POSSIBLE_ALIAS_GAP",
        "POSSIBLE_DECOMPOSITION_GAP",
        "PLATFORM_SPECIFIC_FUNCTION",
        "INSUFFICIENT_FUNCTIONAL_EVIDENCE",
        "POSSIBLE_ARCHITECTURE_DISCOVERY",
        "POSSIBLE_EXTRACTION_NOISE",
        "UNDETERMINED",
    },
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def analysis_path() -> Path:
    return CALIBRATION_DIR / ANALYSIS_FILENAME


def audit_path() -> Path:
    return CALIBRATION_DIR / AUDIT_FILENAME


def select_frozen_vocabulary_gap_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    gap = []
    for record in records:
        maps_to = record.get("mapsTo") or {}
        if maps_to.get("candidateType") != "canonicalMapping":
            continue
        if maps_to.get("proposedCanonicalId"):
            continue
        gap.append(record)
    return gap


def select_procedure_test_binding_unresolved(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for record in records:
        maps_to = record.get("mapsTo") or {}
        if maps_to.get("candidateType") == "procedureTestBinding":
            out.append(record)
    return out


def normalize_source_term(term: str | None) -> str:
    value = (term or "").strip()
    value = re.sub(r"^§[\d\-.]+:\s*", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^TEST\s*#\d+[:\s-]*", "", value, flags=re.IGNORECASE)
    value = re.sub(r"[\s_\-]+", " ", value).strip().lower()
    return value


def procedure_family(procedure_id: str | None) -> str:
    if not procedure_id:
        return "__none__"
    parts = str(procedure_id).split("-")
    if len(parts) >= 2:
        return "-".join(parts[:2])
    return str(procedure_id)


def decomposition_key(decomposition: dict[str, Any] | None) -> tuple[str, str, str]:
    if not decomposition:
        return ("", "", "")
    return (
        str(decomposition.get("domain") or ""),
        str(decomposition.get("component") or ""),
        str(decomposition.get("actuator") or ""),
    )


def summarize_accepted(record: dict[str, Any]) -> dict[str, Any]:
    what = record.get("what") or {}
    maps_to = record.get("mapsTo") or {}
    return {
        "candidateId": record.get("candidateId"),
        "manualId": record.get("manualId"),
        "procedureId": what.get("procedureId"),
        "sourceTerm": what.get("sourceTerm"),
        "normalizedSourceTerm": normalize_source_term(what.get("sourceTerm")),
        "proposedCanonicalId": maps_to.get("proposedCanonicalId"),
        "platformId": (record.get("context") or {}).get("platformId"),
        "decomposition": decomposition_evidence(record),
        "reviewClass": record.get("reviewClass"),
    }


def build_accepted_corpus(
    index: dict[str, Any],
    decisions_store: dict[str, Any],
) -> list[dict[str, Any]]:
    decision_map = decisions_store.get("decisions") or {}
    accepted: list[dict[str, Any]] = []
    for record in index.get("candidateRecords") or []:
        candidate_id = str(record.get("candidateId") or "")
        if decision_map.get(candidate_id, {}).get("reviewStatus") != "accepted":
            continue
        if record.get("reviewClass") not in ACCEPTED_REVIEW_CLASSES:
            continue
        accepted.append(summarize_accepted(record))
    return accepted


def infer_frozen_token_candidates(record: dict[str, Any], frozen_ids: frozenset[str]) -> set[str]:
    matches: set[str] = set()
    term = normalize_source_term((record.get("what") or {}).get("sourceTerm"))
    for canonical_id in frozen_ids:
        canonical_text = canonical_id.replace("_", " ")
        if term and (canonical_text in term or term in canonical_text):
            matches.add(canonical_id)
    decomposition = decomposition_evidence(record)
    if decomposition:
        parts = [decomposition.get("domain"), decomposition.get("component"), decomposition.get("actuator")]
        joined = "_".join(str(part) for part in parts if part)
        joined_spaced = " ".join(str(part) for part in parts if part)
        for canonical_id in frozen_ids:
            if joined and (joined in canonical_id or canonical_id in joined):
                matches.add(canonical_id)
            if joined_spaced and joined_spaced in canonical_id.replace("_", " "):
                matches.add(canonical_id)
    return matches


def find_accepted_siblings(
    record: dict[str, Any],
    accepted_corpus: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    what = record.get("what") or {}
    context = record.get("context") or {}
    manual_id = record.get("manualId")
    platform_id = context.get("platformId")
    procedure_id = what.get("procedureId")
    norm_term = normalize_source_term(what.get("sourceTerm"))
    decomp_key = decomposition_key(decomposition_evidence(record))

    siblings: list[dict[str, Any]] = []
    for accepted in accepted_corpus:
        if accepted.get("candidateId") == record.get("candidateId"):
            continue
        score = 0
        if accepted.get("manualId") == manual_id and accepted.get("procedureId") == procedure_id:
            score += 4
        if decomp_key != ("", "", "") and decomposition_key(accepted.get("decomposition")) == decomp_key:
            score += 3
        if platform_id and accepted.get("platformId") == platform_id and decomp_key == decomposition_key(
            accepted.get("decomposition"),
        ):
            score += 2
        if norm_term and accepted.get("normalizedSourceTerm") == norm_term:
            score += 5
        if norm_term and accepted.get("normalizedSourceTerm") and (
            norm_term in accepted["normalizedSourceTerm"]
            or accepted["normalizedSourceTerm"] in norm_term
        ):
            score += 1
        if score >= 3:
            siblings.append({**accepted, "siblingScore": score})
    siblings.sort(key=lambda item: (-int(item.get("siblingScore") or 0), str(item.get("candidateId") or "")))
    return siblings[:8]


def classify_gap_record(
    record: dict[str, Any],
    *,
    accepted_corpus: list[dict[str, Any]],
    frozen_ids: frozenset[str],
) -> dict[str, Any]:
    blockers = record.get("blockers") or {}
    blocked_reason = blockers.get("blockedReason")
    governance_signals: list[str] = []
    if blocked_reason == "AMBIGUOUS_COMPONENT":
        governance_signals.append("AMBIGUOUS_COMPONENT")
    if blocked_reason == "CROSS_APPLIANCE_TERM":
        governance_signals.append("CROSS_APPLIANCE_TERM")

    siblings = find_accepted_siblings(record, accepted_corpus)
    sibling_canonicals = {
        str(sibling.get("proposedCanonicalId") or "")
        for sibling in siblings
        if sibling.get("proposedCanonicalId")
    }
    inferred = infer_frozen_token_candidates(record, frozen_ids)
    meaningful = has_meaningful_diagnostic_evidence(record)
    structural = structural_source_only(record)

    primary = "UNDETERMINED"

    if governance_signals == ["CROSS_APPLIANCE_TERM"]:
        primary = "PLATFORM_SPECIFIC_FUNCTION"
    elif "AMBIGUOUS_COMPONENT" in governance_signals:
        primary = "POSSIBLE_ARCHITECTURE_DISCOVERY"
    elif siblings and sibling_canonicals & frozen_ids:
        primary = "EXISTING_FROZEN_MAPPING_MISSED"
    elif siblings and sibling_canonicals:
        primary = "POSSIBLE_ALIAS_GAP"
    elif inferred & frozen_ids:
        primary = "POSSIBLE_ALIAS_GAP"
    elif decomposition_evidence(record) and not inferred:
        primary = "POSSIBLE_DECOMPOSITION_GAP"
    elif structural and not meaningful:
        primary = "POSSIBLE_EXTRACTION_NOISE"
    elif classify_terminology_problem(record):
        primary = "POSSIBLE_ALIAS_GAP"
    elif (record.get("mapsTo") or {}).get("mappingType") == "compound_alias" and meaningful:
        primary = "PLATFORM_SPECIFIC_FUNCTION"
    elif not meaningful:
        primary = "INSUFFICIENT_FUNCTIONAL_EVIDENCE"
    else:
        primary = "UNDETERMINED"

    return {
        "candidateId": record.get("candidateId"),
        "manualId": record.get("manualId"),
        "procedureId": (record.get("what") or {}).get("procedureId"),
        "procedureFamily": procedure_family((record.get("what") or {}).get("procedureId")),
        "platformId": (record.get("context") or {}).get("platformId"),
        "sourceTerm": (record.get("what") or {}).get("sourceTerm"),
        "sourceTermPattern": classify_source_term_pattern((record.get("what") or {}).get("sourceTerm")),
        "candidateType": (record.get("mapsTo") or {}).get("candidateType"),
        "blockedReason": blocked_reason,
        "primaryAnalysisCategory": primary,
        "governanceSignals": governance_signals,
        "inferredFrozenTokenCandidates": sorted(inferred),
        "acceptedSiblingEvidence": siblings[:5],
        "hasMeaningfulDiagnosticEvidence": meaningful,
        "structuralSourceOnly": structural,
        "decomposition": decomposition_evidence(record),
    }


def aggregate_category_groups(analyses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for analysis in analyses:
        groups[analysis["primaryAnalysisCategory"]].append(analysis)

    findings = []
    for category, items in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])):
        manuals = sorted({str(item.get("manualId") or "") for item in items})
        platforms = sorted({str(item.get("platformId") or "") for item in items if item.get("platformId")})
        with_siblings = sum(1 for item in items if item.get("acceptedSiblingEvidence"))
        findings.append(
            {
                "analysisCategory": category,
                "count": len(items),
                "manualCount": len(manuals),
                "platformCount": len(platforms),
                "acceptedSiblingEvidenceCount": with_siblings,
                "exampleCandidateIds": [item["candidateId"] for item in items[:12]],
                "examples": items[:6],
                "provenance": {
                    "candidateIds": [str(item["candidateId"]) for item in items],
                },
                "recommendedFutureAction": {
                    "EXISTING_FROZEN_MAPPING_MISSED": "matcher_or_alias_improvement_review_not_auto_change",
                    "POSSIBLE_ALIAS_GAP": "alias_coverage_review_not_auto_alias_creation",
                    "POSSIBLE_DECOMPOSITION_GAP": "decomposition_parser_review_not_auto_change",
                    "PLATFORM_SPECIFIC_FUNCTION": "platform_knowledge_path_review_not_canonical_promotion",
                    "INSUFFICIENT_FUNCTIONAL_EVIDENCE": "low_priority_human_review_only_if_procedure_critical",
                    "POSSIBLE_ARCHITECTURE_DISCOVERY": "architecture_fit_discovery_witness_freeze_promotion_path",
                    "POSSIBLE_EXTRACTION_NOISE": "generator_label_hygiene_review_not_auto_rejection",
                    "UNDETERMINED": "targeted_human_review_when_procedure_critical",
                }.get(category, "governance_review_only"),
            },
        )
    return findings


def analyze_procedure_test_bindings(
    records: list[dict[str, Any]],
    accepted_corpus: list[dict[str, Any]],
) -> dict[str, Any]:
    analyses = []
    for record in records:
        maps_to = record.get("mapsTo") or {}
        siblings = find_accepted_siblings(record, accepted_corpus)
        analyses.append(
            {
                "candidateId": record.get("candidateId"),
                "manualId": record.get("manualId"),
                "procedureId": (record.get("what") or {}).get("procedureId"),
                "proposedCanonicalId": maps_to.get("proposedCanonicalId"),
                "sourceTerm": (record.get("what") or {}).get("sourceTerm"),
                "blockedReason": (record.get("blockers") or {}).get("blockedReason"),
                "acceptedSiblingEvidence": siblings[:5],
                "recommendedFutureAction": "targeted_procedure_test_binding_review",
            },
        )
    return {
        "count": len(records),
        "records": analyses,
        "provenance": {"candidateIds": [str(record.get("candidateId") or "") for record in records]},
    }


def run_integrity_checks(
    index: dict[str, Any],
    unresolved: list[dict[str, Any]],
    gap_records: list[dict[str, Any]],
    decisions_before: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    index_after = load_review_index()
    unresolved_after = select_unresolved_candidates(index_after)
    decisions_after = load_decisions()

    if str(index.get("batchRunId") or "") != BATCH_RUN_ID:
        errors.append("batchRunId mismatch")
    if len(unresolved) != 1100:
        errors.append(f"unresolved count {len(unresolved)} != 1100")
    if len(unresolved_after) != len(unresolved):
        errors.append("unresolved count changed during analysis")
    if pool_content_hash(unresolved) != pool_content_hash(unresolved_after):
        errors.append("unresolved pool content hash changed during analysis")

    gap_after = select_frozen_vocabulary_gap_records(unresolved_after)
    if len(gap_records) != 1078:
        errors.append(f"gap pool count {len(gap_records)} != 1078")
    if len(gap_after) != len(gap_records):
        errors.append("canonicalMapping gap count changed during analysis")

    before_map = decisions_before.get("decisions") or {}
    after_map = decisions_after.get("decisions") or {}
    if len(before_map) != 796:
        errors.append(f"decision count {len(before_map)} != 796")
    if before_map != after_map:
        errors.append("review decisions changed during analysis")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
    wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
    if wave1.get("status") != "WAVE1_CLOSED":
        errors.append("wave1 closure not intact")
    if wave2.get("status") != "WAVE2_CLOSED":
        errors.append("wave2 closure not intact")

    wave3_def = json.loads(WAVE3_DEFINITION.read_text(encoding="utf-8")) if WAVE3_DEFINITION.is_file() else {}
    wave3_expected = wave3_def.get("expectedCandidateCount")
    if wave3_expected is None or int(wave3_expected) != 0:
        errors.append("wave3 not empty in definition")
    if len(select_wave3(index_after)) != 0:
        errors.append("wave3 pool not empty")

    if not (CALIBRATION_DIR / BATCH_LOCK_FILE).is_file():
        errors.append("batch lock missing")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "unresolvedCount": len(unresolved),
        "canonicalMappingGapCount": len(gap_records),
        "unresolvedPoolContentHash": pool_content_hash(unresolved),
        "reviewDecisionCount": len(before_map),
        "frozenCanonicalHashesValid": hashes_ok,
        "wave1ClosureIntact": wave1.get("status") == "WAVE1_CLOSED",
        "wave2ClosureIntact": wave2.get("status") == "WAVE2_CLOSED",
        "wave3Empty": len(select_wave3(index_after)) == 0,
        "canonicalMutationDetected": not hashes_ok,
        "candidateMutationDetected": pool_content_hash(unresolved) != pool_content_hash(unresolved_after),
        "promotionPerformed": False,
        "batchAuthorizationChanged": False,
    }


def run_unresolved_frozen_vocabulary_gap_analysis() -> dict[str, Any]:
    index = load_review_index()
    unresolved = select_unresolved_candidates(index)
    gap_records = select_frozen_vocabulary_gap_records(unresolved)
    procedure_test_records = select_procedure_test_binding_unresolved(unresolved)

    decisions_store = load_decisions()
    frozen_ids = load_frozen_canonical_ids()
    accepted_corpus = build_accepted_corpus(index, decisions_store)

    gap_analyses = [
        classify_gap_record(record, accepted_corpus=accepted_corpus, frozen_ids=frozen_ids)
        for record in gap_records
    ]
    category_counts = Counter(item["primaryAnalysisCategory"] for item in gap_analyses)

    ambiguous_signals = [
        item for item in gap_analyses if "AMBIGUOUS_COMPONENT" in item.get("governanceSignals", [])
    ]
    cross_appliance_signals = [
        item for item in gap_analyses if "CROSS_APPLIANCE_TERM" in item.get("governanceSignals", [])
    ]

    procedure_test_analysis = analyze_procedure_test_bindings(procedure_test_records, accepted_corpus)
    category_groups = aggregate_category_groups(gap_analyses)

    alias_clusters = Counter(
        tuple(sorted(item.get("inferredFrozenTokenCandidates") or []))
        for item in gap_analyses
        if item.get("inferredFrozenTokenCandidates")
    )
    missed_with_siblings = [
        item for item in gap_analyses if item["primaryAnalysisCategory"] == "EXISTING_FROZEN_MAPPING_MISSED"
    ]

    generated_at = _utc_now()
    integrity = run_integrity_checks(index, unresolved, gap_records, decisions_store)

    analysis = {
        "schemaVersion": 1,
        "reportType": "cg_unresolved_frozen_vocabulary_gap_analysis",
        "status": "READ_ONLY_MATCHER_GAP_ANALYSIS_COMPLETE",
        "generatedAt": generated_at,
        "batchRunId": BATCH_RUN_ID,
        "sourceUnresolvedPoolAnalysis": "CG_UNRESOLVED_POOL_ANALYSIS_v1.json",
        "totalUnresolvedCount": len(unresolved),
        "canonicalMappingGapCount": len(gap_records),
        "procedureTestBindingUnresolvedCount": len(procedure_test_records),
        "acceptedCorpusReferenceCount": len(accepted_corpus),
        "frozenCanonicalIdCount": len(frozen_ids),
        "analysisCategoryCounts": dict(category_counts),
        "countsByManualId": dict(Counter(item["manualId"] for item in gap_analyses).most_common(50)),
        "countsByPlatformId": dict(
            Counter(item["platformId"] or "__none__" for item in gap_analyses).most_common(50),
        ),
        "countsBySourceTermPattern": dict(Counter(item["sourceTermPattern"] for item in gap_analyses)),
        "countsByProcedureFamily": dict(Counter(item["procedureFamily"] for item in gap_analyses).most_common(40)),
        "acceptedSiblingEvidenceCount": sum(1 for item in gap_analyses if item.get("acceptedSiblingEvidence")),
        "existingFrozenMappingMissedCount": category_counts.get("EXISTING_FROZEN_MAPPING_MISSED", 0),
        "possibleAliasGapCount": category_counts.get("POSSIBLE_ALIAS_GAP", 0),
        "likelyAliasClustersTop": [
            {"inferredFrozenTokens": key, "count": count}
            for key, count in alias_clusters.most_common(25)
            if key
        ],
        "categoryFindings": category_groups,
        "existingFrozenMappingMissedExamples": missed_with_siblings[:15],
        "governanceSignalsPreserved": {
            "AMBIGUOUS_COMPONENT": {
                "count": len(ambiguous_signals),
                "candidateIds": [item["candidateId"] for item in ambiguous_signals],
            },
            "CROSS_APPLIANCE_TERM": {
                "count": len(cross_appliance_signals),
                "candidateIds": [item["candidateId"] for item in cross_appliance_signals],
            },
        },
        "procedureTestBindingAnalysis": procedure_test_analysis,
        "recordAnalyses": gap_analyses,
        "mutationPolicy": {
            "readOnly": True,
            "reclassifiedCandidates": False,
            "promotionPerformed": False,
            "aliasesAutoCreated": False,
            "matcherAutoChanged": False,
            "automaticRejectionApplied": False,
            "newCanonicalKnowledgeAssigned": False,
        },
        "governanceNote": (
            "Analysis labels describe likely failure modes only. possible_architecture_discovery is not "
            "newCanonicalKnowledge. Alias gaps do not authorize alias creation. Mapping-missed signals do "
            "not authorize matcher changes without human governance."
        ),
    }

    audit = {
        "schemaVersion": 1,
        "reportType": "cg_unresolved_frozen_vocabulary_gap_analysis_audit",
        "status": "READ_ONLY_MATCHER_GAP_ANALYSIS_COMPLETE" if integrity["passed"] else "ANALYSIS_BLOCKED",
        "generatedAt": generated_at,
        "analysisArtifact": ANALYSIS_FILENAME,
        "integrityChecks": integrity,
        "errors": integrity["errors"],
    }

    return {"analysis": analysis, "audit": audit}


def write_unresolved_frozen_vocabulary_gap_analysis(payload: dict[str, Any]) -> tuple[Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    analysis_file = analysis_path()
    audit_file = audit_path()
    analysis_file.write_text(json.dumps(payload["analysis"], indent=2), encoding="utf-8")
    audit_file.write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    return analysis_file, audit_file
