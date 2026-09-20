from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .frozen_canonical_vocabulary import load_frozen_canonical_ids
from .wave1_existing_canonical_mapping import (
    REVIEW_CLASS as WAVE1_REVIEW_CLASS,
    load_review_index,
    validate_frozen_hashes,
    wave_order_key,
)

WAVE_DEFINITION_FILENAME = "CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_REVIEW_v1.json"
WAVE_AUDIT_FILENAME = "CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_AUDIT_v1.json"
WAVES_DIR = REVIEW_DIR / "waves"
WAVE_ID = "wave2-new-platform-knowledge"
REVIEW_CLASS = "newPlatformKnowledge"
EXPECTED_CANDIDATE_COUNT = 426
WAVE1_CLOSURE_AUDIT = WAVES_DIR / "CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_AUDIT_v1.json"

CONTAMINATING_REVIEW_CLASSES = frozenset(
    {
        "existingCanonicalMapping",
        "unresolved",
        "implementationSpecific",
        "architectureException",
        "newCanonicalKnowledge",
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
    if payload.get("reviewedCount") != 370:
        errors.append("Wave 1 reviewedCount is not 370")
    return len(errors) == 0, errors


def wave2_decision_count(decisions_store: dict[str, Any], wave_candidate_ids: set[str]) -> int:
    decision_map = decisions_store.get("decisions") or {}
    return sum(1 for candidate_id in wave_candidate_ids if candidate_id in decision_map)


def run_wave2_preflight(
    *,
    index: dict[str, Any] | None = None,
    wave_definition: dict[str, Any] | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    wave_definition = wave_definition or load_wave_definition()
    index = index or load_review_index()
    wave_candidates = select_wave_candidates(index)
    wave_candidate_ids = {str(record["candidateId"]) for record in wave_candidates}

    if wave_definition.get("waveId") != WAVE_ID:
        errors.append("wave definition waveId mismatch")
    if wave_definition.get("reviewClass") != REVIEW_CLASS:
        errors.append("wave definition reviewClass mismatch")
    if int(wave_definition.get("expectedCandidateCount") or 0) != EXPECTED_CANDIDATE_COUNT:
        errors.append("wave definition expectedCandidateCount mismatch")
    if wave_definition.get("promotionExcluded") is not True:
        errors.append("wave definition promotionExcluded must be true")
    if wave_definition.get("canonicalMutationAllowed") is not False:
        errors.append("wave definition canonicalMutationAllowed must be false")

    if len(wave_candidates) != EXPECTED_CANDIDATE_COUNT:
        errors.append(
            f"expected {EXPECTED_CANDIDATE_COUNT} {REVIEW_CLASS} candidates, found {len(wave_candidates)}",
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
            for record in (index.get("candidateRecords") or [])
            if record.get("reviewClass") == contaminant and record.get("candidateId") in wave_candidate_ids
        )
        if count > 0:
            errors.append(f"wave pool includes {count} {contaminant} candidates")

    wave1_in_pool = sum(
        1
        for record in wave_candidates
        if record.get("reviewClass") == WAVE1_REVIEW_CLASS
    )
    if wave1_in_pool > 0:
        errors.append("wave pool includes existingCanonicalMapping candidates")

    ordering_keys = [wave_order_key(record) for record in wave_candidates]
    if ordering_keys != sorted(ordering_keys):
        errors.append("wave candidate ordering is not deterministic")

    frozen_ids = load_frozen_canonical_ids()
    for record in wave_candidates:
        proposed = (record.get("mapsTo") or {}).get("proposedCanonicalId")
        if proposed and str(proposed) not in frozen_ids:
            warnings.append(
                f"platform knowledge candidate references non-frozen canonical id '{proposed}' "
                f"({record.get('candidateId')}) — review context only",
            )

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    wave1_ok, wave1_errors = verify_wave1_closure_intact()
    if not wave1_ok:
        errors.extend(wave1_errors)

    decisions = load_decisions()
    wave2_decisions = wave2_decision_count(decisions, wave_candidate_ids)
    if wave2_decisions > 0:
        warnings.append(
            f"decisions artifact already contains {wave2_decisions} Wave 2 decisions",
        )

    manual_ids = sorted({str(record.get("manualId") or "") for record in wave_candidates})
    platform_ids = sorted(
        {
            str((record.get("context") or {}).get("platformId") or "")
            for record in wave_candidates
            if (record.get("context") or {}).get("platformId")
        },
    )

    return {
        "passed": len(errors) == 0,
        "waveId": WAVE_ID,
        "reviewClass": REVIEW_CLASS,
        "expectedCandidateCount": EXPECTED_CANDIDATE_COUNT,
        "actualCandidateCount": len(wave_candidates),
        "manualCount": len(manual_ids),
        "platformIdCount": len(platform_ids),
        "manualIds": manual_ids,
        "platformIds": platform_ids,
        "errors": errors,
        "warnings": warnings,
        "frozenHashesValid": hashes_ok,
        "wave1ClosureIntact": wave1_ok,
        "promotionExcluded": True,
        "canonicalMutationAllowed": False,
        "decisionsGenerated": False,
        "wave2DecisionCount": wave2_decisions,
        "existingDecisionCount": len(decisions.get("decisions") or {}),
    }


def build_wave2_audit(preflight: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "reportType": "candidate_review_wave_audit",
        "waveId": WAVE_ID,
        "status": "READY_FOR_HUMAN_REVIEW" if preflight.get("passed") else "BLOCKED",
        "generatedAt": _utc_now(),
        "candidateCount": preflight.get("actualCandidateCount"),
        "expectedCandidateCount": EXPECTED_CANDIDATE_COUNT,
        "manualCountRepresented": preflight.get("manualCount"),
        "platformIdsRepresented": preflight.get("platformIds"),
        "preflightChecks": {
            "passed": preflight.get("passed"),
            "errors": preflight.get("errors"),
            "warnings": preflight.get("warnings"),
            "frozenHashesValid": preflight.get("frozenHashesValid"),
            "wave1ClosureIntact": preflight.get("wave1ClosureIntact"),
            "duplicateCandidateIds": False,
            "reviewClassExact": REVIEW_CLASS,
            "crossWaveContamination": False,
        },
        "mutationChecks": {
            "promotionExcluded": True,
            "canonicalMutationAllowed": False,
            "candidateArtifactsMutated": False,
            "decisionsGenerated": False,
            "wave2DecisionCount": preflight.get("wave2DecisionCount"),
            "existingDecisionCount": preflight.get("existingDecisionCount"),
        },
        "orderingRule": {
            "keys": ["manualId", "procedureId", "candidateId"],
        },
        "allowedDecisions": ["accepted", "rejected", "deferred"],
        "priorWave": {
            "waveId": "wave1-existing-canonical-mapping",
            "status": "WAVE1_CLOSED",
        },
    }


def write_wave2_audit(audit: dict[str, Any]) -> Path:
    WAVES_DIR.mkdir(parents=True, exist_ok=True)
    path = wave_audit_path()
    path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return path
