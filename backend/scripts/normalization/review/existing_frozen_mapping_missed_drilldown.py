from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .frozen_canonical_vocabulary import load_frozen_canonical_ids
from .unresolved_frozen_vocabulary_gap_analysis import (
    WAVE1_CLOSURE,
    WAVE2_CLOSURE,
    WAVE3_DEFINITION,
    build_accepted_corpus,
    classify_gap_record,
    decomposition_key,
    find_accepted_siblings,
    infer_frozen_token_candidates,
    normalize_source_term,
    procedure_family,
    select_frozen_vocabulary_gap_records,
)
from .unresolved_pool_analysis import (
    BATCH_RUN_ID,
    pool_content_hash,
    select_unresolved_candidates,
)
from .wave1_closure_audit import BATCH_LOCK_FILE, classify_source_term_pattern, validate_frozen_hashes
from .wave1_existing_canonical_mapping import load_review_index
from .wave3_new_canonical_knowledge import select_wave_candidates as select_wave3
from .unresolved_pool_analysis import (
    classify_terminology_problem,
    decomposition_evidence,
    has_meaningful_diagnostic_evidence,
    structural_source_only,
)

DRILLDOWN_FILENAME = "CG_EXISTING_FROZEN_MAPPING_MISSED_DRILLDOWN_v1.json"
DRILLDOWN_AUDIT_FILENAME = "CG_EXISTING_FROZEN_MAPPING_MISSED_DRILLDOWN_AUDIT_v1.json"
GAP_ANALYSIS_FILENAME = "CG_UNRESOLVED_FROZEN_VOCABULARY_GAP_ANALYSIS_v1.json"
EXPECTED_MISSED_COUNT = 374

MATCHING_FAILURE_MODES = frozenset(
    {
        "ALIAS_RECOGNITION_GAP",
        "DECOMPOSITION_RECOGNITION_GAP",
        "PROCEDURE_CONTEXT_GAP",
        "COMPONENT_CONTEXT_GAP",
        "PLATFORM_CONTEXT_GAP",
        "SOURCE_TERM_NOISE",
        "SIBLING_EQUIVALENCE_NOT_RECOGNIZED",
        "MULTIPLE_POSSIBLE_TARGETS",
        "INSUFFICIENT_EVIDENCE",
        "UNDETERMINED",
    },
)

BACKLOG_CATEGORIES = frozenset(
    {
        "MATCHER_IMPROVEMENT_CANDIDATE",
        "ALIAS_IMPROVEMENT_CANDIDATE",
        "DECOMPOSITION_IMPROVEMENT_CANDIDATE",
        "CONTEXTUAL_MATCHING_IMPROVEMENT_CANDIDATE",
        "HUMAN_REVIEW_REQUIRED",
        "NO_CHANGE_RECOMMENDED",
    },
)

FAILURE_TO_BACKLOG: dict[str, str] = {
    "ALIAS_RECOGNITION_GAP": "ALIAS_IMPROVEMENT_CANDIDATE",
    "DECOMPOSITION_RECOGNITION_GAP": "DECOMPOSITION_IMPROVEMENT_CANDIDATE",
    "PROCEDURE_CONTEXT_GAP": "CONTEXTUAL_MATCHING_IMPROVEMENT_CANDIDATE",
    "COMPONENT_CONTEXT_GAP": "CONTEXTUAL_MATCHING_IMPROVEMENT_CANDIDATE",
    "PLATFORM_CONTEXT_GAP": "CONTEXTUAL_MATCHING_IMPROVEMENT_CANDIDATE",
    "SOURCE_TERM_NOISE": "NO_CHANGE_RECOMMENDED",
    "SIBLING_EQUIVALENCE_NOT_RECOGNIZED": "HUMAN_REVIEW_REQUIRED",
    "MULTIPLE_POSSIBLE_TARGETS": "HUMAN_REVIEW_REQUIRED",
    "INSUFFICIENT_EVIDENCE": "HUMAN_REVIEW_REQUIRED",
    "UNDETERMINED": "HUMAN_REVIEW_REQUIRED",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def drilldown_path() -> Path:
    return CALIBRATION_DIR / DRILLDOWN_FILENAME


def drilldown_audit_path() -> Path:
    return CALIBRATION_DIR / DRILLDOWN_AUDIT_FILENAME


def infer_manufacturer(record: dict[str, Any]) -> str:
    manual_id = str(record.get("manualId") or "")
    platform_id = str((record.get("context") or {}).get("platformId") or "")
    token = manual_id.split("-")[0].lower()
    checks = [
        ("samsung", "Samsung"),
        ("lg", "LG"),
        ("whirlpool", "Whirlpool"),
        ("maytag", "Whirlpool"),
        ("ge", "GE"),
        ("insignia", "Insignia"),
        ("frigidaire", "Frigidaire"),
        ("midea", "Midea"),
        ("w1", "Whirlpool"),
        ("w8", "Whirlpool"),
        ("w9", "Whirlpool"),
        ("w11", "Whirlpool"),
    ]
    for prefix, name in checks:
        if token.startswith(prefix) or platform_id.startswith(prefix):
            return name
    if platform_id.startswith("whirlpool"):
        return "Whirlpool"
    return "Unknown"


def select_existing_frozen_mapping_missed_records(
    index: dict[str, Any],
    decisions_store: dict[str, Any],
    frozen_ids: frozenset[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    unresolved = select_unresolved_candidates(index)
    gap_records = select_frozen_vocabulary_gap_records(unresolved)
    accepted_corpus = build_accepted_corpus(index, decisions_store)
    missed_records: list[dict[str, Any]] = []
    missed_analyses: list[dict[str, Any]] = []
    for record in gap_records:
        analysis = classify_gap_record(record, accepted_corpus=accepted_corpus, frozen_ids=frozen_ids)
        if analysis["primaryAnalysisCategory"] != "EXISTING_FROZEN_MAPPING_MISSED":
            continue
        missed_records.append(record)
        missed_analyses.append(analysis)
    return missed_records, missed_analyses


def frozen_targets_from_siblings(
    siblings: list[dict[str, Any]],
    frozen_ids: frozenset[str],
) -> list[tuple[str, int]]:
    weights: Counter[str] = Counter()
    for sibling in siblings:
        canonical = str(sibling.get("proposedCanonicalId") or "")
        if canonical not in frozen_ids:
            continue
        weights[canonical] += int(sibling.get("siblingScore") or 1)
    return weights.most_common()


def pick_frozen_target(targets: list[tuple[str, int]]) -> str | None:
    if not targets:
        return None
    if len(targets) == 1:
        return targets[0][0]
    top_score = targets[0][1]
    tied = [canonical for canonical, score in targets if score == top_score]
    if len(tied) == 1:
        return tied[0]
    return None


def classify_matching_failure_mode(
    record: dict[str, Any],
    *,
    siblings: list[dict[str, Any]],
    frozen_target: str | None,
    target_ranking: list[tuple[str, int]],
    frozen_ids: frozenset[str],
) -> tuple[str, str, float]:
    """Returns (failure_mode, confidence, reason)."""
    what = record.get("what") or {}
    norm_term = normalize_source_term(what.get("sourceTerm"))
    decomp = decomposition_evidence(record)
    decomp_key = decomposition_key(decomp)
    inferred = infer_frozen_token_candidates(record, frozen_ids)
    meaningful = has_meaningful_diagnostic_evidence(record)
    structural = structural_source_only(record)

    frozen_siblings = [s for s in siblings if s.get("proposedCanonicalId") in frozen_ids]
    if not frozen_siblings:
        return (
            "INSUFFICIENT_EVIDENCE",
            "low",
            "No accepted sibling with a frozen canonical target despite EXISTING_FROZEN_MAPPING_MISSED label.",
        )

    distinct_targets = {str(s.get("proposedCanonicalId")) for s in frozen_siblings}
    if len(distinct_targets) > 1 and frozen_target is None:
        return (
            "MULTIPLE_POSSIBLE_TARGETS",
            "medium",
            f"Accepted siblings point to multiple frozen targets: {sorted(distinct_targets)[:5]}.",
        )

    if structural and not meaningful:
        return (
            "SOURCE_TERM_NOISE",
            "medium",
            "Structural or heading-like source term with weak diagnostic evidence despite sibling mapping.",
        )

    if frozen_target and frozen_target in inferred:
        return (
            "SIBLING_EQUIVALENCE_NOT_RECOGNIZED",
            "high",
            "Frozen token appears inferable from source/decomposition; sibling agreement suggests matcher "
            "did not apply equivalence rules.",
        )

    if classify_terminology_problem(record):
        return (
            "ALIAS_RECOGNITION_GAP",
            "high",
            "Terminology normalization issue; accepted sibling uses different surface form for same function.",
        )

    same_procedure = [
        s
        for s in frozen_siblings
        if s.get("manualId") == record.get("manualId")
        and s.get("procedureId") == what.get("procedureId")
    ]
    if same_procedure and norm_term != normalize_source_term(same_procedure[0].get("sourceTerm")):
        if decomp_key == decomposition_key(same_procedure[0].get("decomposition")):
            return (
                "ALIAS_RECOGNITION_GAP",
                "high",
                "Same manual/procedure/decomposition as accepted sibling but different source terminology.",
            )
        return (
            "DECOMPOSITION_RECOGNITION_GAP",
            "medium",
            "Same manual/procedure as sibling but decomposition alignment differs.",
        )

    if decomp_key == ("", "", "") and any(decomposition_key(s.get("decomposition")) != ("", "", "") for s in frozen_siblings):
        return (
            "DECOMPOSITION_RECOGNITION_GAP",
            "medium",
            "Unresolved record lacks decomposition evidence present on accepted siblings.",
        )

    if decomp_key != ("", "", "") and frozen_target and frozen_target not in inferred:
        return (
            "DECOMPOSITION_RECOGNITION_GAP",
            "medium",
            "Decomposition present but did not surface frozen canonical token match.",
        )

    if same_procedure:
        return (
            "PROCEDURE_CONTEXT_GAP",
            "medium",
            "Accepted mapping exists in same procedure; contextual matcher did not propagate mapping.",
        )

    same_platform = [s for s in frozen_siblings if s.get("platformId") == (record.get("context") or {}).get("platformId")]
    if same_platform and not same_procedure:
        return (
            "PLATFORM_CONTEXT_GAP",
            "medium",
            "Platform-aligned siblings map to frozen target; procedure or step context differs.",
        )

    if frozen_siblings:
        return (
            "COMPONENT_CONTEXT_GAP",
            "low",
            "Sibling evidence spans manuals/procedures; component or context binding may be incomplete.",
        )

    return ("UNDETERMINED", "low", "Evidence insufficient to classify matcher failure mode reliably.")


def sibling_evidence_summary(siblings: list[dict[str, Any]], frozen_ids: frozenset[str]) -> list[dict[str, Any]]:
    out = []
    for sibling in siblings[:8]:
        canonical = sibling.get("proposedCanonicalId")
        if canonical not in frozen_ids:
            continue
        out.append(
            {
                "candidateId": sibling.get("candidateId"),
                "manualId": sibling.get("manualId"),
                "procedureId": sibling.get("procedureId"),
                "sourceTerm": sibling.get("sourceTerm"),
                "normalizedSourceTerm": sibling.get("normalizedSourceTerm"),
                "proposedCanonicalId": canonical,
                "siblingScore": sibling.get("siblingScore"),
                "platformId": sibling.get("platformId"),
            },
        )
    return out


def analyze_missed_record(
    record: dict[str, Any],
    *,
    accepted_corpus: list[dict[str, Any]],
    frozen_ids: frozenset[str],
) -> dict[str, Any]:
    what = record.get("what") or {}
    context = record.get("context") or {}
    siblings = find_accepted_siblings(record, accepted_corpus)
    target_ranking = frozen_targets_from_siblings(siblings, frozen_ids)
    frozen_target = pick_frozen_target(target_ranking)
    failure_mode, confidence, failure_reason = classify_matching_failure_mode(
        record,
        siblings=siblings,
        frozen_target=frozen_target,
        target_ranking=target_ranking,
        frozen_ids=frozen_ids,
    )
    sibling_summary = sibling_evidence_summary(siblings, frozen_ids)
    norm_term = normalize_source_term(what.get("sourceTerm"))
    backlog_category = FAILURE_TO_BACKLOG.get(failure_mode, "HUMAN_REVIEW_REQUIRED")

    return {
        "candidateId": record.get("candidateId"),
        "frozenTarget": {
            "frozenCanonicalId": frozen_target,
            "targetRanking": [{"frozenCanonicalId": c, "weight": w} for c, w in target_ranking[:6]],
            "anchoredToExistingFrozenOntology": bool(frozen_target),
        },
        "siblingEvidence": sibling_summary,
        "sourceTermCluster": {
            "sourceTerm": what.get("sourceTerm"),
            "normalizedSourceTerm": norm_term,
            "sourceTermPattern": classify_source_term_pattern(what.get("sourceTerm")),
        },
        "procedureFamily": procedure_family(what.get("procedureId")),
        "procedureId": what.get("procedureId"),
        "manufacturer": infer_manufacturer(record),
        "platformId": context.get("platformId"),
        "manualId": record.get("manualId"),
        "matchingFailureMode": failure_mode,
        "failureConfidence": confidence,
        "failureReason": failure_reason,
        "backlogCategory": backlog_category,
        "decomposition": decomposition_evidence(record),
        "inferredFrozenTokenCandidates": sorted(infer_frozen_token_candidates(record, frozen_ids)),
        "matcherBehaviorObserved": {
            "proposedCanonicalIdNull": True,
            "inferredFrozenMatch": bool(infer_frozen_token_candidates(record, frozen_ids) & frozen_ids),
            "acceptedSiblingCount": len(sibling_summary),
        },
    }


def _terminology_cluster_key(normalized_term: str) -> str:
    if not normalized_term:
        return "__empty__"
    tokens = normalized_term.split()
    if len(tokens) <= 3:
        return normalized_term
    return " ".join(tokens[:3])


def build_grouped_clusters(record_analyses: list[dict[str, Any]]) -> dict[str, Any]:
    by_target: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_term: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_procedure_family: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_manufacturer: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_platform: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_failure: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_sibling_pattern: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for item in record_analyses:
        target = item["frozenTarget"]["frozenCanonicalId"] or "__unresolved_target__"
        by_target[target].append(item)
        term_key = _terminology_cluster_key(item["sourceTermCluster"]["normalizedSourceTerm"])
        by_term[term_key].append(item)
        by_procedure_family[item["procedureFamily"]].append(item)
        by_manufacturer[item["manufacturer"]].append(item)
        by_platform[str(item.get("platformId") or "__none__")].append(item)
        by_failure[item["matchingFailureMode"]].append(item)
        sibling_ids = tuple(sorted(s.get("proposedCanonicalId") or "" for s in item["siblingEvidence"]))
        by_sibling_pattern[str(sibling_ids)].append(item)

    def summarize_group(name: str, groups: dict[str, list[dict[str, Any]]], limit: int = 40) -> list[dict[str, Any]]:
        rows = []
        for key, items in sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:limit]:
            manuals = {str(i.get("manualId") or "") for i in items}
            platforms = {str(i.get("platformId") or "") for i in items if i.get("platformId")}
            manufacturers = {str(i.get("manufacturer") or "") for i in items}
            rows.append(
                {
                    "groupKey": key,
                    "count": len(items),
                    "manualCount": len(manuals),
                    "platformCount": len(platforms),
                    "manufacturerCount": len(manufacturers),
                    "crossManufacturer": len(manufacturers) > 1,
                    "crossPlatform": len(platforms) > 1,
                    "exampleCandidateIds": [i["candidateId"] for i in items[:8]],
                    "provenance": {"candidateIds": [str(i["candidateId"]) for i in items]},
                },
            )
        return {"groupName": name, "groups": rows}

    return {
        "byFrozenCanonicalTarget": summarize_group("frozenCanonicalTarget", by_target, 50),
        "bySourceTerminology": summarize_group("sourceTerminology", by_term, 50),
        "byProcedureFamily": summarize_group("procedureFamily", by_procedure_family, 40),
        "byManufacturer": summarize_group("manufacturer", by_manufacturer, 20),
        "byPlatform": summarize_group("platform", by_platform, 40),
        "byMatchingFailureMode": summarize_group("matchingFailureMode", by_failure, 15),
        "bySiblingEvidencePattern": summarize_group("siblingEvidencePattern", by_sibling_pattern, 30),
    }


def build_backlog_items(record_analyses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Smallest safe backlog: cluster by frozen target + failure mode + terminology stem."""
    clusters: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for item in record_analyses:
        target = item["frozenTarget"]["frozenCanonicalId"] or "__no_single_target__"
        failure = item["matchingFailureMode"]
        term = _terminology_cluster_key(item["sourceTermCluster"]["normalizedSourceTerm"])
        clusters[(target, failure, term)].append(item)

    backlog: list[dict[str, Any]] = []
    for (target, failure, term), items in sorted(clusters.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        if target == "__no_single_target__" and failure not in {
            "MULTIPLE_POSSIBLE_TARGETS",
            "HUMAN_REVIEW_REQUIRED",
        }:
            category = "HUMAN_REVIEW_REQUIRED"
        else:
            category = FAILURE_TO_BACKLOG.get(failure, "HUMAN_REVIEW_REQUIRED")

        manuals = {str(i.get("manualId") or "") for i in items}
        platforms = {str(i.get("platformId") or "") for i in items if i.get("platformId")}
        manufacturers = {str(i.get("manufacturer") or "") for i in items}
        source_examples = list(
            dict.fromkeys(
                str(i["sourceTermCluster"].get("sourceTerm") or "") for i in items[:12] if i["sourceTermCluster"].get("sourceTerm")
            ),
        )[:8]
        sibling_examples = []
        for i in items[:5]:
            for s in i.get("siblingEvidence") or []:
                sibling_examples.append(
                    {
                        "candidateId": s.get("candidateId"),
                        "sourceTerm": s.get("sourceTerm"),
                        "proposedCanonicalId": s.get("proposedCanonicalId"),
                    },
                )
        sibling_examples = sibling_examples[:10]

        confidences = [i.get("failureConfidence") for i in items]
        confidence = "high" if confidences.count("high") > len(items) / 2 else (
            "medium" if confidences.count("low") < len(items) / 2 else "low"
        )

        cluster_key = f"{target}|{failure}|{term}"
        backlog_id = "efmm-" + hashlib.sha256(cluster_key.encode("utf-8")).hexdigest()[:12]

        proposed_improvement = {
            "ALIAS_IMPROVEMENT_CANDIDATE": "Review alias coverage for source terms vs frozen canonical (no auto-alias).",
            "DECOMPOSITION_IMPROVEMENT_CANDIDATE": "Review decomposition/parser exposure of canonical function (no auto-change).",
            "CONTEXTUAL_MATCHING_IMPROVEMENT_CANDIDATE": "Review procedure/platform context propagation in matcher (no auto-change).",
            "MATCHER_IMPROVEMENT_CANDIDATE": "Review matcher equivalence rules (no auto-change).",
            "HUMAN_REVIEW_REQUIRED": "Human review before any matcher or alias change.",
            "NO_CHANGE_RECOMMENDED": "Likely source noise; do not change matcher based on this cluster alone.",
        }.get(category, "Governance review only.")

        backlog.append(
            {
                "backlogId": backlog_id,
                "category": category,
                "frozenCanonicalId": target if target != "__no_single_target__" else None,
                "affectedRecordCount": len(items),
                "affectedManualCount": len(manuals),
                "affectedPlatformCount": len(platforms),
                "affectedManufacturerCount": len(manufacturers),
                "crossManufacturer": len(manufacturers) > 1,
                "isolatedToSinglePlatform": len(platforms) <= 1,
                "terminologyClusterKey": term,
                "terminologySourceExamples": source_examples,
                "acceptedSiblingEvidenceExamples": sibling_examples,
                "observedFailureMode": failure,
                "confidence": confidence,
                "reason": items[0].get("failureReason"),
                "proposedMatcherOrAliasImprovement": proposed_improvement,
                "provenanceRecordIds": [str(i["candidateId"]) for i in items],
                "implementationAuthorized": False,
            },
        )

    return backlog


def build_executive_answers(
    record_analyses: list[dict[str, Any]],
    backlog: list[dict[str, Any]],
    grouped: dict[str, Any],
) -> dict[str, Any]:
    failure_counts = Counter(i["matchingFailureMode"] for i in record_analyses)
    target_counts = Counter(
        i["frozenTarget"]["frozenCanonicalId"] for i in record_analyses if i["frozenTarget"]["frozenCanonicalId"]
    )
    alias_failures = failure_counts.get("ALIAS_RECOGNITION_GAP", 0)
    decomp_failures = failure_counts.get("DECOMPOSITION_RECOGNITION_GAP", 0)
    context_failures = (
        failure_counts.get("PROCEDURE_CONTEXT_GAP", 0)
        + failure_counts.get("COMPONENT_CONTEXT_GAP", 0)
        + failure_counts.get("PLATFORM_CONTEXT_GAP", 0)
    )
    noise = failure_counts.get("SOURCE_TERM_NOISE", 0)

    cross_mfg_backlog = [b for b in backlog if b.get("crossManufacturer") and b["affectedRecordCount"] >= 3]
    isolated_backlog = [b for b in backlog if b.get("isolatedToSinglePlatform") and b["affectedRecordCount"] >= 3]
    safe_backlog = [
        b
        for b in backlog
        if b["category"] in {
            "ALIAS_IMPROVEMENT_CANDIDATE",
            "DECOMPOSITION_IMPROVEMENT_CANDIDATE",
            "CONTEXTUAL_MATCHING_IMPROVEMENT_CANDIDATE",
        }
        and b.get("confidence") in {"high", "medium"}
        and b["affectedRecordCount"] >= 2
        and b.get("frozenCanonicalId")
    ]
    safe_backlog.sort(key=lambda b: (-b["affectedRecordCount"], b["backlogId"]))

    term_groups = grouped["bySourceTerminology"]["groups"]
    recurring_terms = [g for g in term_groups if g["count"] >= 3][:25]

    return {
        "topRecurringFrozenCanonicalTargets": target_counts.most_common(25),
        "recurringTerminologyVariantsFailingToMap": recurring_terms,
        "clearlyAliasRelatedFailureCount": alias_failures,
        "clearlyDecompositionRelatedFailureCount": decomp_failures,
        "procedureOrContextAwarenessFailureCount": context_failures,
        "manufacturerOrPlatformSpecificFailureCount": failure_counts.get("PLATFORM_CONTEXT_GAP", 0),
        "likelySourceTermNoiseDespiteSiblingEvidenceCount": noise,
        "crossManufacturerClustersBacklogCount": len(cross_mfg_backlog),
        "isolatedSinglePlatformClustersBacklogCount": len(isolated_backlog),
        "smallestSafeMatcherAliasBacklog": safe_backlog[:40],
        "smallestSafeBacklogItemCount": len(safe_backlog),
    }


def run_integrity_checks(
    index: dict[str, Any],
    unresolved: list[dict[str, Any]],
    gap_count: int,
    analyzed_count: int,
    decisions_before: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    index_after = load_review_index()
    unresolved_after = select_unresolved_candidates(index_after)
    decisions_after = load_decisions()

    if analyzed_count != EXPECTED_MISSED_COUNT:
        errors.append(f"analyzed count {analyzed_count} != {EXPECTED_MISSED_COUNT}")

    if len(unresolved) != 1100:
        errors.append(f"unresolved count {len(unresolved)} != 1100")
    if len(unresolved_after) != len(unresolved):
        errors.append("unresolved count changed during drilldown")
    if pool_content_hash(unresolved) != pool_content_hash(unresolved_after):
        errors.append("unresolved pool content hash changed during drilldown")

    gap_after = select_frozen_vocabulary_gap_records(unresolved_after)
    if gap_count != 1078:
        errors.append(f"gap count {gap_count} != 1078")
    if len(gap_after) != gap_count:
        errors.append("canonicalMapping gap count changed during drilldown")

    before_map = decisions_before.get("decisions") or {}
    after_map = decisions_after.get("decisions") or {}
    if len(before_map) != 796:
        errors.append(f"decision count {len(before_map)} != 796")
    if before_map != after_map:
        errors.append("review decisions changed during drilldown")

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

    gap_analysis_path = CALIBRATION_DIR / GAP_ANALYSIS_FILENAME
    if gap_analysis_path.is_file():
        gap_json = json.loads(gap_analysis_path.read_text(encoding="utf-8"))
        expected_missed = int(gap_json.get("existingFrozenMappingMissedCount") or -1)
        if expected_missed != EXPECTED_MISSED_COUNT:
            errors.append("gap analysis existingFrozenMappingMissedCount mismatch")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "analyzedExistingFrozenMappingMissedCount": analyzed_count,
        "unresolvedCount": len(unresolved),
        "canonicalMappingGapCount": gap_count,
        "unresolvedPoolContentHash": pool_content_hash(unresolved),
        "reviewDecisionCount": len(before_map),
        "frozenCanonicalHashesValid": hashes_ok,
        "wave1ClosureIntact": wave1.get("status") == "WAVE1_CLOSED",
        "wave2ClosureIntact": wave2.get("status") == "WAVE2_CLOSED",
        "wave3Empty": len(select_wave3(index_after)) == 0,
        "aliasesAdded": False,
        "matcherChanged": False,
        "batchAuthorizationChanged": False,
        "candidateMutationDetected": pool_content_hash(unresolved) != pool_content_hash(unresolved_after),
        "canonicalMutationDetected": not hashes_ok,
    }


def run_existing_frozen_mapping_missed_drilldown() -> dict[str, Any]:
    index = load_review_index()
    decisions_store = load_decisions()
    frozen_ids = load_frozen_canonical_ids()
    unresolved = select_unresolved_candidates(index)
    gap_records = select_frozen_vocabulary_gap_records(unresolved)
    accepted_corpus = build_accepted_corpus(index, decisions_store)

    missed_records, _ = select_existing_frozen_mapping_missed_records(index, decisions_store, frozen_ids)
    record_analyses = [
        analyze_missed_record(record, accepted_corpus=accepted_corpus, frozen_ids=frozen_ids)
        for record in missed_records
    ]

    grouped = build_grouped_clusters(record_analyses)
    backlog = build_backlog_items(record_analyses)
    executive = build_executive_answers(record_analyses, backlog, grouped)

    failure_mode_counts = dict(Counter(i["matchingFailureMode"] for i in record_analyses))
    backlog_category_counts = dict(Counter(i["category"] for i in backlog))

    generated_at = _utc_now()
    integrity = run_integrity_checks(
        index,
        unresolved,
        len(gap_records),
        len(record_analyses),
        decisions_store,
    )

    drilldown = {
        "schemaVersion": 1,
        "reportType": "cg_existing_frozen_mapping_missed_drilldown",
        "status": "READ_ONLY_FROZEN_MAPPING_MISSED_DRILLDOWN_COMPLETE",
        "generatedAt": generated_at,
        "batchRunId": BATCH_RUN_ID,
        "sourceGapAnalysis": GAP_ANALYSIS_FILENAME,
        "analyzedRecordCount": len(record_analyses),
        "expectedAnalyzedRecordCount": EXPECTED_MISSED_COUNT,
        "matchingFailureModeCounts": failure_mode_counts,
        "backlogCategoryCounts": backlog_category_counts,
        "backlogItemCount": len(backlog),
        "executiveAnswers": executive,
        "groupedClusters": grouped,
        "matcherImprovementBacklog": backlog,
        "recordAnalyses": record_analyses,
        "mutationPolicy": {
            "readOnly": True,
            "matcherChanged": False,
            "aliasesAdded": False,
            "implementationCodeWritten": False,
            "newCanonicalFunctionsInferred": False,
        },
        "governanceNote": (
            "Backlog labels are governance-only. Accepted sibling evidence does not automatically authorize "
            "matcher or alias changes. Every cluster remains anchored to an existing frozen canonical target "
            "when a single target is supported."
        ),
    }

    audit = {
        "schemaVersion": 1,
        "reportType": "cg_existing_frozen_mapping_missed_drilldown_audit",
        "status": (
            "READ_ONLY_FROZEN_MAPPING_MISSED_DRILLDOWN_COMPLETE"
            if integrity["passed"]
            else "DRILLDOWN_BLOCKED"
        ),
        "generatedAt": generated_at,
        "drilldownArtifact": DRILLDOWN_FILENAME,
        "integrityChecks": integrity,
        "errors": integrity["errors"],
    }

    return {"drilldown": drilldown, "audit": audit}


def write_existing_frozen_mapping_missed_drilldown(payload: dict[str, Any]) -> tuple[Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    out = drilldown_path()
    audit_out = drilldown_audit_path()
    out.write_text(json.dumps(payload["drilldown"], indent=2), encoding="utf-8")
    audit_out.write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    return out, audit_out
