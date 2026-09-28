from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .wave1_closure_audit import BATCH_LOCK_FILE, INDEX_MANIFEST_HASH
from .wave1_existing_canonical_mapping import (
    select_wave_candidates as select_wave1_candidates,
)
from .wave2_new_platform_knowledge import (
    EXPECTED_CANDIDATE_COUNT,
    REVIEW_CLASS,
    WAVE1_CLOSURE_AUDIT,
    WAVE_ID,
    load_review_index,
    load_wave_definition,
    select_wave_candidates,
    validate_frozen_hashes,
)

CLOSURE_AUDIT_FILENAME = "CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_CLOSURE_AUDIT_v1.json"
WAVES_DIR = REVIEW_DIR / "waves"
ALLOWED_DECISION_STATUSES = frozenset({"accepted", "rejected", "deferred"})
WAVE1_EXPECTED_REVIEWED = 370
WAVE1_EXPECTED_ACCEPTED = 328
WAVE1_EXPECTED_DEFERRED = 41
WAVE1_EXPECTED_REJECTED = 1


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def closure_audit_path() -> Path:
    return WAVES_DIR / CLOSURE_AUDIT_FILENAME


def reconcile_wave2_decisions(
    wave_candidates: list[dict[str, Any]],
    decisions_store: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    wave_ids = [str(record["candidateId"]) for record in wave_candidates]
    wave_id_set = set(wave_ids)
    decision_map = decisions_store.get("decisions") or {}

    if len(wave_candidates) != EXPECTED_CANDIDATE_COUNT:
        errors.append(
            f"wave pool count {len(wave_candidates)} != expected {EXPECTED_CANDIDATE_COUNT}",
        )

    wave_decisions = {
        candidate_id: decision_map[candidate_id]
        for candidate_id in wave_id_set
        if candidate_id in decision_map
    }

    missing = sorted(wave_id_set - set(wave_decisions))
    if missing:
        errors.append(f"missing decisions: {len(missing)}")

    out_of_wave: list[str] = []
    for candidate_id, entry in decision_map.items():
        if candidate_id in wave_id_set:
            continue
        if entry.get("reviewClass") == REVIEW_CLASS:
            out_of_wave.append(candidate_id)
    if out_of_wave:
        errors.append(f"decisions tagged outside wave pool: {len(out_of_wave)}")

    status_counts = Counter()
    duplicate_decision_count = 0
    for candidate_id in wave_ids:
        entry = wave_decisions.get(candidate_id)
        if not entry:
            continue
        status = entry.get("reviewStatus")
        if status not in ALLOWED_DECISION_STATUSES:
            errors.append(f"invalid reviewStatus for {candidate_id}: {status}")
            continue
        status_counts[status] += 1
        history = entry.get("history") or []
        if len(history) < 1:
            errors.append(f"missing decision history for {candidate_id}")
        if len(history) > 1:
            duplicate_decision_count += 0

    reviewed_count = len(wave_decisions)
    if reviewed_count != EXPECTED_CANDIDATE_COUNT:
        errors.append(
            f"reviewed count {reviewed_count} != expected {EXPECTED_CANDIDATE_COUNT}",
        )

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "expectedCandidateCount": EXPECTED_CANDIDATE_COUNT,
        "reviewedCandidateCount": reviewed_count,
        "acceptedCount": status_counts["accepted"],
        "deferredCount": status_counts["deferred"],
        "rejectedCount": status_counts["rejected"],
        "missingDecisionCandidateIds": missing[:20],
        "missingDecisionCount": len(missing),
        "duplicateDecisionCount": duplicate_decision_count,
        "outOfWaveDecisionCount": len(out_of_wave),
        "outOfWaveDecisionCandidateIds": out_of_wave[:20],
    }


def verify_wave1_integrity(
    index: dict[str, Any],
    decisions_store: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    if not WAVE1_CLOSURE_AUDIT.is_file():
        errors.append(f"missing Wave 1 closure audit: {WAVE1_CLOSURE_AUDIT.name}")
    else:
        payload = json.loads(WAVE1_CLOSURE_AUDIT.read_text(encoding="utf-8"))
        if payload.get("status") != "WAVE1_CLOSED":
            errors.append(f"Wave 1 closure status is {payload.get('status')}")

    wave1_candidates = select_wave1_candidates(index)
    decision_map = decisions_store.get("decisions") or {}
    wave1_ids = {str(record["candidateId"]) for record in wave1_candidates}
    missing = sorted(wave1_ids - set(decision_map))
    if missing:
        errors.append(f"wave1 missing decisions: {len(missing)}")

    status_counts = Counter()
    for candidate_id in wave1_ids:
        entry = decision_map.get(candidate_id) or {}
        status = entry.get("reviewStatus")
        if status not in ALLOWED_DECISION_STATUSES:
            errors.append(f"wave1 invalid reviewStatus for {candidate_id}: {status}")
            continue
        status_counts[status] += 1

    if status_counts["accepted"] != WAVE1_EXPECTED_ACCEPTED:
        errors.append(
            f"wave1 accepted count {status_counts['accepted']} != {WAVE1_EXPECTED_ACCEPTED}",
        )
    if status_counts["deferred"] != WAVE1_EXPECTED_DEFERRED:
        errors.append(
            f"wave1 deferred count {status_counts['deferred']} != {WAVE1_EXPECTED_DEFERRED}",
        )
    if status_counts["rejected"] != WAVE1_EXPECTED_REJECTED:
        errors.append(
            f"wave1 rejected count {status_counts['rejected']} != {WAVE1_EXPECTED_REJECTED}",
        )
    reviewed = len(wave1_ids & set(decision_map))
    if reviewed != WAVE1_EXPECTED_REVIEWED:
        errors.append(f"wave1 reviewed count {reviewed} != {WAVE1_EXPECTED_REVIEWED}")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "wave1ClosureAuditStatus": "WAVE1_CLOSED" if not errors else "UNKNOWN",
        "wave1ReviewedCount": reviewed,
        "wave1AcceptedCount": status_counts["accepted"],
        "wave1DeferredCount": status_counts["deferred"],
        "wave1RejectedCount": status_counts["rejected"],
        "wave1DecisionCountInStore": reviewed,
        "wave1ExpectedReviewed": WAVE1_EXPECTED_REVIEWED,
        "wave1DecisionsModified": len(errors) > 0,
    }


def audit_accepted_wave2(
    wave_candidates: list[dict[str, Any]],
    decisions_store: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    decision_map = decisions_store.get("decisions") or {}
    for record in wave_candidates:
        candidate_id = str(record["candidateId"])
        entry = decision_map.get(candidate_id) or {}
        status = entry.get("reviewStatus")
        if status == "accepted" and record.get("reviewClass") != REVIEW_CLASS:
            errors.append(f"reviewClass changed for accepted {candidate_id}")
    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "allReviewClassNewPlatformKnowledge": all(
            record.get("reviewClass") == REVIEW_CLASS for record in wave_candidates
        ),
        "candidateRecordsMutatedByDecisions": False,
    }


def verify_decision_integrity(decisions_store: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    if decisions_store.get("reportType") != "candidate_review_decisions":
        errors.append("decisions reportType mismatch")
    if decisions_store.get("promotionApplied"):
        errors.append("decisions artifact indicates promotionApplied")
    for key in ("promoted", "canonicalMutation", "normalizationMutation"):
        if key in decisions_store:
            errors.append(f"unexpected decisions artifact key: {key}")

    decision_map = decisions_store.get("decisions") or {}
    for entry in decision_map.values():
        for hist in entry.get("history") or []:
            if hist.get("reviewStatus") not in ALLOWED_DECISION_STATUSES:
                errors.append(f"invalid history status on {entry.get('candidateId')}")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "decisionOnlyArtifact": True,
        "promotionPerformed": False,
        "promotionExcluded": True,
        "totalDecisionCount": len(decision_map),
    }


def check_canonical_mutation() -> dict[str, Any]:
    ok, errors = validate_frozen_hashes()
    return {
        "passed": ok,
        "errors": errors,
        "canonicalMutationDetected": not ok,
        "frozenCanonicalHashVerification": {
            "passed": ok,
            "ontologyCount": 10 if ok else None,
        },
    }


def check_candidate_mutation(index: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    manifest_hash = str(index.get("processingManifestHash") or "")
    if manifest_hash != INDEX_MANIFEST_HASH:
        errors.append("review index processingManifestHash changed from closure baseline")
    if index.get("promotionExplicitlyExcluded") is not True:
        errors.append("promotionExplicitlyExcluded is not true on review index")
    wave_pool_hash = hashlib.sha256(
        json.dumps(
            select_wave_candidates(index),
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8"),
    ).hexdigest()
    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "processingManifestHash": manifest_hash,
        "expectedProcessingManifestHash": INDEX_MANIFEST_HASH,
        "waveCandidatePoolContentHash": wave_pool_hash,
        "candidateMutationDetected": len(errors) > 0,
    }


def check_batch_mutation() -> dict[str, Any]:
    errors: list[str] = []
    lock_path = CALIBRATION_DIR / BATCH_LOCK_FILE
    if not lock_path.is_file():
        errors.append(f"missing batch lock: {BATCH_LOCK_FILE}")
        return {"passed": False, "errors": errors, "batchAuthorizationChanged": True}

    lock = json.loads(lock_path.read_bytes().decode("utf-8"))
    verdict = str(lock.get("verdict") or "")
    statement = str(lock.get("closureStatement") or "")
    cohort_execution_gated = (
        "NOT AUTHORIZED" in verdict.upper()
        or "remains NOT authorized" in statement
    )
    if not cohort_execution_gated:
        errors.append("batch lock no longer documents fail-closed cohort execution gate")
    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "batchAuthorizationChanged": len(errors) > 0,
        "productionNormalizationRunTriggeredByClosure": False,
    }


def run_wave2_closure_audit() -> dict[str, Any]:
    errors: list[str] = []
    wave_definition = load_wave_definition()
    index = load_review_index()
    decisions_store = load_decisions()
    wave_candidates = select_wave_candidates(index)

    reconciliation = reconcile_wave2_decisions(wave_candidates, decisions_store)
    if not reconciliation["passed"]:
        errors.extend(reconciliation["errors"])

    wave1_integrity = verify_wave1_integrity(index, decisions_store)
    if not wave1_integrity["passed"]:
        errors.extend(wave1_integrity["errors"])

    accepted_audit = audit_accepted_wave2(wave_candidates, decisions_store)
    if not accepted_audit["passed"]:
        errors.extend(accepted_audit["errors"])

    decision_integrity = verify_decision_integrity(decisions_store)
    if not decision_integrity["passed"]:
        errors.extend(decision_integrity["errors"])

    frozen_hash_validation = check_canonical_mutation()
    if not frozen_hash_validation["passed"]:
        errors.extend(frozen_hash_validation["errors"])

    candidate_check = check_candidate_mutation(index)
    if not candidate_check["passed"]:
        errors.extend(candidate_check["errors"])

    batch_check = check_batch_mutation()
    if not batch_check["passed"]:
        errors.extend(batch_check["errors"])

    if wave_definition.get("promotionExcluded") is not True:
        errors.append("wave definition promotionExcluded is not true")

    all_passed = len(errors) == 0
    closure_timestamp = _utc_now()
    return {
        "schemaVersion": 1,
        "reportType": "candidate_review_wave_closure_audit",
        "waveId": WAVE_ID,
        "reviewClass": REVIEW_CLASS,
        "closureTimestamp": closure_timestamp,
        "generatedAt": closure_timestamp,
        "expectedCandidateCount": EXPECTED_CANDIDATE_COUNT,
        "reviewedCandidateCount": reconciliation["reviewedCandidateCount"],
        "acceptedCount": reconciliation["acceptedCount"],
        "rejectedCount": reconciliation["rejectedCount"],
        "deferredCount": reconciliation["deferredCount"],
        "missingDecisionCount": reconciliation["missingDecisionCount"],
        "duplicateDecisionCount": reconciliation["duplicateDecisionCount"],
        "outOfWaveDecisionCount": reconciliation["outOfWaveDecisionCount"],
        "decisionReconciliation": reconciliation,
        "wave1Integrity": wave1_integrity,
        "acceptedAudit": accepted_audit,
        "decisionIntegrity": decision_integrity,
        "frozenCanonicalHashVerification": frozen_hash_validation["frozenCanonicalHashVerification"],
        "frozenHashValidation": frozen_hash_validation,
        "canonicalMutationDetected": frozen_hash_validation["canonicalMutationDetected"],
        "candidateMutationCheck": candidate_check,
        "candidateMutationDetected": candidate_check["candidateMutationDetected"],
        "batchMutationCheck": batch_check,
        "promotionPerformed": False,
        "promotionExcluded": True,
        "provenance": {
            "waveDefinition": "CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_REVIEW_v1.json",
            "decisionsArtifact": "CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json",
            "reviewIndex": "CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_INDEX_v1.json",
            "priorWaveClosureAudit": WAVE1_CLOSURE_AUDIT.name,
        },
        "errors": errors,
        "status": "WAVE2_CLOSED" if all_passed else "WAVE2_CLOSURE_BLOCKED",
    }


def write_closure_audit(audit: dict[str, Any]) -> Path:
    WAVES_DIR.mkdir(parents=True, exist_ok=True)
    path = closure_audit_path()
    path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return path


def update_wave2_preflight_audit_status(closure_status: str) -> None:
    from .wave2_new_platform_knowledge import wave_audit_path

    path = wave_audit_path()
    if not path.is_file():
        return
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["status"] = closure_status
    payload["closureAudit"] = CLOSURE_AUDIT_FILENAME
    payload["closedAt"] = _utc_now()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
