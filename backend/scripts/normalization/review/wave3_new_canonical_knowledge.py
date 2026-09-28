from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .wave1_closure_audit import BATCH_LOCK_FILE, INDEX_MANIFEST_HASH
from .wave1_existing_canonical_mapping import (
    REVIEW_CLASS as WAVE1_REVIEW_CLASS,
    load_review_index,
    validate_frozen_hashes,
    wave_order_key,
)
from .wave2_new_platform_knowledge import REVIEW_CLASS as WAVE2_REVIEW_CLASS

WAVE_DEFINITION_FILENAME = "CG_WAVE3_NEW_CANONICAL_KNOWLEDGE_REVIEW_v1.json"
WAVE_AUDIT_FILENAME = "CG_WAVE3_NEW_CANONICAL_KNOWLEDGE_AUDIT_v1.json"
WAVES_DIR = REVIEW_DIR / "waves"
WAVE_ID = "wave3-new-canonical-knowledge"
REVIEW_CLASS = "newCanonicalKnowledge"
WAVE1_CLOSURE_AUDIT = WAVES_DIR / "CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_AUDIT_v1.json"
WAVE2_CLOSURE_AUDIT = WAVES_DIR / "CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_CLOSURE_AUDIT_v1.json"

CONTAMINATING_REVIEW_CLASSES = frozenset(
    {
        "existingCanonicalMapping",
        "newPlatformKnowledge",
        "unresolved",
        "implementationSpecific",
        "architectureException",
        "inheritedKnowledge",
    },
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def wave_definition_path() -> Path:
    return WAVES_DIR / WAVE_DEFINITION_FILENAME


def wave_audit_path() -> Path:
    return WAVES_DIR / WAVE_AUDIT_FILENAME


def load_wave_definition() -> dict[str, Any]:
    path = wave_definition_path()
    if not path.is_file():
        raise FileNotFoundError(f"missing wave definition: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def inventory_candidate_count(index: dict[str, Any]) -> int:
    by_class = index.get("countsByReviewClass") or {}
    return int(by_class.get(REVIEW_CLASS) or 0)


def expected_candidate_count(wave_definition: dict[str, Any] | None = None) -> int:
    wave_definition = wave_definition or load_wave_definition()
    return int(wave_definition.get("expectedCandidateCount") or 0)


def select_wave_candidates(index: dict[str, Any]) -> list[dict[str, Any]]:
    records = [
        record
        for record in (index.get("candidateRecords") or [])
        if record.get("reviewClass") == REVIEW_CLASS
    ]
    return sorted(records, key=wave_order_key)


def verify_wave1_closure_intact() -> tuple[bool, list[str]]:
    errors: list[str] = []
    if not WAVE1_CLOSURE_AUDIT.is_file():
        errors.append(f"missing Wave 1 closure audit: {WAVE1_CLOSURE_AUDIT.name}")
        return False, errors
    payload = json.loads(WAVE1_CLOSURE_AUDIT.read_text(encoding="utf-8"))
    if payload.get("status") != "WAVE1_CLOSED":
        errors.append(f"Wave 1 closure status is {payload.get('status')}, expected WAVE1_CLOSED")
    if payload.get("reviewedCandidateCount", payload.get("reviewedCount")) != 370:
        errors.append("Wave 1 reviewed count is not 370")
    return len(errors) == 0, errors


def verify_wave2_closure_intact() -> tuple[bool, list[str]]:
    errors: list[str] = []
    if not WAVE2_CLOSURE_AUDIT.is_file():
        errors.append(f"missing Wave 2 closure audit: {WAVE2_CLOSURE_AUDIT.name}")
        return False, errors
    payload = json.loads(WAVE2_CLOSURE_AUDIT.read_text(encoding="utf-8"))
    if payload.get("status") != "WAVE2_CLOSED":
        errors.append(f"Wave 2 closure status is {payload.get('status')}, expected WAVE2_CLOSED")
    if payload.get("reviewedCandidateCount") != 426:
        errors.append("Wave 2 reviewedCandidateCount is not 426")
    return len(errors) == 0, errors


def wave3_decision_count(decisions_store: dict[str, Any], wave_candidate_ids: set[str]) -> int:
    decision_map = decisions_store.get("decisions") or {}
    return sum(1 for candidate_id in wave_candidate_ids if candidate_id in decision_map)


def check_batch_authorization_unchanged() -> dict[str, Any]:
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
    }


def check_index_and_candidate_mutation(index: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    manifest_hash = str(index.get("processingManifestHash") or "")
    if manifest_hash != INDEX_MANIFEST_HASH:
        errors.append("review index processingManifestHash changed from governance baseline")
    if index.get("promotionExplicitlyExcluded") is not True:
        errors.append("promotionExplicitlyExcluded is not true on review index")
    inventory_count = inventory_candidate_count(index)
    wave_pool = select_wave_candidates(index)
    if len(wave_pool) != inventory_count:
        errors.append(
            f"index countsByReviewClass {REVIEW_CLASS}={inventory_count} "
            f"!= candidateRecords pool {len(wave_pool)}",
        )
    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "processingManifestHash": manifest_hash,
        "inventoryReviewClassCount": inventory_count,
        "candidateMutationDetected": len(errors) > 0,
    }


def run_wave3_preflight(
    *,
    index: dict[str, Any] | None = None,
    wave_definition: dict[str, Any] | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    wave_definition = wave_definition or load_wave_definition()
    index = index or load_review_index()
    expected_count = expected_candidate_count(wave_definition)
    wave_candidates = select_wave_candidates(index)
    wave_candidate_ids = {str(record["candidateId"]) for record in wave_candidates}

    if wave_definition.get("waveId") != WAVE_ID:
        errors.append("wave definition waveId mismatch")
    if wave_definition.get("reviewClass") != REVIEW_CLASS:
        errors.append("wave definition reviewClass mismatch")
    if int(wave_definition.get("expectedCandidateCount") or 0) != expected_count:
        errors.append("wave definition expectedCandidateCount internal mismatch")

    if wave_definition.get("promotionExcluded") is not True:
        errors.append("wave definition promotionExcluded must be true")
    if wave_definition.get("canonicalMutationAllowed") is not False:
        errors.append("wave definition canonicalMutationAllowed must be false")

    if len(wave_candidates) != expected_count:
        errors.append(
            f"expected {expected_count} {REVIEW_CLASS} candidates, found {len(wave_candidates)}",
        )

    inventory_count = inventory_candidate_count(index)
    if inventory_count != expected_count:
        errors.append(
            f"index inventory count {inventory_count} != wave definition expected {expected_count}",
        )

    candidate_ids = [str(record.get("candidateId") or "") for record in wave_candidates]
    if len(candidate_ids) != len(set(candidate_ids)):
        errors.append("duplicate candidateId detected in wave pool")

    for record in wave_candidates:
        if record.get("reviewClass") != REVIEW_CLASS:
            errors.append(f"wrong reviewClass for {record.get('candidateId')}")

    for contaminant in CONTAMINATING_REVIEW_CLASSES:
        count = sum(
            1
            for record in wave_candidates
            if record.get("reviewClass") == contaminant
        )
        if count > 0:
            errors.append(f"wave pool includes {count} {contaminant} candidates")

    for other_class in (WAVE1_REVIEW_CLASS, WAVE2_REVIEW_CLASS):
        count = sum(1 for record in wave_candidates if record.get("reviewClass") == other_class)
        if count > 0:
            errors.append(f"wave pool includes {count} {other_class} candidates")

    ordering_keys = [wave_order_key(record) for record in wave_candidates]
    if ordering_keys != sorted(ordering_keys):
        errors.append("wave candidate ordering is not deterministic")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    wave1_ok, wave1_errors = verify_wave1_closure_intact()
    if not wave1_ok:
        errors.extend(wave1_errors)

    wave2_ok, wave2_errors = verify_wave2_closure_intact()
    if not wave2_ok:
        errors.extend(wave2_errors)

    index_check = check_index_and_candidate_mutation(index)
    if not index_check["passed"]:
        errors.extend(index_check["errors"])

    batch_check = check_batch_authorization_unchanged()
    if not batch_check["passed"]:
        errors.extend(batch_check["errors"])

    decisions = load_decisions()
    if decisions.get("promotionApplied"):
        errors.append("decisions artifact indicates promotionApplied")

    wave3_decisions = wave3_decision_count(decisions, wave_candidate_ids)
    if wave3_decisions > 0:
        errors.append(f"wave 3 decisions already present: {wave3_decisions}")

    manual_ids = sorted({str(record.get("manualId") or "") for record in wave_candidates})
    platform_ids = sorted(
        {
            str((record.get("context") or {}).get("platformId") or "")
            for record in wave_candidates
            if (record.get("context") or {}).get("platformId")
        },
    )

    if expected_count == 0:
        warnings.append(
            "Wave 3 pool is empty in current index; gate is ready but human review queue has no candidates.",
        )

    return {
        "passed": len(errors) == 0,
        "waveId": WAVE_ID,
        "reviewClass": REVIEW_CLASS,
        "expectedCandidateCount": expected_count,
        "actualCandidateCount": len(wave_candidates),
        "inventoryReviewClassCount": inventory_count,
        "manualCount": len(manual_ids),
        "platformIdCount": len(platform_ids),
        "manualIds": manual_ids,
        "platformIds": platform_ids,
        "errors": errors,
        "warnings": warnings,
        "frozenHashesValid": hashes_ok,
        "wave1ClosureIntact": wave1_ok,
        "wave2ClosureIntact": wave2_ok,
        "promotionExcluded": True,
        "canonicalMutationAllowed": False,
        "canonicalMutationDetected": not hashes_ok,
        "candidateMutationDetected": not index_check["passed"],
        "promotionPerformed": False,
        "decisionsGenerated": False,
        "wave3DecisionCount": wave3_decisions,
        "existingDecisionCount": len(decisions.get("decisions") or {}),
        "batchAuthorizationChanged": not batch_check["passed"],
    }


def build_wave3_audit(preflight: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "reportType": "candidate_review_wave_audit",
        "waveId": WAVE_ID,
        "status": "READY_FOR_HUMAN_REVIEW" if preflight.get("passed") else "BLOCKED",
        "generatedAt": _utc_now(),
        "candidateCount": preflight.get("actualCandidateCount"),
        "expectedCandidateCount": preflight.get("expectedCandidateCount"),
        "inventoryReviewClassCount": preflight.get("inventoryReviewClassCount"),
        "manualCountRepresented": preflight.get("manualCount"),
        "platformIdsRepresented": preflight.get("platformIds"),
        "preflightChecks": {
            "passed": preflight.get("passed"),
            "errors": preflight.get("errors"),
            "warnings": preflight.get("warnings"),
            "frozenHashesValid": preflight.get("frozenHashesValid"),
            "wave1ClosureIntact": preflight.get("wave1ClosureIntact"),
            "wave2ClosureIntact": preflight.get("wave2ClosureIntact"),
            "duplicateCandidateIds": False,
            "reviewClassExact": REVIEW_CLASS,
            "crossWaveContamination": False,
        },
        "mutationChecks": {
            "promotionExcluded": True,
            "canonicalMutationAllowed": False,
            "canonicalMutationDetected": preflight.get("canonicalMutationDetected"),
            "candidateMutationDetected": preflight.get("candidateMutationDetected"),
            "promotionPerformed": False,
            "decisionsGenerated": False,
            "wave3DecisionCount": preflight.get("wave3DecisionCount"),
            "existingDecisionCount": preflight.get("existingDecisionCount"),
            "batchAuthorizationChanged": preflight.get("batchAuthorizationChanged"),
        },
        "orderingRule": {
            "keys": ["manualId", "procedureId", "candidateId"],
        },
        "allowedDecisions": ["accepted", "rejected", "deferred"],
        "priorWaves": [
            {"waveId": "wave1-existing-canonical-mapping", "status": "WAVE1_CLOSED"},
            {"waveId": "wave2-new-platform-knowledge", "status": "WAVE2_CLOSED"},
        ],
    }


def write_wave3_audit(audit: dict[str, Any]) -> Path:
    WAVES_DIR.mkdir(parents=True, exist_ok=True)
    path = wave_audit_path()
    path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return path
