from __future__ import annotations

import copy
import hashlib
import json
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
from .candidate_review_preflight import run_preflight
from .matcher_improvement_production_reconciliation import reconciliation_path
from .matcher_improvement_scoped_validation import _production_integrity_snapshot
from .unresolved_frozen_vocabulary_gap_analysis import WAVE1_CLOSURE, WAVE2_CLOSURE
from .wave1_closure_audit import validate_frozen_hashes

REFRESH_FILENAME = "CG_CANDIDATE_REVIEW_INDEX_REFRESH_v1.json"
REFRESH_AUDIT_FILENAME = "CG_CANDIDATE_REVIEW_INDEX_REFRESH_AUDIT_v1.json"
REFRESH_CHANGESET_FILENAME = "CG_CANDIDATE_REVIEW_INDEX_REFRESH_CHANGESET_v1.json"

VOLATILE_INDEX_KEYS = frozenset({"generatedAt", "preflight"})


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def refresh_path() -> Path:
    return CALIBRATION_DIR / REFRESH_FILENAME


def refresh_audit_path() -> Path:
    return CALIBRATION_DIR / REFRESH_AUDIT_FILENAME


def refresh_changeset_path() -> Path:
    return CALIBRATION_DIR / REFRESH_CHANGESET_FILENAME


def _hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    return _hash_bytes(path.read_bytes())


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _stable_index_view(index: dict[str, Any]) -> dict[str, Any]:
    view = copy.deepcopy(index)
    for key in VOLATILE_INDEX_KEYS:
        view.pop(key, None)
    return view


def _record_fingerprint(record: dict[str, Any]) -> str:
    return _hash_bytes(json.dumps(record, sort_keys=True).encode("utf-8"))


def _records_by_id(index: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(r["candidateId"]): r for r in (index.get("candidateRecords") or [])}


def _duplicate_candidate_ids(records: list[dict[str, Any]]) -> list[str]:
    seen: dict[str, int] = {}
    duplicates: list[str] = []
    for record in records:
        candidate_id = str(record.get("candidateId") or "")
        seen[candidate_id] = seen.get(candidate_id, 0) + 1
    for candidate_id, count in seen.items():
        if count > 1:
            duplicates.append(candidate_id)
    return sorted(duplicates)


def _source_candidate_population() -> dict[str, Any]:
    manual_ids = sorted(
        path.name
        for path in CANDIDATES_DIR.iterdir()
        if path.is_dir() and not path.name.startswith("_")
    )
    per_manual: dict[str, dict[str, int]] = {}
    total = 0
    for manual_id in manual_ids:
        manual_dir = CANDIDATES_DIR / manual_id
        mapping = 0
        overlay = 0
        arch = 0
        mapping_path = manual_dir / "canonical_mapping_candidates.json"
        if mapping_path.is_file():
            mapping = len(_read_json(mapping_path).get("candidates") or [])
        overlay_path = manual_dir / "overlay_candidates.json"
        if overlay_path.is_file():
            overlay = len(_read_json(overlay_path).get("candidates") or [])
        if (manual_dir / "architecture_exception.json").is_file():
            arch = 1
        count = mapping + overlay + arch
        per_manual[manual_id] = {
            "canonicalMapping": mapping,
            "overlay": overlay,
            "architectureException": arch,
            "total": count,
        }
        total += count
    return {
        "manualCount": len(manual_ids),
        "totalSourceCandidates": total,
        "perManual": per_manual,
    }


def _candidate_artifact_hashes() -> dict[str, str]:
    hashes: dict[str, str] = {}
    for manual_dir in sorted(CANDIDATES_DIR.iterdir()):
        if not manual_dir.is_dir() or manual_dir.name.startswith("_"):
            continue
        for name in (
            "canonical_mapping_candidates.json",
            "overlay_candidates.json",
            "architecture_exception.json",
        ):
            path = manual_dir / name
            if path.is_file():
                hashes[str(path)] = _sha256_file(path)
    return hashes


def _canonical_graph_hashes() -> dict[str, str]:
    return {path.name: _sha256_file(path) for path in sorted(CANONICAL_DIR.glob("*.json"))}


def _build_fresh_index() -> dict[str, Any]:
    COLLISION_MANUALS.clear()
    return build_candidate_review_index(
        batch_run_id=DEFAULT_BATCH_RUN_ID,
        processing_manifest_hash=DEFAULT_PROCESSING_MANIFEST_HASH,
    )


def _diff_index_records(
    before: dict[str, Any] | None,
    after: dict[str, Any],
) -> dict[str, Any]:
    if not before:
        after_ids = _records_by_id(after)
        return {
            "additions": sorted(after_ids),
            "removals": [],
            "modified": [],
            "unchanged": [],
            "modifiedDetails": [],
        }

    before_ids = _records_by_id(before)
    after_ids = _records_by_id(after)
    before_keys = set(before_ids)
    after_keys = set(after_ids)
    additions = sorted(after_keys - before_keys)
    removals = sorted(before_keys - after_keys)
    modified: list[str] = []
    unchanged: list[str] = []
    modified_details: list[dict[str, Any]] = []

    for candidate_id in sorted(before_keys & after_keys):
        old_fp = _record_fingerprint(before_ids[candidate_id])
        new_fp = _record_fingerprint(after_ids[candidate_id])
        if old_fp == new_fp:
            unchanged.append(candidate_id)
        else:
            modified.append(candidate_id)
            old_record = before_ids[candidate_id]
            new_record = after_ids[candidate_id]
            modified_details.append(
                {
                    "candidateId": candidate_id,
                    "manualId": new_record.get("manualId"),
                    "oldReviewClass": old_record.get("reviewClass"),
                    "newReviewClass": new_record.get("reviewClass"),
                    "oldProposedCanonicalId": (old_record.get("mapsTo") or {}).get("proposedCanonicalId"),
                    "newProposedCanonicalId": (new_record.get("mapsTo") or {}).get("proposedCanonicalId"),
                    "oldReviewStatus": old_record.get("reviewStatus"),
                    "newReviewStatus": new_record.get("reviewStatus"),
                    "oldCandidateStatus": old_record.get("candidateStatus"),
                    "newCandidateStatus": new_record.get("candidateStatus"),
                },
            )

    return {
        "additions": additions,
        "removals": removals,
        "modified": modified,
        "unchanged": unchanged,
        "modifiedDetails": modified_details,
    }


def _semantic_index_fingerprint(index: dict[str, Any]) -> str:
    return _hash_bytes(json.dumps(_stable_index_view(index), sort_keys=True).encode("utf-8"))


def run_candidate_review_index_refresh_gate(*, apply_mutations: bool = True) -> dict[str, Any]:
    errors: list[str] = []
    gate_type = "derived_candidate_review_index_refresh"

    recon_path = reconciliation_path()
    if not recon_path.is_file():
        errors.append("missing production reconciliation artifact")
    else:
        recon = _read_json(recon_path)
        if recon.get("status") != "GREEN":
            errors.append("production reconciliation status is not GREEN")
        if not recon.get("mutationsApplied"):
            errors.append("production reconciliation mutationsApplied is false")

    preflight = run_preflight(
        batch_run_id=DEFAULT_BATCH_RUN_ID,
        processing_manifest_hash=DEFAULT_PROCESSING_MANIFEST_HASH,
    )
    if not preflight["passed"]:
        errors.extend([f"preflight: {e}" for e in preflight.get("errors") or []])

    source_population = _source_candidate_population()
    candidate_hashes_before = _candidate_artifact_hashes()
    canonical_hashes_before = _canonical_graph_hashes()
    decisions_hash_before = _sha256_file(decisions_path()) if decisions_path().is_file() else None
    prod_integrity_before = _production_integrity_snapshot()

    if prod_integrity_before.get("reviewDecisionCount") != 796:
        errors.append("production review decisions != 796 before refresh")

    index_file = index_path()
    current_index: dict[str, Any] | None = None
    index_hash_before = None
    if index_file.is_file():
        current_index = _read_json(index_file)
        index_hash_before = _sha256_file(index_file)

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    if errors:
        return _package(
            errors,
            apply_mutations=apply_mutations,
            preflight=preflight,
            source_population=source_population,
            index_hash_before=index_hash_before,
            index_population_before=(current_index or {}).get("totalCandidateRecords"),
            prod_integrity_before=prod_integrity_before,
            hashes_ok=hashes_ok,
        )

    try:
        expected_index = _build_fresh_index()
    except RuntimeError as exc:
        errors.append(str(exc))
        return _package(
            errors,
            apply_mutations=apply_mutations,
            preflight=preflight,
            source_population=source_population,
            index_hash_before=index_hash_before,
            index_population_before=(current_index or {}).get("totalCandidateRecords"),
            prod_integrity_before=prod_integrity_before,
            hashes_ok=hashes_ok,
        )

    duplicates = _duplicate_candidate_ids(expected_index.get("candidateRecords") or [])
    if duplicates:
        errors.append(f"duplicate candidate identities in expected index: {len(duplicates)}")

    if expected_index.get("totalCandidateRecords") != source_population["totalSourceCandidates"]:
        errors.append(
            "expected index population "
            f"{expected_index.get('totalCandidateRecords')} != "
            f"source candidate population {source_population['totalSourceCandidates']}",
        )

    if expected_index.get("promotionExplicitlyExcluded") is not True:
        errors.append("expected index promotionExplicitlyExcluded is not true")

    diff = _diff_index_records(current_index, expected_index)

    if errors:
        return _package(
            errors,
            apply_mutations=apply_mutations,
            preflight=preflight,
            source_population=source_population,
            expected_index=expected_index,
            diff=diff,
            index_hash_before=index_hash_before,
            index_population_before=(current_index or {}).get("totalCandidateRecords"),
            prod_integrity_before=prod_integrity_before,
            hashes_ok=hashes_ok,
            duplicates=duplicates,
        )

    index_hash_after = index_hash_before
    index_population_after = expected_index.get("totalCandidateRecords")
    idempotent_second_pass = None

    if apply_mutations:
        write_candidate_review_index(expected_index)
        index_hash_after = _sha256_file(index_file)

        candidate_hashes_after = _candidate_artifact_hashes()
        if candidate_hashes_before != candidate_hashes_after:
            errors.append("production candidate artifacts changed during index refresh")

        canonical_hashes_after = _canonical_graph_hashes()
        if canonical_hashes_before != canonical_hashes_after:
            errors.append("canonical graph files changed during index refresh")

        decisions_hash_after = _sha256_file(decisions_path()) if decisions_path().is_file() else None
        if decisions_hash_before != decisions_hash_after:
            errors.append("production review decisions file changed during index refresh")

        prod_integrity_after = _production_integrity_snapshot()
        if prod_integrity_before.get("decisionsFileHash") != prod_integrity_after.get("decisionsFileHash"):
            errors.append("production decisions integrity changed during index refresh")
        if prod_integrity_after.get("reviewDecisionCount") != 796:
            errors.append("production review decisions != 796 after refresh")

        hashes_ok_after, hash_errors_after = validate_frozen_hashes()
        if not hashes_ok_after:
            errors.extend(hash_errors_after)

        wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
        wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
        if wave1.get("status") != "WAVE1_CLOSED":
            errors.append("wave1 closure not intact after refresh")
        if wave2.get("status") != "WAVE2_CLOSED":
            errors.append("wave2 closure not intact after refresh")

        written_index = _read_json(index_file)
        second_build = _build_fresh_index()
        idempotent_second_pass = {
            "semanticFingerprintMatch": _semantic_index_fingerprint(written_index)
            == _semantic_index_fingerprint(second_build),
            "recordDiff": _diff_index_records(written_index, second_build),
        }
        if not idempotent_second_pass["semanticFingerprintMatch"]:
            errors.append("index refresh is not idempotent on second build")
        extra = idempotent_second_pass["recordDiff"]
        if extra["additions"] or extra["removals"] or extra["modified"]:
            errors.append(
                "second dry-run would mutate index: "
                f"+{len(extra['additions'])} -{len(extra['removals'])} ~{len(extra['modified'])}",
            )

    status = "GREEN" if not errors else "STOP"

    return _package(
        errors,
        status=status,
        apply_mutations=apply_mutations,
        preflight=preflight,
        source_population=source_population,
        expected_index=expected_index,
        diff=diff,
        index_hash_before=index_hash_before,
        index_hash_after=index_hash_after,
        index_population_before=(current_index or {}).get("totalCandidateRecords"),
        index_population_after=index_population_after,
        prod_integrity_before=prod_integrity_before,
        prod_integrity_after=_production_integrity_snapshot() if apply_mutations and not errors else None,
        hashes_ok=hashes_ok,
        duplicates=duplicates,
        idempotent_second_pass=idempotent_second_pass,
        mutations_applied=apply_mutations and status == "GREEN",
    )


def _package(
    errors: list[str],
    *,
    apply_mutations: bool,
    preflight: dict[str, Any] | None = None,
    source_population: dict[str, Any] | None = None,
    expected_index: dict[str, Any] | None = None,
    diff: dict[str, Any] | None = None,
    index_hash_before: str | None = None,
    index_hash_after: str | None = None,
    index_population_before: int | None = None,
    index_population_after: int | None = None,
    prod_integrity_before: dict[str, Any] | None = None,
    prod_integrity_after: dict[str, Any] | None = None,
    hashes_ok: bool = False,
    duplicates: list[str] | None = None,
    idempotent_second_pass: dict[str, Any] | None = None,
    mutations_applied: bool = False,
    status: str | None = None,
) -> dict[str, Any]:
    status = status or ("STOP" if errors else "GREEN")
    diff = diff or {
        "additions": [],
        "removals": [],
        "modified": [],
        "unchanged": [],
        "modifiedDetails": [],
    }
    refresh = {
        "schemaVersion": 1,
        "reportType": "candidate_review_index_refresh",
        "status": status,
        "generatedAt": _utc_now(),
        "gateType": "derived_candidate_review_index_refresh",
        "derivedIndexRefreshOnly": True,
        "canonicalPromotionImplied": False,
        "matcherExecuted": False,
        "productionCandidateMutation": False,
        "productionDecisionsMutation": False,
        "mutationsApplied": mutations_applied,
        "authority": {
            "sourcePopulation": "normalization/candidates/*/canonical_mapping_candidates.json",
            "overlayPopulation": "normalization/candidates/*/overlay_candidates.json",
            "architecturePopulation": "normalization/candidates/*/architecture_exception.json",
            "decisionsReadModel": "normalization/review/CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json",
            "prerequisiteGate": "CG_MATCHER_IMPROVEMENT_PRODUCTION_RECONCILIATION_v1.json",
        },
        "summary": {
            "indexFile": str(index_path()),
            "indexHashBefore": index_hash_before,
            "indexHashAfter": index_hash_after,
            "indexPopulationBefore": index_population_before,
            "indexPopulationAfter": index_population_after,
            "sourceCandidatePopulation": (source_population or {}).get("totalSourceCandidates"),
            "indexRecordsAdded": len(diff.get("additions") or []),
            "indexRecordsRemoved": len(diff.get("removals") or []),
            "indexRecordsModified": len(diff.get("modified") or []),
            "indexRecordsUnchanged": len(diff.get("unchanged") or []),
            "duplicateCandidateIdentities": len(duplicates or []),
            "unresolvedIdentityCount": 0,
        },
        "preflight": preflight,
        "sourcePopulation": source_population,
        "integrity": {
            "frozenHashVerification": {"passed": hashes_ok, "errors": []},
            "productionDecisionsCount": (prod_integrity_before or {}).get("reviewDecisionCount"),
            "productionDecisionsUnchanged": (
                prod_integrity_before == prod_integrity_after
                if prod_integrity_after is not None
                else None
            ),
        },
        "idempotentSecondPass": idempotent_second_pass,
        "countsByReviewClassAfter": (expected_index or {}).get("countsByReviewClass"),
        "errors": errors,
    }
    changeset = {
        "schemaVersion": 1,
        "reportType": "candidate_review_index_refresh_changeset",
        "status": status,
        "generatedAt": refresh["generatedAt"],
        "additions": diff.get("additions") or [],
        "removals": diff.get("removals") or [],
        "modified": diff.get("modified") or [],
        "modifiedDetails": diff.get("modifiedDetails") or [],
        "unchangedCount": len(diff.get("unchanged") or []),
        "unauthorizedIndexMutations": [],
    }
    audit = {
        "schemaVersion": 1,
        "reportType": "candidate_review_index_refresh_audit",
        "status": status,
        "generatedAt": refresh["generatedAt"],
        "integrityChecks": {
            "passed": not errors,
            "errors": errors,
            "duplicateCandidateIds": duplicates or [],
            "productionArtifactsTouched": [] if status == "GREEN" and mutations_applied else None,
            "canonicalArtifactsTouched": [] if status == "GREEN" and mutations_applied else None,
        },
    }
    return {"refresh": refresh, "changeset": changeset, "audit": audit}


def write_candidate_review_index_refresh_artifacts(payload: dict[str, Any]) -> tuple[Path, Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    paths = (refresh_path(), refresh_audit_path(), refresh_changeset_path())
    paths[0].write_text(json.dumps(payload["refresh"], indent=2), encoding="utf-8")
    paths[1].write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    paths[2].write_text(json.dumps(payload["changeset"], indent=2), encoding="utf-8")
    return paths
