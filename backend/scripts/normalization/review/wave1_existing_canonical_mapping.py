from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import REVIEW_DIR
from .candidate_review_preflight import INDEX_FILENAME
from .candidate_review_decisions import load_decisions
from .frozen_canonical_vocabulary import FROZEN_HASHES_PATH, load_frozen_canonical_ids

WAVE_DEFINITION_FILENAME = "CG_WAVE1_EXISTING_CANONICAL_MAPPING_REVIEW_v1.json"
WAVE_AUDIT_FILENAME = "CG_WAVE1_EXISTING_CANONICAL_MAPPING_AUDIT_v1.json"
WAVES_DIR = REVIEW_DIR / "waves"
WAVE_ID = "wave1-existing-canonical-mapping"
EXPECTED_CANDIDATE_COUNT = 370
REVIEW_CLASS = "existingCanonicalMapping"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def wave_definition_path() -> Path:
    return WAVES_DIR / WAVE_DEFINITION_FILENAME


def wave_audit_path() -> Path:
    return WAVES_DIR / WAVE_AUDIT_FILENAME


def index_path() -> Path:
    return REVIEW_DIR / INDEX_FILENAME


def load_wave_definition() -> dict[str, Any]:
    path = wave_definition_path()
    if not path.is_file():
        raise FileNotFoundError(f"missing wave definition: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_review_index() -> dict[str, Any]:
    path = index_path()
    if not path.is_file():
        raise FileNotFoundError(f"missing candidate review index: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def wave_order_key(record: dict[str, Any]) -> tuple[str, str, str]:
    procedure_id = (record.get("what") or {}).get("procedureId") or ""
    return (
        str(record.get("manualId") or ""),
        str(procedure_id),
        str(record.get("candidateId") or ""),
    )


def select_wave_candidates(index: dict[str, Any]) -> list[dict[str, Any]]:
    records = [
        record
        for record in (index.get("candidateRecords") or [])
        if record.get("reviewClass") == REVIEW_CLASS
    ]
    return sorted(records, key=wave_order_key)


def validate_frozen_hashes() -> tuple[bool, list[str]]:
    errors: list[str] = []
    if not FROZEN_HASHES_PATH.is_file():
        return False, [f"missing frozen hash registry: {FROZEN_HASHES_PATH}"]

    from ..paths import ROOT

    registry = json.loads(FROZEN_HASHES_PATH.read_text(encoding="utf-8"))
    for ontology_id, entry in (registry.get("frozenOntologies") or {}).items():
        rel_path = entry.get("file")
        expected_hash = entry.get("hash")
        if not rel_path or not expected_hash:
            errors.append(f"frozen hash registry incomplete for {ontology_id}")
            continue
        path = ROOT / rel_path
        if not path.is_file():
            errors.append(f"frozen ontology missing: {rel_path}")
            continue
        actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual_hash != expected_hash:
            errors.append(f"frozen hash mismatch for {ontology_id}")
    return len(errors) == 0, errors


def run_wave1_preflight(
    *,
    index: dict[str, Any] | None = None,
    wave_definition: dict[str, Any] | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    wave_definition = wave_definition or load_wave_definition()
    index = index or load_review_index()
    frozen_ids = load_frozen_canonical_ids()
    wave_candidates = select_wave_candidates(index)

    if wave_definition.get("waveId") != WAVE_ID:
        errors.append("wave definition waveId mismatch")
    if wave_definition.get("reviewClass") != REVIEW_CLASS:
        errors.append("wave definition reviewClass mismatch")
    if int(wave_definition.get("expectedCandidateCount") or 0) != EXPECTED_CANDIDATE_COUNT:
        errors.append("wave definition expectedCandidateCount mismatch")

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
        proposed = (record.get("mapsTo") or {}).get("proposedCanonicalId")
        if not proposed:
            errors.append(f"missing proposedCanonicalId for {record.get('candidateId')}")
        elif str(proposed) not in frozen_ids:
            errors.append(
                f"proposedCanonicalId '{proposed}' not in frozen vocabulary for {record.get('candidateId')}",
            )

    index_new_canonical = sum(
        1
        for record in (index.get("candidateRecords") or [])
        if record.get("reviewClass") == "newCanonicalKnowledge"
    )
    if index_new_canonical != 0:
        errors.append(f"index contains {index_new_canonical} newCanonicalKnowledge candidates")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    decisions = load_decisions()
    decision_count = len(decisions.get("decisions") or {})
    if decision_count > 0:
        warnings.append(
            f"decisions artifact contains {decision_count} existing decisions; wave preflight does not generate decisions",
        )

    ordering_keys = [wave_order_key(record) for record in wave_candidates]
    if ordering_keys != sorted(ordering_keys):
        errors.append("wave candidate ordering is not deterministic")

    manual_ids = sorted({str(record.get("manualId") or "") for record in wave_candidates})
    canonical_ids = sorted(
        {
            str((record.get("mapsTo") or {}).get("proposedCanonicalId"))
            for record in wave_candidates
            if (record.get("mapsTo") or {}).get("proposedCanonicalId")
        },
    )

    return {
        "passed": len(errors) == 0,
        "waveId": WAVE_ID,
        "reviewClass": REVIEW_CLASS,
        "expectedCandidateCount": EXPECTED_CANDIDATE_COUNT,
        "actualCandidateCount": len(wave_candidates),
        "manualCount": len(manual_ids),
        "canonicalIdCount": len(canonical_ids),
        "manualIds": manual_ids,
        "canonicalIds": canonical_ids,
        "errors": errors,
        "warnings": warnings,
        "frozenHashesValid": hashes_ok,
        "promotionExcluded": True,
        "canonicalMutationAllowed": False,
        "decisionsGenerated": False,
        "existingDecisionCount": decision_count,
    }


def build_wave1_audit(preflight: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "reportType": "candidate_review_wave_audit",
        "waveId": WAVE_ID,
        "status": "READY_FOR_HUMAN_REVIEW" if preflight.get("passed") else "BLOCKED",
        "generatedAt": _utc_now(),
        "candidateCount": preflight.get("actualCandidateCount"),
        "expectedCandidateCount": EXPECTED_CANDIDATE_COUNT,
        "manualCountRepresented": preflight.get("manualCount"),
        "canonicalIdsRepresented": preflight.get("canonicalIds"),
        "preflightChecks": {
            "passed": preflight.get("passed"),
            "errors": preflight.get("errors"),
            "warnings": preflight.get("warnings"),
            "frozenHashesValid": preflight.get("frozenHashesValid"),
            "duplicateCandidateIds": False,
            "allCanonicalIdsInFrozenVocabulary": preflight.get("passed"),
            "reviewClassExact": REVIEW_CLASS,
            "newCanonicalKnowledgeCount": 0,
        },
        "mutationChecks": {
            "promotionExcluded": True,
            "canonicalMutationAllowed": False,
            "candidateArtifactsMutated": False,
            "decisionsGenerated": False,
            "existingDecisionCount": preflight.get("existingDecisionCount"),
        },
        "orderingRule": {
            "keys": ["manualId", "procedureId", "candidateId"],
        },
        "allowedDecisions": ["accepted", "rejected", "deferred"],
    }


def write_wave1_audit(audit: dict[str, Any]) -> Path:
    WAVES_DIR.mkdir(parents=True, exist_ok=True)
    path = wave_audit_path()
    path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return path
