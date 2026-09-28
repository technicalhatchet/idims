from __future__ import annotations

import copy
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, CANONICAL_DIR, CANDIDATES_DIR, REVIEW_DIR
from .candidate_review_decisions import decisions_path, load_decisions
from .candidate_review_index import (
    COLLISION_MANUALS,
    DEFAULT_BATCH_RUN_ID,
    DEFAULT_PROCESSING_MANIFEST_HASH,
    build_candidate_review_index,
    index_path,
    write_candidate_review_index,
)
from .candidate_review_index_refresh import (
    _build_fresh_index,
    _candidate_artifact_hashes,
    _canonical_graph_hashes,
    _diff_index_records,
    _duplicate_candidate_ids,
    _hash_bytes,
    _read_json,
    _record_fingerprint,
    _records_by_id,
    _semantic_index_fingerprint,
    _sha256_file,
    _source_candidate_population,
    _stable_index_view,
)
from .candidate_review_preflight import run_preflight
from .matcher_improvement_delta_reconciliation_final import manifest_path
from .matcher_improvement_production_reconciliation import (
    _keep_baseline_records,
    changeset_path as reconciliation_changeset_path,
    reconciliation_audit_path,
    reconciliation_path,
)
from .matcher_improvement_scoped_validation import _production_integrity_snapshot
from .unresolved_frozen_vocabulary_gap_analysis import WAVE1_CLOSURE, WAVE2_CLOSURE
from .wave1_closure_audit import validate_frozen_hashes
from .wave1_existing_canonical_mapping import select_wave_candidates as select_wave1_candidates
from .wave2_new_platform_knowledge import select_wave_candidates as select_wave2_candidates

REFRESH_FILENAME = "CG_MATCHER_IMPROVEMENT_REVIEW_INDEX_REFRESH_v1.json"
REFRESH_AUDIT_FILENAME = "CG_MATCHER_IMPROVEMENT_REVIEW_INDEX_REFRESH_AUDIT_v1.json"
REFRESH_CHANGESET_FILENAME = "CG_MATCHER_IMPROVEMENT_REVIEW_INDEX_REFRESH_CHANGESET_v1.json"

DECISION_CATEGORIES = (
    "PRESERVED_EXACT",
    "PRESERVED_WITH_METADATA_REFRESH",
    "HISTORICAL_TARGET_CONFLICT",
    "HISTORICAL_CANDIDATE_MISSING",
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def refresh_path() -> Path:
    return CALIBRATION_DIR / REFRESH_FILENAME


def refresh_audit_path() -> Path:
    return CALIBRATION_DIR / REFRESH_AUDIT_FILENAME


def refresh_changeset_path() -> Path:
    return CALIBRATION_DIR / REFRESH_CHANGESET_FILENAME


def _candidate_key_parts(candidate_key: str) -> tuple[str, str, str, str]:
    parts = candidate_key.split("::", 3)
    while len(parts) < 4:
        parts.append("")
    return (parts[0], parts[1], parts[2], parts[3])


def _corpus_aggregate_hash() -> str:
    return _hash_bytes(
        json.dumps(_candidate_artifact_hashes(), sort_keys=True).encode("utf-8"),
    )


def _substantive_view(record: dict[str, Any]) -> dict[str, Any]:
    maps_to = record.get("mapsTo") or {}
    what = record.get("what") or {}
    return {
        "manualId": record.get("manualId"),
        "artifactSource": record.get("artifactSource"),
        "reviewClass": record.get("reviewClass"),
        "proposedCanonicalId": maps_to.get("proposedCanonicalId"),
        "mappingType": maps_to.get("mappingType"),
        "candidateStatus": record.get("candidateStatus"),
        "sourceTerm": what.get("sourceTerm"),
        "procedureId": what.get("procedureId"),
    }


def _substantive_fingerprint(record: dict[str, Any]) -> str:
    return _hash_bytes(json.dumps(_substantive_view(record), sort_keys=True).encode("utf-8"))


def _resolve_candidate_id_for_key(
    records_by_id: dict[str, dict[str, Any]],
    candidate_key: str,
) -> str | None:
    manual_id, procedure_id, source_term, _extracted = _candidate_key_parts(candidate_key)
    matches: list[str] = []
    for candidate_id, record in records_by_id.items():
        if str(record.get("manualId") or "") != manual_id:
            continue
        what = record.get("what") or {}
        if procedure_id and str(what.get("procedureId") or "") != procedure_id:
            continue
        if str(what.get("sourceTerm") or "") != source_term:
            continue
        matches.append(candidate_id)
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        return matches[0]
    return None


def _classify_historical_decision(
    candidate_id: str,
    decision: dict[str, Any],
    before_record: dict[str, Any] | None,
    after_record: dict[str, Any] | None,
) -> dict[str, Any]:
    if after_record is None:
        return {
            "candidateId": candidate_id,
            "category": "HISTORICAL_CANDIDATE_MISSING",
            "reviewStatus": decision.get("reviewStatus"),
            "manualId": decision.get("manualId"),
        }
    if before_record is None:
        return {
            "candidateId": candidate_id,
            "category": "PRESERVED_WITH_METADATA_REFRESH",
            "reviewStatus": decision.get("reviewStatus"),
            "manualId": decision.get("manualId"),
            "note": "no pre-refresh index record; post-refresh record present",
        }
    if _record_fingerprint(before_record) == _record_fingerprint(after_record):
        return {
            "candidateId": candidate_id,
            "category": "PRESERVED_EXACT",
            "reviewStatus": decision.get("reviewStatus"),
            "manualId": decision.get("manualId"),
        }
    if _substantive_fingerprint(before_record) == _substantive_fingerprint(after_record):
        return {
            "candidateId": candidate_id,
            "category": "PRESERVED_WITH_METADATA_REFRESH",
            "reviewStatus": decision.get("reviewStatus"),
            "manualId": decision.get("manualId"),
        }
    return {
        "candidateId": candidate_id,
        "category": "HISTORICAL_TARGET_CONFLICT",
        "reviewStatus": decision.get("reviewStatus"),
        "manualId": decision.get("manualId"),
        "before": _substantive_view(before_record),
        "after": _substantive_view(after_record),
    }


def _decision_wave_bucket(candidate_id: str, wave1_ids: set[str], wave2_ids: set[str]) -> str:
    if candidate_id in wave1_ids:
        return "wave1"
    if candidate_id in wave2_ids:
        return "wave2"
    return "other"


def _verify_wave_regression(
    decisions_store: dict[str, Any],
    index_after: dict[str, Any],
    index_before: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    wave2_records = select_wave2_candidates(index_after)
    wave2_ids = {str(r["candidateId"]) for r in wave2_records}
    decision_map = decisions_store.get("decisions") or {}
    # Wave 1 closure cohort is frozen as the 370 decisions outside Wave 2 (796 total).
    wave1_decision_ids = sorted(cid for cid in decision_map if cid not in wave2_ids)

    wave1_status = Counter(decision_map[cid]["reviewStatus"] for cid in wave1_decision_ids)
    wave2_status = Counter(
        decision_map[cid]["reviewStatus"]
        for cid in wave2_ids
        if cid in decision_map
    )

    if len(wave1_decision_ids) != 370:
        errors.append(f"wave1 historical decision cohort {len(wave1_decision_ids)} != 370")
    if wave1_status.get("accepted", 0) != 328:
        errors.append(f"wave1 accepted {wave1_status.get('accepted', 0)} != 328")
    if wave1_status.get("deferred", 0) != 41:
        errors.append(f"wave1 deferred {wave1_status.get('deferred', 0)} != 41")
    if wave1_status.get("rejected", 0) != 1:
        errors.append(f"wave1 rejected {wave1_status.get('rejected', 0)} != 1")

    if len(wave2_records) != 426:
        errors.append(f"wave2 candidate count {len(wave2_records)} != 426")
    if wave2_status.get("accepted", 0) != 426:
        errors.append(f"wave2 accepted {wave2_status.get('accepted', 0)} != 426")

    before_by_id = _records_by_id(index_before)
    after_by_id = _records_by_id(index_after)
    accepted_target_drift: list[dict[str, Any]] = []
    closed_wave_ids = set(wave1_decision_ids) | wave2_ids
    for candidate_id in sorted(closed_wave_ids):
        decision = decision_map.get(candidate_id)
        if not decision or decision.get("reviewStatus") != "accepted":
            continue
        before_record = before_by_id.get(candidate_id)
        after_record = after_by_id.get(candidate_id)
        if not after_record:
            errors.append(f"wave accepted candidate missing after refresh: {candidate_id}")
            continue
        if before_record and _substantive_fingerprint(before_record) != _substantive_fingerprint(after_record):
            accepted_target_drift.append(
                {
                    "candidateId": candidate_id,
                    "before": _substantive_view(before_record),
                    "after": _substantive_view(after_record),
                },
            )
            errors.append(f"wave accepted substantive drift: {candidate_id}")

    wave1_class_count = len(select_wave1_candidates(index_after))
    result = {
        "wave1": {
            "historicalDecisionCohort": len(wave1_decision_ids),
            "currentExistingCanonicalMappingPool": wave1_class_count,
            "accepted": wave1_status.get("accepted", 0),
            "deferred": wave1_status.get("deferred", 0),
            "rejected": wave1_status.get("rejected", 0),
        },
        "wave2": {
            "candidateCount": len(wave2_records),
            "accepted": wave2_status.get("accepted", 0),
            "deferred": wave2_status.get("deferred", 0),
            "rejected": wave2_status.get("rejected", 0),
        },
        "acceptedTargetDrift": accepted_target_drift,
    }
    return result, errors


def _reconciled_record_review_status(
    mutations: list[dict[str, Any]],
    after_by_id: dict[str, dict[str, Any]],
    decision_map: dict[str, Any],
    keep_baseline_keys: set[str],
) -> dict[str, Any]:
    already_reviewed: list[str] = []
    requires_review: list[str] = []
    baseline_retained: list[str] = []
    staging_only: list[str] = []

    for mutation in mutations:
        key = str(mutation.get("candidateKey") or "")
        if key in keep_baseline_keys:
            baseline_retained.append(key)
            continue
        candidate_id = _resolve_candidate_id_for_key(after_by_id, key)
        if not candidate_id:
            staging_only.append(key)
            continue
        if candidate_id in decision_map:
            already_reviewed.append(candidate_id)
        else:
            requires_review.append(candidate_id)

    return {
        "alreadyReviewedDecisionPreserved": already_reviewed,
        "requiresNewHumanReview": requires_review,
        "intentionallyBaselineRetained": sorted(keep_baseline_keys),
        "stagingOnlyOrNonProduction": staging_only,
    }


def run_matcher_improvement_review_index_refresh_gate(*, apply_mutations: bool = True) -> dict[str, Any]:
    errors: list[str] = []

    recon_path = reconciliation_path()
    if not recon_path.is_file():
        errors.append("missing production reconciliation artifact")
    else:
        recon = _read_json(recon_path)
        if recon.get("status") != "GREEN":
            errors.append("production reconciliation status is not GREEN")
        if not recon.get("mutationsApplied"):
            errors.append("production reconciliation mutationsApplied is false")

    changeset_file = reconciliation_changeset_path()
    mutations: list[dict[str, Any]] = []
    if not changeset_file.is_file():
        errors.append("missing production reconciliation changeset")
    else:
        changeset = _read_json(changeset_file)
        mutations = list(changeset.get("mutations") or [])
        if len(mutations) != 52:
            errors.append(f"reconciliation changeset mutation count {len(mutations)} != 52")

    preflight = run_preflight(
        batch_run_id=DEFAULT_BATCH_RUN_ID,
        processing_manifest_hash=DEFAULT_PROCESSING_MANIFEST_HASH,
    )
    if not preflight["passed"]:
        errors.extend([f"preflight: {e}" for e in preflight.get("errors") or []])

    decisions_hash_before = _sha256_file(decisions_path())
    decisions_bytes_before = decisions_path().read_bytes()
    decisions_store = load_decisions()
    if len(decisions_store.get("decisions") or {}) != 796:
        errors.append("decision count != 796 before refresh")

    index_file = index_path()
    index_hash_before = _sha256_file(index_file) if index_file.is_file() else None
    index_before = _read_json(index_file) if index_file.is_file() else None
    index_population_before = (index_before or {}).get("totalCandidateRecords")

    corpus_hash_before = _corpus_aggregate_hash()
    source_population = _source_candidate_population()
    candidate_hashes_before = _candidate_artifact_hashes()
    canonical_hashes_before = _canonical_graph_hashes()

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    if errors:
        return _package(errors, apply_mutations=apply_mutations)

    try:
        index_after = _build_fresh_index()
    except RuntimeError as exc:
        errors.append(str(exc))
        return _package(errors, apply_mutations=apply_mutations)

    duplicates = _duplicate_candidate_ids(index_after.get("candidateRecords") or [])
    if duplicates:
        errors.append(f"duplicate candidate identities: {len(duplicates)}")

    if index_after.get("totalCandidateRecords") != source_population["totalSourceCandidates"]:
        errors.append("refreshed index population != production source population")

    index_diff = _diff_index_records(index_before, index_after)
    after_by_id = _records_by_id(index_after)
    before_by_id = _records_by_id(index_before or {"candidateRecords": []})

    decision_map = decisions_store.get("decisions") or {}
    wave2_ids = {str(r["candidateId"]) for r in select_wave2_candidates(index_after)}
    wave1_ids = {cid for cid in decision_map if cid not in wave2_ids}

    reconciliation_tally = Counter()
    non_preserved: list[dict[str, Any]] = []
    by_wave = {"wave1": Counter(), "wave2": Counter(), "other": Counter()}

    for candidate_id, decision in sorted(decision_map.items()):
        classification = _classify_historical_decision(
            candidate_id,
            decision,
            before_by_id.get(candidate_id),
            after_by_id.get(candidate_id),
        )
        category = classification["category"]
        reconciliation_tally[category] += 1
        bucket = _decision_wave_bucket(candidate_id, wave1_ids, wave2_ids)
        by_wave[bucket][category] += 1
        if category not in {"PRESERVED_EXACT", "PRESERVED_WITH_METADATA_REFRESH"}:
            non_preserved.append(classification)

    for item in non_preserved:
        if item["category"] == "HISTORICAL_CANDIDATE_MISSING":
            errors.append(f"historical candidate missing: {item['candidateId']}")
        elif item["category"] == "HISTORICAL_TARGET_CONFLICT":
            if item.get("reviewStatus") == "accepted" and (
                item["candidateId"] in wave1_ids or item["candidateId"] in wave2_ids
            ):
                errors.append(f"wave historical target conflict: {item['candidateId']}")

    keep_baseline_items = _keep_baseline_records()
    keep_baseline_keys = {str(i.get("candidateKey") or "") for i in keep_baseline_items}
    baseline_verification: list[dict[str, Any]] = []
    for item in keep_baseline_items:
        key = str(item.get("candidateKey") or "")
        candidate_id = _resolve_candidate_id_for_key(after_by_id, key)
        entry: dict[str, Any] = {"candidateKey": key, "candidateId": candidate_id}
        if key in keep_baseline_keys and candidate_id:
            prod_fp = _substantive_fingerprint(after_by_id[candidate_id])
            before_fp = (
                _substantive_fingerprint(before_by_id[candidate_id])
                if candidate_id in before_by_id
                else None
            )
            entry["status"] = "production_present_unchanged" if before_fp == prod_fp else "production_present_changed"
            if before_fp != prod_fp:
                errors.append(f"keep-baseline production record changed in index: {key}")
        else:
            entry["status"] = "staging_only_absent"
        baseline_verification.append(entry)

    reconciled_review = _reconciled_record_review_status(
        mutations,
        after_by_id,
        decision_map,
        keep_baseline_keys,
    )

    manifest_keys = {str(r.get("candidateKey") or "") for r in _read_json(manifest_path()).get("records") or []}
    reconciled_intersection = []
    for mutation in mutations:
        key = str(mutation.get("candidateKey") or "")
        cid = _resolve_candidate_id_for_key(after_by_id, key)
        reconciled_intersection.append(
            {
                "candidateKey": key,
                "candidateId": cid,
                "hasHistoricalDecision": bool(cid and cid in decision_map),
                "inManifest": key in manifest_keys,
            },
        )

    wave_regression, wave_errors = _verify_wave_regression(decisions_store, index_after, index_before or {})
    errors.extend(wave_errors)

    index_hash_after = index_hash_before
    idempotent_second_pass = None

    if apply_mutations and not errors:
        if _semantic_index_fingerprint(index_before or {}) != _semantic_index_fingerprint(index_after):
            write_candidate_review_index(index_after)
            index_hash_after = _sha256_file(index_file)
        else:
            index_hash_after = index_hash_before

        if decisions_path().read_bytes() != decisions_bytes_before:
            errors.append("796 decision artifact bytes changed during index refresh")

        if _sha256_file(decisions_path()) != decisions_hash_before:
            errors.append("796 decision artifact hash changed during index refresh")

        if _candidate_artifact_hashes() != candidate_hashes_before:
            errors.append("production candidate corpus changed during index refresh")

        if _canonical_graph_hashes() != canonical_hashes_before:
            errors.append("canonical graphs changed during index refresh")

        hashes_ok_after, hash_errors_after = validate_frozen_hashes()
        if not hashes_ok_after:
            errors.extend(hash_errors_after)

        wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
        wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
        if wave1.get("status") != "WAVE1_CLOSED":
            errors.append("wave1 closure not intact")
        if wave2.get("status") != "WAVE2_CLOSED":
            errors.append("wave2 closure not intact")

        written = _read_json(index_file)
        second = _build_fresh_index()
        idempotent_second_pass = {
            "semanticFingerprintMatch": _semantic_index_fingerprint(written) == _semantic_index_fingerprint(second),
            "recordDiff": _diff_index_records(written, second),
        }
        extra = idempotent_second_pass["recordDiff"]
        if extra["additions"] or extra["removals"] or extra["modified"]:
            errors.append("index refresh not idempotent on second build")

    status = "GREEN" if not errors else "STOP"

    return _package(
        errors,
        status=status,
        apply_mutations=apply_mutations,
        mutations_applied=apply_mutations and status == "GREEN",
        preflight=preflight,
        index_hash_before=index_hash_before,
        index_hash_after=index_hash_after,
        index_population_before=index_population_before,
        index_population_after=index_after.get("totalCandidateRecords"),
        corpus_hash_before=corpus_hash_before,
        corpus_hash_after=_corpus_aggregate_hash() if apply_mutations else corpus_hash_before,
        decisions_hash_before=decisions_hash_before,
        decisions_hash_after=_sha256_file(decisions_path()) if apply_mutations else decisions_hash_before,
        source_population=source_population,
        index_diff=index_diff,
        reconciliation_tally=dict(reconciliation_tally),
        non_preserved=non_preserved,
        by_wave_tally={k: dict(v) for k, v in by_wave.items()},
        wave_regression=wave_regression,
        reconciled_intersection=reconciled_intersection,
        reconciled_review=reconciled_review,
        baseline_verification=baseline_verification,
        duplicates=duplicates,
        idempotent_second_pass=idempotent_second_pass,
        hashes_ok=hashes_ok,
        recon_audit=str(reconciliation_audit_path()),
        changeset_summary={
            "mutationCount": len(mutations),
            "indexMetadataChanges": len(index_diff.get("modified") or []),
        },
    )


def _package(
    errors: list[str],
    *,
    apply_mutations: bool,
    status: str | None = None,
    mutations_applied: bool = False,
    **kwargs: Any,
) -> dict[str, Any]:
    status = status or ("STOP" if errors else "GREEN")
    index_diff = kwargs.get("index_diff") or {}
    refresh = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_review_index_refresh",
        "status": status,
        "generatedAt": _utc_now(),
        "gateType": "targeted_production_review_index_refresh",
        "derivedIndexRefreshOnly": True,
        "canonicalPromotionImplied": False,
        "matcherExecuted": False,
        "productionCandidateMutation": False,
        "productionDecisionsMutation": False,
        "mutationsApplied": mutations_applied,
        "prerequisites": {
            "productionReconciliation": str(reconciliation_path()),
            "productionReconciliationAudit": kwargs.get("recon_audit"),
            "productionReconciliationChangeset": str(reconciliation_changeset_path()),
            "productionReconciliationManifest": str(manifest_path()),
        },
        "preRefreshSnapshot": {
            "reviewIndexHash": kwargs.get("index_hash_before"),
            "decisionsArtifactHash": kwargs.get("decisions_hash_before"),
            "productionCandidateCorpusHash": kwargs.get("corpus_hash_before"),
            "sourceCandidatePopulation": (kwargs.get("source_population") or {}).get("totalSourceCandidates"),
            "reviewIndexRecordCount": kwargs.get("index_population_before"),
            "decisionCount": 796,
            "decisionTallyByWave": kwargs.get("by_wave_tally"),
        },
        "postRefreshSnapshot": {
            "reviewIndexHash": kwargs.get("index_hash_after"),
            "decisionsArtifactHash": kwargs.get("decisions_hash_after"),
            "productionCandidateCorpusHash": kwargs.get("corpus_hash_after"),
            "reviewIndexRecordCount": kwargs.get("index_population_after"),
        },
        "summary": {
            "indexRecordsAdded": len(index_diff.get("additions") or []),
            "indexRecordsRemoved": len(index_diff.get("removals") or []),
            "indexRecordsModified": len(index_diff.get("modified") or []),
            "indexRecordsUnchanged": len(index_diff.get("unchanged") or []),
            "duplicateCandidateIdentities": len(kwargs.get("duplicates") or []),
            "historicalDecisionReconciliation": kwargs.get("reconciliation_tally"),
            "reconciledManifestIntersection": kwargs.get("reconciled_intersection"),
        },
        "waveRegression": kwargs.get("wave_regression"),
        "historicalConflicts": [
            item for item in (kwargs.get("non_preserved") or []) if item.get("category") == "HISTORICAL_TARGET_CONFLICT"
        ],
        "missingHistoricalCandidates": [
            item
            for item in (kwargs.get("non_preserved") or [])
            if item.get("category") == "HISTORICAL_CANDIDATE_MISSING"
        ],
        "newReviewRecords": kwargs.get("reconciled_review"),
        "baselineVerification": kwargs.get("baseline_verification"),
        "preflight": kwargs.get("preflight"),
        "integrity": {
            "frozenHashVerification": {"passed": kwargs.get("hashes_ok", False)},
            "decisionsByteIdentical": kwargs.get("decisions_hash_before") == kwargs.get("decisions_hash_after"),
        },
        "idempotentSecondPass": kwargs.get("idempotent_second_pass"),
        "errors": errors,
    }
    changeset = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_review_index_refresh_changeset",
        "status": status,
        "generatedAt": refresh["generatedAt"],
        "indexMetadataChanges": {
            "additions": index_diff.get("additions") or [],
            "removals": index_diff.get("removals") or [],
            "modified": index_diff.get("modified") or [],
            "modifiedDetails": index_diff.get("modifiedDetails") or [],
            "unchangedCount": len(index_diff.get("unchanged") or []),
        },
        "preservedHistoricalDecisions": kwargs.get("reconciliation_tally"),
        "newlyReviewableRecords": (kwargs.get("reconciled_review") or {}).get("requiresNewHumanReview") or [],
        "historicalConflicts": refresh["historicalConflicts"],
        "missingHistoricalCandidates": refresh["missingHistoricalCandidates"],
        "baselineRetainedKeys": (kwargs.get("reconciled_review") or {}).get("intentionallyBaselineRetained") or [],
    }
    audit = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_review_index_refresh_audit",
        "status": status,
        "generatedAt": refresh["generatedAt"],
        "integrityChecks": {"passed": not errors, "errors": errors},
        "productionArtifactsTouched": ["review/CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_INDEX_v1.json"]
        if mutations_applied
        else [],
        "canonicalArtifactsTouched": [],
        "candidateArtifactsTouched": [],
        "decisionsArtifactTouched": False,
    }
    return {"refresh": refresh, "changeset": changeset, "audit": audit}


def write_matcher_improvement_review_index_refresh_artifacts(payload: dict[str, Any]) -> tuple[Path, Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    paths = (refresh_path(), refresh_audit_path(), refresh_changeset_path())
    paths[0].write_text(json.dumps(payload["refresh"], indent=2), encoding="utf-8")
    paths[1].write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    paths[2].write_text(json.dumps(payload["changeset"], indent=2), encoding="utf-8")
    return paths
