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
from .wave1_closure_audit import BATCH_LOCK_FILE, INDEX_MANIFEST_HASH, classify_source_term_pattern
from .wave1_existing_canonical_mapping import load_review_index, validate_frozen_hashes
from .wave3_new_canonical_knowledge import REVIEW_CLASS as WAVE3_REVIEW_CLASS, select_wave_candidates as select_wave3

ANALYSIS_FILENAME = "CG_UNRESOLVED_POOL_ANALYSIS_v1.json"
AUDIT_FILENAME = "CG_UNRESOLVED_POOL_ANALYSIS_AUDIT_v1.json"
BATCH_RUN_ID = "batch-20260918-5d213986"
REVIEW_CLASS = "unresolved"
WAVE1_CLOSURE = REVIEW_DIR / "waves" / "CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_AUDIT_v1.json"
WAVE2_CLOSURE = REVIEW_DIR / "waves" / "CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_CLOSURE_AUDIT_v1.json"
WAVE3_DEFINITION = REVIEW_DIR / "waves" / "CG_WAVE3_NEW_CANONICAL_KNOWLEDGE_REVIEW_v1.json"

GOVERNANCE_LABELS = frozenset(
    {
        "legitimate_unresolved_platform_knowledge",
        "possible_extraction_noise",
        "possible_terminology_alias_problem",
        "possible_implementation_specific",
        "possible_architecture_discovery_candidate",
        "possible_frozen_vocabulary_gap",
        "possible_architecture_exception",
        "unresolved_insufficient_evidence",
    },
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def analysis_path() -> Path:
    return CALIBRATION_DIR / ANALYSIS_FILENAME


def audit_path() -> Path:
    return CALIBRATION_DIR / AUDIT_FILENAME


def select_unresolved_candidates(index: dict[str, Any]) -> list[dict[str, Any]]:
    records = [
        record
        for record in (index.get("candidateRecords") or [])
        if record.get("reviewClass") == REVIEW_CLASS
    ]
    return sorted(
        records,
        key=lambda record: (
            str(record.get("manualId") or ""),
            str((record.get("what") or {}).get("procedureId") or ""),
            str(record.get("candidateId") or ""),
        ),
    )


def pool_content_hash(records: list[dict[str, Any]]) -> str:
    payload = json.dumps(records, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def matcher_layers(record: dict[str, Any]) -> list[str]:
    layers: list[str] = []
    for source in (record.get("where") or {}).get("provenanceSources") or []:
        if source.get("type") == "matcher" and source.get("layer"):
            layers.append(str(source["layer"]))
    return layers


def has_measurement_provenance(record: dict[str, Any]) -> bool:
    for source in (record.get("where") or {}).get("provenanceSources") or []:
        if source.get("type") == "measurement":
            return True
    return False


def decomposition_evidence(record: dict[str, Any]) -> dict[str, Any] | None:
    why = record.get("why") or {}
    decomposition = why.get("decomposition")
    if isinstance(decomposition, dict) and any(decomposition.values()):
        return decomposition
    for source in (record.get("where") or {}).get("provenanceSources") or []:
        if isinstance(source.get("decomposition"), dict) and any(source["decomposition"].values()):
            return source["decomposition"]
    return None


def has_meaningful_diagnostic_evidence(record: dict[str, Any]) -> bool:
    if has_measurement_provenance(record):
        return True
    decomposition = decomposition_evidence(record)
    if decomposition and any(decomposition.get(key) for key in ("domain", "component", "actuator")):
        return True
    why = record.get("why") or {}
    if why.get("matchedPhrase"):
        return True
    if (record.get("mapsTo") or {}).get("proposedCanonicalId"):
        return True
    return False


def structural_source_only(record: dict[str, Any]) -> bool:
    term = (record.get("what") or {}).get("sourceTerm")
    pattern = classify_source_term_pattern(term)
    if pattern in {"oem_test_heading", "manual_section_heading", "connector_identifier"}:
        return not has_meaningful_diagnostic_evidence(record)
    return False


def classify_terminology_problem(record: dict[str, Any]) -> bool:
    term = str((record.get("what") or {}).get("sourceTerm") or "")
    if term == "supply":
        return True
    if re.match(r"^[a-z]+_[a-z0-9_]+$", term) and (record.get("mapsTo") or {}).get("mappingType") == "compound_alias":
        return True
    return False


def assign_governance_hints(record: dict[str, Any]) -> list[str]:
    hints: list[str] = []
    maps_to = record.get("mapsTo") or {}
    blockers = record.get("blockers") or {}
    context = record.get("context") or {}
    why = record.get("why") or {}
    proposed = maps_to.get("proposedCanonicalId")

    if structural_source_only(record):
        hints.append("possible_extraction_noise")

    if not proposed and maps_to.get("candidateType") == "canonicalMapping":
        hints.append("possible_frozen_vocabulary_gap")

    if why.get("candidateStatus") == "UNRESOLVED_TERM" and not proposed:
        hints.append("unresolved_insufficient_evidence")

    if classify_terminology_problem(record):
        hints.append("possible_terminology_alias_problem")

    blocked = blockers.get("blockedReason")
    if blocked == "CROSS_APPLIANCE_TERM" or context.get("architectureException"):
        hints.append("possible_architecture_exception")
    elif blocked == "AMBIGUOUS_COMPONENT":
        hints.append("possible_architecture_discovery_candidate")

    layers = matcher_layers(record)
    if any("compound" in layer for layer in layers) or maps_to.get("mappingType") == "compound_alias":
        if not proposed:
            hints.append("possible_implementation_specific")

    if (
        has_meaningful_diagnostic_evidence(record)
        and not structural_source_only(record)
        and proposed is None
        and blocked not in ("CROSS_APPLIANCE_TERM",)
    ):
        hints.append("legitimate_unresolved_platform_knowledge")

    if not hints:
        hints.append("unresolved_insufficient_evidence")

    return sorted(set(hints))


def summarize_unresolved_record(record: dict[str, Any]) -> dict[str, Any]:
    what = record.get("what") or {}
    maps_to = record.get("mapsTo") or {}
    return {
        "candidateId": record.get("candidateId"),
        "manualId": record.get("manualId"),
        "procedureId": what.get("procedureId"),
        "sourceTerm": what.get("sourceTerm"),
        "proposedCanonicalId": maps_to.get("proposedCanonicalId"),
        "candidateType": maps_to.get("candidateType"),
        "mappingType": maps_to.get("mappingType"),
        "platformId": (record.get("context") or {}).get("platformId"),
        "blockedReason": (record.get("blockers") or {}).get("blockedReason"),
        "candidateStatus": (record.get("why") or {}).get("candidateStatus"),
        "governanceHints": assign_governance_hints(record),
        "sourceTermPattern": classify_source_term_pattern(what.get("sourceTerm")),
        "matcherLayers": matcher_layers(record),
        "hasMeaningfulDiagnosticEvidence": has_meaningful_diagnostic_evidence(record),
        "structuralSourceOnly": structural_source_only(record),
    }


def build_pattern_group(
    pattern_id: str,
    records: list[dict[str, Any]],
    *,
    evidence: str,
    recommended_future_action: str,
) -> dict[str, Any]:
    summaries = [summarize_unresolved_record(record) for record in records]
    hint_counts = Counter()
    for summary in summaries:
        for hint in summary["governanceHints"]:
            hint_counts[hint] += 1
    manuals = sorted({str(record.get("manualId") or "") for record in records})
    platforms = sorted(
        {
            str((record.get("context") or {}).get("platformId") or "")
            for record in records
            if (record.get("context") or {}).get("platformId")
        },
    )
    return {
        "patternId": pattern_id,
        "count": len(records),
        "manualCount": len(manuals),
        "platformCount": len(platforms),
        "manualIds": manuals[:50],
        "platformIds": platforms[:50],
        "governanceHintCounts": dict(hint_counts),
        "exampleCandidateIds": [record["candidateId"] for record in summaries[:12]],
        "examples": summaries[:8],
        "provenance": {
            "candidateIds": [str(record.get("candidateId") or "") for record in records],
        },
        "evidence": evidence,
        "recommendedFutureAction": recommended_future_action,
    }


def analyze_repeated_patterns(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        what = record.get("what") or {}
        blockers = record.get("blockers") or {}
        maps_to = record.get("mapsTo") or {}
        pattern_key = "|".join(
            [
                classify_source_term_pattern(what.get("sourceTerm")),
                str(blockers.get("blockedReason") or "none"),
                str(maps_to.get("candidateType") or "none"),
                str(maps_to.get("proposedCanonicalId") or "none"),
            ],
        )
        groups[pattern_key].append(record)

    findings = []
    for pattern_key, group_records in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])):
        parts = pattern_key.split("|")
        findings.append(
            build_pattern_group(
                pattern_key,
                group_records,
                evidence=(
                    f"sourceTermPattern={parts[0]}, blockedReason={parts[1]}, "
                    f"candidateType={parts[2]}, proposedCanonicalId={parts[3]}"
                ),
                recommended_future_action="governance_review_only_no_auto_reclassification",
            ),
        )
    return findings


def verify_wave_closures() -> dict[str, Any]:
    errors: list[str] = []
    wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
    wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
    if wave1.get("status") != "WAVE1_CLOSED":
        errors.append("wave1 not closed")
    if wave2.get("status") != "WAVE2_CLOSED":
        errors.append("wave2 not closed")
    wave3_def = json.loads(WAVE3_DEFINITION.read_text(encoding="utf-8")) if WAVE3_DEFINITION.is_file() else {}
    wave3_expected = wave3_def.get("expectedCandidateCount")
    if wave3_expected is None or int(wave3_expected) != 0:
        errors.append("wave3 expected count is not zero")
    return {"passed": len(errors) == 0, "errors": errors}


def run_integrity_checks(
    index_before: dict[str, Any],
    unresolved_before: list[dict[str, Any]],
    decisions_before: dict[str, Any],
    *,
    index_after: dict[str, Any],
    unresolved_after: list[dict[str, Any]],
    decisions_after: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    if index_before.get("processingManifestHash") != INDEX_MANIFEST_HASH:
        errors.append("index manifest hash baseline mismatch")
    if index_after.get("processingManifestHash") != index_before.get("processingManifestHash"):
        errors.append("index processingManifestHash changed during analysis")

    if len(unresolved_before) != len(unresolved_after):
        errors.append("unresolved pool count changed during analysis")
    if pool_content_hash(unresolved_before) != pool_content_hash(unresolved_after):
        errors.append("unresolved pool content hash changed during analysis")

    before_decisions = decisions_before.get("decisions") or {}
    after_decisions = decisions_after.get("decisions") or {}
    if len(before_decisions) != len(after_decisions):
        errors.append("review decision count changed during analysis")
    if before_decisions != after_decisions:
        errors.append("review decisions content changed during analysis")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    wave_checks = verify_wave_closures()
    if not wave_checks["passed"]:
        errors.extend(wave_checks["errors"])

    wave3_pool = select_wave3(index_after)
    if len(wave3_pool) != 0:
        errors.append("wave3 pool is not empty")

    lock_path = CALIBRATION_DIR / BATCH_LOCK_FILE
    batch_ok = lock_path.is_file()
    if not batch_ok:
        errors.append("batch lock missing")

    wave1_status = (
        json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")).get("status")
        if WAVE1_CLOSURE.is_file()
        else None
    )
    wave2_status = (
        json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")).get("status")
        if WAVE2_CLOSURE.is_file()
        else None
    )

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "unresolvedCountBefore": len(unresolved_before),
        "unresolvedCountAfter": len(unresolved_after),
        "unresolvedPoolContentHash": pool_content_hash(unresolved_before),
        "reviewDecisionCount": len(before_decisions),
        "frozenCanonicalHashesValid": hashes_ok,
        "wave1ClosureIntact": wave1_status == "WAVE1_CLOSED",
        "wave2ClosureIntact": wave2_status == "WAVE2_CLOSED",
        "wave3Empty": len(wave3_pool) == 0,
        "canonicalMutationDetected": not hashes_ok,
        "candidateMutationDetected": pool_content_hash(unresolved_before) != pool_content_hash(unresolved_after),
        "promotionPerformed": False,
        "batchAuthorizationChanged": not batch_ok,
    }


def run_unresolved_pool_analysis() -> dict[str, Any]:
    index = load_review_index()
    if str(index.get("batchRunId") or "") != BATCH_RUN_ID:
        raise ValueError(f"expected batchRunId {BATCH_RUN_ID}, found {index.get('batchRunId')}")

    unresolved = select_unresolved_candidates(index)
    inventory_count = int((index.get("countsByReviewClass") or {}).get(REVIEW_CLASS) or 0)
    if inventory_count != len(unresolved):
        raise ValueError(
            f"countsByReviewClass unresolved={inventory_count} != records={len(unresolved)}",
        )

    decisions_store = load_decisions()
    summaries = [summarize_unresolved_record(record) for record in unresolved]

    hint_counter = Counter()
    for summary in summaries:
        for hint in summary["governanceHints"]:
            hint_counter[hint] += 1

    proposed_counts = Counter(
        str((record.get("mapsTo") or {}).get("proposedCanonicalId") or "__none__")
        for record in unresolved
    )
    type_counts = Counter(
        str((record.get("mapsTo") or {}).get("candidateType") or "__none__")
        for record in unresolved
    )
    blocked_counts = Counter(
        str((record.get("blockers") or {}).get("blockedReason") or "__none__")
        for record in unresolved
    )
    source_pattern_counts = Counter(summary["sourceTermPattern"] for summary in summaries)
    manual_counts = Counter(str(record.get("manualId") or "") for record in unresolved)
    platform_counts = Counter(
        str((record.get("context") or {}).get("platformId") or "__none__")
        for record in unresolved
    )

    meaningful = sum(1 for summary in summaries if summary["hasMeaningfulDiagnosticEvidence"])
    structural_only = sum(1 for summary in summaries if summary["structuralSourceOnly"])

    repeated_patterns = analyze_repeated_patterns(unresolved)
    top_patterns = repeated_patterns[:25]

    future_human_review = [
        group
        for group in repeated_patterns
        if group["governanceHintCounts"].get("legitimate_unresolved_platform_knowledge", 0) > 0
        or group["governanceHintCounts"].get("possible_frozen_vocabulary_gap", 0) > 0
    ][:20]

    future_architecture_discovery = [
        group
        for group in repeated_patterns
        if group["governanceHintCounts"].get("possible_architecture_discovery_candidate", 0) > 0
        or group["governanceHintCounts"].get("possible_architecture_exception", 0) > 0
    ][:20]

    index_after = load_review_index()
    unresolved_after = select_unresolved_candidates(index_after)
    decisions_after = load_decisions()
    integrity = run_integrity_checks(
        index,
        unresolved,
        decisions_store,
        index_after=index_after,
        unresolved_after=unresolved_after,
        decisions_after=decisions_after,
    )

    generated_at = _utc_now()
    analysis = {
        "schemaVersion": 1,
        "reportType": "cg_unresolved_pool_analysis",
        "status": "READ_ONLY_ANALYSIS_COMPLETE",
        "generatedAt": generated_at,
        "batchRunId": BATCH_RUN_ID,
        "reviewClass": REVIEW_CLASS,
        "sourceIndex": "normalization/review/CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_INDEX_v1.json",
        "totalUnresolvedCount": len(unresolved),
        "inventoryReviewClassCount": inventory_count,
        "manualCount": len(manual_counts),
        "platformIdCount": sum(1 for key in platform_counts if key != "__none__"),
        "countsByProposedCanonicalId": dict(proposed_counts.most_common()),
        "countsByCandidateType": dict(type_counts),
        "countsByBlockedReason": dict(blocked_counts),
        "countsBySourceTermPattern": dict(source_pattern_counts),
        "countsByManualId": dict(manual_counts.most_common(50)),
        "countsByPlatformId": dict(platform_counts.most_common(50)),
        "countsByGovernanceHint": dict(hint_counter),
        "meaningfulDiagnosticEvidenceCount": meaningful,
        "structuralSourceOnlyCount": structural_only,
        "topRepeatedPatterns": top_patterns,
        "candidateGroupsPotentiallyWorthFutureHumanReview": future_human_review,
        "candidateGroupsPotentiallyWorthFutureArchitectureDiscovery": future_architecture_discovery,
        "mutationPolicy": {
            "readOnly": True,
            "reclassifiedCandidates": False,
            "promotionPerformed": False,
            "canonicalGraphsMutated": False,
            "candidateArtifactsMutated": False,
            "reviewDecisionsMutated": False,
            "normalizationPipelineMutated": False,
        },
        "interpretationNote": (
            "Governance-only inventory of unresolved candidates. Labels describe possible future "
            "actions; no reclassification, promotion, or pipeline mutation was performed."
        ),
    }

    audit = {
        "schemaVersion": 1,
        "reportType": "cg_unresolved_pool_analysis_audit",
        "status": "READ_ONLY_ANALYSIS_COMPLETE" if integrity["passed"] else "ANALYSIS_BLOCKED",
        "generatedAt": generated_at,
        "analysisArtifact": ANALYSIS_FILENAME,
        "integrityChecks": integrity,
        "errors": integrity["errors"],
    }

    return {"analysis": analysis, "audit": audit}


def write_unresolved_pool_analysis(payload: dict[str, Any]) -> tuple[Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    analysis_file = analysis_path()
    audit_file = audit_path()
    analysis_file.write_text(json.dumps(payload["analysis"], indent=2), encoding="utf-8")
    audit_file.write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    return analysis_file, audit_file
