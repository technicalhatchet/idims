from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from .paths import CANDIDATES_DIR, MANIFEST_PATH, REVIEW_DIR
    from .pilot_batch import _classify_manual_slot
    from .lifecycle import NormalizationLifecycleError
    from .pipeline import find_manual_entry, load_manifest, run_manual_normalization
except ImportError:  # pragma: no cover - direct script execution
    from lifecycle import NormalizationLifecycleError
    from paths import CANDIDATES_DIR, MANIFEST_PATH, REVIEW_DIR
    from pilot_batch import _classify_manual_slot
    from pipeline import find_manual_entry, load_manifest, run_manual_normalization

REPO_ROOT = Path(__file__).resolve().parents[3]
CALIBRATION_DIR = (
    REPO_ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "knowledge"
    / "normalization"
    / "calibration"
)
COHORT_PATH = CALIBRATION_DIR / "CG_PRODUCTION_NORMALIZATION_BATCH_COHORT_v1.json"
CONTRACT_PATH = CALIBRATION_DIR / "CG_PRODUCTION_NORMALIZATION_BATCH_CONTRACT_v1.json"
EXECUTION_LOCK_PATH = CALIBRATION_DIR / "CG_PRODUCTION_NORMALIZATION_BATCH_EXECUTION_LOCK_v1.json"
PILOT_RESULTS_PATH = CALIBRATION_DIR / "CG_PRODUCTION_NORMALIZATION_PILOT_RESULTS_v1.json"
BATCH_AUDIT_DIR = CALIBRATION_DIR / "batch_runs"
HUMAN_REVIEW_QUEUE_PATH = REVIEW_DIR / "batch_human_review_queue.json"

CONTENT_HASH_FILES = (
    "canonical_mapping_candidates.json",
    "overlay_candidates.json",
    "conflicts.json",
    "normalized_procedures.json",
    "architecture_exception.json",
    "pipeline_manifest.json",
)

PILOT_BASELINE_MANUAL_IDS = frozenset(
    {
        "W11169652",
        "SAMSUNG-FL-BB8700-WASHER",
        "LG-FL-WASHER",
        "W11746350",
        "SAMSUNG-NE58H-INDUCTION-RANGE",
        "LG-LMHM2237-MICROWAVE",
        "SAMSUNG-HP-DRYER-DV22N",
        "SAMSUNG-FLEXWASH-WASHER",
    }
)


class BatchAuthorizationError(RuntimeError):
    """Raised when batch execution is not authorized via locked execution artifact."""


class BatchManifestFreezeError(RuntimeError):
    """Raised when cohort/manifest freeze verification fails."""


class FrozenHashMutationError(RuntimeError):
    """Raised when frozen canonical hashes change during a batch run."""


class PilotBaselineOverwriteError(RuntimeError):
    """Raised when a pilot baseline manual would be silently overwritten."""


class BatchNormalizationError(RuntimeError):
    """Raised when normalization fails for a cohort manual."""


NormalizeManualFn = Callable[[dict[str, Any]], dict[str, Any]]
ManifestLoaderFn = Callable[[], dict[str, Any]]


@dataclass
class BatchRunOptions:
    cohort_path: Path = COHORT_PATH
    execution_lock_path: Path = EXECUTION_LOCK_PATH
    manifest_path: Path = MANIFEST_PATH
    dry_run: bool = False
    skip_auth: bool = False
    resume_batch_run_id: str | None = None
    resume_authorization_path: Path | None = None
    force_manual_ids: frozenset[str] = field(default_factory=frozenset)
    max_manuals: int | None = None
    write_artifacts: bool = True
    normalize_manual_fn: NormalizeManualFn | None = None
    manifest_loader_fn: ManifestLoaderFn | None = None


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _candidate_dir(manual_id: str) -> Path:
    return CANDIDATES_DIR / manual_id


def compute_manifest_hash(manifest_path: Path = MANIFEST_PATH) -> str:
    if not manifest_path.is_file():
        raise BatchManifestFreezeError(f"manifest missing: {manifest_path}")
    return sha256_file(manifest_path)


def compute_cohort_hash(cohort_path: Path = COHORT_PATH) -> str:
    if not cohort_path.is_file():
        raise BatchManifestFreezeError(f"cohort artifact missing: {cohort_path}")
    return sha256_file(cohort_path)


def build_batch_run_id(cohort_hash: str, started_at: datetime | None = None) -> str:
    started = started_at or datetime.now(timezone.utc)
    date_part = started.strftime("%Y%m%d")
    return f"batch-{date_part}-{cohort_hash[:8]}"


def default_resume_authorization_path(batch_run_id: str) -> Path:
    return CALIBRATION_DIR / f"CG_PRODUCTION_NORMALIZATION_BATCH_RESUME_AUTHORIZATION_{batch_run_id}.json"


def load_resume_authorization(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise BatchManifestFreezeError(f"missing resume authorization artifact: {path.name}")
    return _read_json(path)


def _load_git_manifest_at_commit(commit: str, manifest_path: Path) -> dict[str, Any]:
    relative_path = manifest_path.relative_to(REPO_ROOT).as_posix()
    try:
        payload = subprocess.check_output(
            ["git", "show", f"{commit}:{relative_path}"],
            cwd=REPO_ROOT,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError as exc:
        raise BatchManifestFreezeError(
            f"unable to load baseline manifest at {commit} — HARD STOP",
        ) from exc
    return json.loads(payload.decode("utf-8"))


def verify_authorized_manifest_delta(
    manifest_path: Path,
    observation_manifest_hash: str,
    allowed_delta: dict[str, Any],
    *,
    remediation_commit: str | None = None,
) -> None:
    manifest = _read_json(manifest_path)
    allowed_manual_ids = {str(manual_id) for manual_id in allowed_delta.get("manualIds") or []}
    allowed_fields = {str(field_name) for field_name in allowed_delta.get("addedFields") or []}
    if not allowed_manual_ids and not allowed_fields:
        if sha256_file(manifest_path) != observation_manifest_hash:
            raise BatchManifestFreezeError(
                "resume manifest hash mismatch with no authorized delta — HARD STOP",
            )
        return
    if not allowed_manual_ids or not allowed_fields:
        raise BatchManifestFreezeError("resume allowedManifestDelta incomplete — HARD STOP")

    for entry in manifest.get("manuals", []):
        manual_id = str(entry.get("manualId"))
        for field_name in allowed_fields:
            if field_name in entry and manual_id not in allowed_manual_ids:
                raise BatchManifestFreezeError(
                    f"unauthorized manifest delta: {field_name} on {manual_id} — HARD STOP",
                )

    for manual_id in allowed_manual_ids:
        entry = next(
            (item for item in manifest.get("manuals", []) if str(item.get("manualId")) == manual_id),
            None,
        )
        if entry is None:
            raise BatchManifestFreezeError(f"authorized delta manual missing: {manual_id} — HARD STOP")
        for field_name in allowed_fields:
            if field_name not in entry:
                raise BatchManifestFreezeError(
                    f"authorized delta missing {field_name} on {manual_id} — HARD STOP",
                )

    if remediation_commit:
        baseline_manifest = _load_git_manifest_at_commit(f"{remediation_commit}^", manifest_path)
    else:
        baseline_manifest = json.loads(json.dumps(manifest))
        for entry in baseline_manifest.get("manuals", []):
            if str(entry.get("manualId")) in allowed_manual_ids:
                for field_name in allowed_fields:
                    entry.pop(field_name, None)

    baseline_by_id = {
        str(entry.get("manualId")): entry for entry in baseline_manifest.get("manuals", [])
    }
    current_by_id = {str(entry.get("manualId")): entry for entry in manifest.get("manuals", [])}
    if set(baseline_by_id) != set(current_by_id):
        raise BatchManifestFreezeError("manifest manual inventory changed — HARD STOP")

    for manual_id, baseline_entry in baseline_by_id.items():
        current_entry = current_by_id[manual_id]
        if manual_id in allowed_manual_ids:
            extra_keys = set(current_entry) - set(baseline_entry)
            if not extra_keys <= allowed_fields:
                raise BatchManifestFreezeError(
                    f"unauthorized manifest delta keys on {manual_id} — HARD STOP",
                )
            for key, value in baseline_entry.items():
                if current_entry.get(key) != value:
                    raise BatchManifestFreezeError(
                        f"unauthorized manifest mutation on {manual_id}.{key} — HARD STOP",
                    )
        elif baseline_entry != current_entry:
            raise BatchManifestFreezeError(
                f"unauthorized manifest mutation on {manual_id} — HARD STOP",
            )

    snapshot_name = allowed_delta.get("observationManifestSnapshotArtifact")
    if snapshot_name:
        snapshot_path = CALIBRATION_DIR / str(snapshot_name)
        if not snapshot_path.is_file():
            raise BatchManifestFreezeError(
                f"missing observation manifest snapshot: {snapshot_name} — HARD STOP",
            )
        if sha256_file(snapshot_path) != observation_manifest_hash:
            raise BatchManifestFreezeError(
                "observation manifest snapshot hash mismatch — HARD STOP",
            )
        stripped = json.loads(json.dumps(manifest))
        for entry in stripped.get("manuals", []):
            if str(entry.get("manualId")) in allowed_manual_ids:
                for field_name in allowed_fields:
                    entry.pop(field_name, None)
        with tempfile.TemporaryDirectory() as tmp_dir:
            stripped_path = Path(tmp_dir) / "manifest.json"
            _write_json(stripped_path, stripped)
            if sha256_file(stripped_path) != sha256_file(snapshot_path):
                raise BatchManifestFreezeError(
                    "manifest delta exceeds authorized resume baseline — HARD STOP",
                )


def _verify_flexwash_clearance_artifacts(clearance: dict[str, Any]) -> None:
    contract_name = str(clearance.get("frozenContract") or "")
    closure_name = str(clearance.get("freezeClosure") or "")
    historical_artifact = str(clearance.get("historicalArtifact") or "")
    if not contract_name or not closure_name or not historical_artifact:
        raise BatchManifestFreezeError("FlexWash clearance incomplete — HARD STOP")

    contract_path = CALIBRATION_DIR / contract_name
    closure_path = CALIBRATION_DIR / closure_name
    historical_path = (
        REPO_ROOT
        / "frontend"
        / "components"
        / "diagnostics"
        / "knowledge"
        / historical_artifact
    )
    if not contract_path.is_file():
        raise BatchManifestFreezeError(f"missing frozen contract: {contract_name}")
    if not closure_path.is_file():
        raise BatchManifestFreezeError(f"missing freeze closure: {closure_name}")
    if not historical_path.is_file():
        raise BatchManifestFreezeError(f"missing historical artifact: {historical_artifact}")

    contract = _read_json(contract_path)
    closure = _read_json(closure_path)
    if contract.get("status") != "frozen":
        raise BatchManifestFreezeError("FlexWash frozen contract not frozen — HARD STOP")
    if closure.get("status") != "closed_successful":
        raise BatchManifestFreezeError("FlexWash freeze closure not closed_successful — HARD STOP")


def _verify_architecture_exception_clearance(
    clearance: dict[str, Any],
    checkpoint: dict[str, Any],
) -> None:
    manual_id = str(clearance.get("manualId") or "")
    prior = next(
        (audit for audit in checkpoint.get("manualAudits", []) if audit.get("manualId") == manual_id),
        None,
    )
    if prior is None:
        raise BatchManifestFreezeError(f"clearance manual not in checkpoint: {manual_id}")
    if prior.get("batchState") != clearance.get("historicalBatchState"):
        raise BatchManifestFreezeError(f"clearance historical batchState mismatch for {manual_id}")
    if prior.get("primaryDisposition") != clearance.get("historicalPrimaryDisposition"):
        raise BatchManifestFreezeError(f"clearance historical disposition mismatch for {manual_id}")
    if clearance.get("reNormalize"):
        raise BatchManifestFreezeError(f"clearance reNormalize must be false for {manual_id}")
    if manual_id == "SAMSUNG-FLEXWASH-WASHER":
        _verify_flexwash_clearance_artifacts(clearance)


def validate_resume_authorization(
    resume_auth: dict[str, Any],
    *,
    batch_run_id: str,
    checkpoint: dict[str, Any],
    manifest_path: Path,
    cohort_hash: str,
    processing_manifest_hash: str,
    resume_auth_path: Path,
) -> dict[str, Any]:
    if resume_auth.get("batchRunId") != batch_run_id:
        raise BatchManifestFreezeError("resume authorization batchRunId mismatch — HARD STOP")
    if resume_auth.get("cohortHash") != cohort_hash:
        raise BatchManifestFreezeError("resume authorization cohortHash mismatch — HARD STOP")
    if resume_auth.get("cohortHash") != checkpoint.get("cohortHash"):
        raise BatchManifestFreezeError("resume checkpoint cohortHash mismatch — HARD STOP")
    if resume_auth.get("observationManifestHash") != checkpoint.get("manifestHash"):
        raise BatchManifestFreezeError("resume observation manifestHash mismatch — HARD STOP")
    if resume_auth.get("processingManifestHash") != processing_manifest_hash:
        raise BatchManifestFreezeError("resume processing manifestHash mismatch — HARD STOP")

    verify_authorized_manifest_delta(
        manifest_path,
        str(resume_auth["observationManifestHash"]),
        resume_auth.get("allowedManifestDelta") or {},
        remediation_commit=str(resume_auth.get("remediationCommit") or ""),
    )

    for clearance in resume_auth.get("architectureExceptionClearances") or []:
        _verify_architecture_exception_clearance(clearance, checkpoint)

    return {
        "resumeAuthorizationArtifact": resume_auth_path.name,
        "observationManifestHash": resume_auth["observationManifestHash"],
        "processingManifestHash": resume_auth["processingManifestHash"],
        "remediationCommit": resume_auth.get("remediationCommit"),
        "resumeGeneration": 2,
    }


def build_cleared_stop_audit(
    clearance: dict[str, Any],
    entry: dict[str, Any],
    *,
    batch_run_id: str,
    prior_audit: dict[str, Any],
) -> dict[str, Any]:
    manual_id = str(clearance["manualId"])
    provenance = prior_audit.get("provenance") or {}
    content_hash = provenance.get("contentHash") or compute_manual_content_hash(manual_id)
    return {
        "manualId": manual_id,
        "platformId": entry.get("platformId"),
        "templateId": entry.get("templateId"),
        "expectedFrozenOntologyId": entry.get("expectedFrozenOntologyId"),
        "primaryDisposition": clearance.get("resumeDisposition", "skipped_authorized"),
        "batchState": "cleared_stop",
        "historicalBatchState": clearance.get("historicalBatchState"),
        "historicalPrimaryDisposition": clearance.get("historicalPrimaryDisposition"),
        "hasCanonicalMappings": prior_audit.get("hasCanonicalMappings", False),
        "hasOverlayCandidates": prior_audit.get("hasOverlayCandidates", False),
        "hasUnresolvedTerms": prior_audit.get("hasUnresolvedTerms", False),
        "hasArchitectureException": False,
        "counts": prior_audit.get("counts") or {},
        "provenance": {
            "manifestSource": "procedureManualManifest.json",
            "candidateDir": f"normalization/candidates/{manual_id}/",
            "processedAt": _utc_now(),
            "batchRunId": batch_run_id,
            "contentHash": content_hash,
            "skippedReason": clearance.get("resumeSkippedReason"),
            "normalizationStatus": "skipped",
            "reNormalize": False,
            "frozenContract": clearance.get("frozenContract"),
            "freezeClosure": clearance.get("freezeClosure"),
            "historicalArtifact": clearance.get("historicalArtifact"),
        },
    }


def freeze_cohort_manifest(
    manifest_path: Path = MANIFEST_PATH,
    cohort_path: Path = COHORT_PATH,
) -> dict[str, str]:
    manifest_hash = compute_manifest_hash(manifest_path)
    cohort_hash = compute_cohort_hash(cohort_path)
    cohort = _read_json(cohort_path)
    source_of_truth = str(cohort.get("sourceOfTruth") or "")
    if source_of_truth and source_of_truth != str(manifest_path.relative_to(REPO_ROOT)).replace("\\", "/"):
        expected = "frontend/components/diagnostics/procedures/procedureManualManifest.json"
        if source_of_truth != expected:
            raise BatchManifestFreezeError(
                f"cohort sourceOfTruth mismatch: expected {expected}, got {source_of_truth}"
            )
    return {
        "manifestPath": str(manifest_path.relative_to(REPO_ROOT)).replace("\\", "/"),
        "cohortArtifact": cohort_path.name,
        "manifestHash": manifest_hash,
        "cohortHash": cohort_hash,
        "frozenAt": _utc_now(),
    }


def load_execution_authorization(lock_path: Path = EXECUTION_LOCK_PATH) -> dict[str, Any]:
    if not lock_path.is_file():
        return {
            "authorized": False,
            "reason": f"missing execution lock artifact: {lock_path.name}",
            "normalizationBatchAuthorized": False,
            "batchExecutionAuthorized": False,
        }
    lock = _read_json(lock_path)
    normalization_authorized = bool(lock.get("normalizationBatchAuthorized"))
    batch_authorized = bool(lock.get("batchExecutionAuthorized"))
    headline = lock.get("headlineMetrics") or {}
    headline_norm = headline.get("normalizationBatchAuthorized")
    headline_batch = headline.get("batchExecutionAuthorized")
    if headline_norm is not None and bool(headline_norm) != normalization_authorized:
        return {
            "authorized": False,
            "reason": "headlineMetrics.normalizationBatchAuthorized mismatch — HARD STOP",
            "normalizationBatchAuthorized": normalization_authorized,
            "batchExecutionAuthorized": batch_authorized,
            "lockArtifact": lock_path.name,
            "lockStatus": lock.get("status"),
            "lockVerdict": lock.get("verdict"),
        }
    if headline_batch is not None and bool(headline_batch) != batch_authorized:
        return {
            "authorized": False,
            "reason": "headlineMetrics.batchExecutionAuthorized mismatch — HARD STOP",
            "normalizationBatchAuthorized": normalization_authorized,
            "batchExecutionAuthorized": batch_authorized,
            "lockArtifact": lock_path.name,
            "lockStatus": lock.get("status"),
            "lockVerdict": lock.get("verdict"),
        }
    authorized = normalization_authorized and batch_authorized
    reason = "authorized" if authorized else "normalizationBatchAuthorized != true — HARD STOP"
    return {
        "authorized": authorized,
        "reason": reason,
        "normalizationBatchAuthorized": normalization_authorized,
        "batchExecutionAuthorized": batch_authorized,
        "lockArtifact": lock_path.name,
        "lockStatus": lock.get("status"),
        "lockVerdict": lock.get("verdict"),
    }


def assert_execution_authorized(
    lock_path: Path = EXECUTION_LOCK_PATH,
    *,
    skip_auth: bool = False,
) -> dict[str, Any]:
    if skip_auth:
        return {
            "authorized": True,
            "reason": "skip_auth_for_orchestrator_tests",
            "normalizationBatchAuthorized": True,
            "batchExecutionAuthorized": True,
        }
    auth = load_execution_authorization(lock_path)
    if not auth["authorized"]:
        raise BatchAuthorizationError(auth["reason"])
    return auth


def verify_frozen_hashes() -> dict[str, Any]:
    import sys

    scripts_dir = REPO_ROOT / "backend" / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from validate_canonical_graph import validate_frozen_hashes

    errors = validate_frozen_hashes()
    return {"verified": len(errors) == 0, "errors": errors}


def assert_frozen_hashes_verified() -> None:
    result = verify_frozen_hashes()
    if not result["verified"]:
        raise FrozenHashMutationError("; ".join(result["errors"]))


def compute_manual_content_hash(manual_id: str) -> str:
    candidate_dir = _candidate_dir(manual_id)
    if not candidate_dir.exists():
        return sha256_text(f"missing:{manual_id}")

    digest = hashlib.sha256()
    for filename in CONTENT_HASH_FILES:
        path = candidate_dir / filename
        digest.update(filename.encode("utf-8"))
        if path.is_file():
            digest.update(sha256_file(path).encode("utf-8"))
        else:
            digest.update(b"missing")
    return digest.hexdigest()


def _entry_to_slot(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "slotId": entry.get("slotId") or entry.get("manualId"),
        "manualId": entry.get("manualId"),
        "readiness": str(entry.get("readiness") or "ready"),
        "batchStopExpected": bool(
            (entry.get("specialHandling") or {}).get("batchHandling")
            == "architecture_exception_expected"
        ),
        "prerequisite": entry.get("prerequisite"),
    }


def _cohort_entries(cohort: dict[str, Any]) -> list[dict[str, Any]]:
    return list(cohort.get("entries") or cohort.get("slots") or [])


def resolve_frozen_manifest_entry(
    cohort_entry: dict[str, Any],
    manifest: dict[str, Any],
) -> dict[str, Any]:
    manual_id = str(cohort_entry.get("manualId"))
    try:
        return find_manual_entry(manifest, manual_id)
    except ValueError as exc:
        raise BatchManifestFreezeError(
            f"cohort manual {manual_id} missing from frozen procedureManualManifest.json"
        ) from exc


def should_skip_normalization(
    manual_id: str,
    *,
    pilot_baseline: bool,
    force_manual: bool,
    idempotent_skip: bool,
) -> str | None:
    if idempotent_skip:
        return "content_hash_unchanged"
    if pilot_baseline and not force_manual:
        return "pilot_baseline_protected"
    return None


def execute_manual_normalization(
    cohort_entry: dict[str, Any],
    manifest: dict[str, Any],
    *,
    normalize_fn: NormalizeManualFn,
) -> dict[str, Any]:
    manual_entry = resolve_frozen_manifest_entry(cohort_entry, manifest)
    manual_id = str(manual_entry.get("manualId"))
    try:
        normalization_result = normalize_fn(manual_entry)
    except NormalizationLifecycleError as exc:
        return {
            "manualId": manual_id,
            "status": "failed",
            "error": str(exc),
            "errorCode": exc.code,
            "result": None,
        }
    except Exception as exc:
        return {
            "manualId": manual_id,
            "status": "failed",
            "error": str(exc),
            "result": None,
        }
    return {
        "manualId": manual_id,
        "status": "success",
        "error": None,
        "result": normalization_result,
    }


def classification_for_normalization_failure(normalization: dict[str, Any]) -> dict[str, Any]:
    return {
        "manualId": normalization.get("manualId"),
        "executionStatus": "normalization_failed",
        "pipelineDisposition": "block",
        "outcomeCounts": None,
        "architectureException": False,
        "promotionBlocked": True,
        "batchStop": False,
        "normalizationError": normalization.get("error"),
    }


def _mapping_count(classification: dict[str, Any], key: str) -> int:
    outcome_counts = classification.get("outcomeCounts")
    if not isinstance(outcome_counts, dict):
        return 0
    mapping = outcome_counts.get("mapping")
    if not isinstance(mapping, dict):
        return 0
    return int(mapping.get(key) or 0)


def map_to_primary_disposition(classification: dict[str, Any]) -> str:
    if classification.get("architectureException"):
        return "architecture_exception"
    pipeline = str(classification.get("pipelineDisposition") or "")
    if pipeline == "prerequisite_block":
        return "prerequisite_block"
    if pipeline in {"unresolved_block", "block"}:
        return "unresolved"
    if pipeline == "implementation_specific":
        return "implementation_specific"
    if pipeline == "canonical_mapping_continue":
        return "canonical_mapping"
    return "unresolved"


def build_manual_audit_manifest(
    entry: dict[str, Any],
    classification: dict[str, Any],
    *,
    batch_run_id: str,
    content_hash: str,
    batch_state: str,
    skipped_reason: str | None = None,
    normalization_status: str | None = None,
    normalization_error: str | None = None,
) -> dict[str, Any]:
    mapped_count = _mapping_count(classification, "candidate")
    compound_count = _mapping_count(classification, "COMPOUND_TERM_CANDIDATE")
    unresolved_count = _mapping_count(classification, "UNRESOLVED_TERM")
    outcome_counts = classification.get("outcomeCounts") or {}
    overlay_count = int(outcome_counts.get("overlayCandidates") or 0) if isinstance(outcome_counts, dict) else 0
    conflict_count = int(outcome_counts.get("conflicts") or 0) if isinstance(outcome_counts, dict) else 0
    has_architecture_exception = bool(classification.get("architectureException"))
    has_unresolved = unresolved_count > 0 or conflict_count > 0
    has_overlay = overlay_count > 0
    has_mappings = mapped_count > 0
    primary_disposition = map_to_primary_disposition(classification)
    if batch_state == "pending":
        primary_disposition = "pending"
    elif batch_state == "skipped_authorized":
        primary_disposition = "skipped_authorized"
    elif batch_state == "stopped_trigger":
        primary_disposition = map_to_primary_disposition(classification)

    provenance = entry.get("provenance") or {}
    return {
        "manualId": entry.get("manualId"),
        "platformId": entry.get("platformId"),
        "templateId": entry.get("templateId"),
        "expectedFrozenOntologyId": entry.get("expectedFrozenOntologyId"),
        "primaryDisposition": primary_disposition,
        "hasCanonicalMappings": has_mappings,
        "hasOverlayCandidates": has_overlay,
        "hasUnresolvedTerms": has_unresolved,
        "hasArchitectureException": has_architecture_exception,
        "counts": {
            "canonicalMappings": mapped_count,
            "implementationSpecific": compound_count,
            "unresolved": unresolved_count,
            "architectureException": 1 if has_architecture_exception else 0,
            "candidateCount": mapped_count + compound_count + unresolved_count,
            "overlayCandidateCount": overlay_count,
            "conflictCount": conflict_count,
            "promotionBlocked": bool(classification.get("promotionBlocked")),
        },
        "provenance": {
            "manifestSource": provenance.get("manifestSource", "procedureManualManifest.json"),
            "extractionDoc": provenance.get("extractionDoc"),
            "candidateDir": f"normalization/candidates/{entry.get('manualId')}/",
            "processedAt": _utc_now(),
            "batchRunId": batch_run_id,
            "contentHash": content_hash,
            "skippedReason": skipped_reason,
            "normalizationStatus": normalization_status,
            "normalizationError": normalization_error,
        },
        "batchState": batch_state,
    }


def checkpoint_path(batch_run_id: str) -> Path:
    return CALIBRATION_DIR / f"CG_PRODUCTION_NORMALIZATION_BATCH_CHECKPOINT_{batch_run_id}.json"


def load_checkpoint(batch_run_id: str) -> dict[str, Any] | None:
    path = checkpoint_path(batch_run_id)
    if not path.is_file():
        return None
    return _read_json(path)


def write_checkpoint(payload: dict[str, Any]) -> Path:
    batch_run_id = str(payload["batchRunId"])
    path = checkpoint_path(batch_run_id)
    if not payload.get("dryRun"):
        _write_json(path, payload)
    return path


def manual_audit_path(batch_run_id: str, manual_id: str) -> Path:
    return BATCH_AUDIT_DIR / batch_run_id / f"{manual_id}.json"


def write_manual_audit(batch_run_id: str, audit: dict[str, Any], *, dry_run: bool) -> Path:
    path = manual_audit_path(batch_run_id, str(audit["manualId"]))
    if not dry_run:
        _write_json(path, audit)
    return path


def update_human_review_queue(
    queue_entries: list[dict[str, Any]],
    *,
    dry_run: bool,
) -> None:
    if dry_run:
        return
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    existing: dict[str, Any] = {"entries": []}
    if HUMAN_REVIEW_QUEUE_PATH.is_file():
        existing = _read_json(HUMAN_REVIEW_QUEUE_PATH)
    merged = {entry["manualId"]: entry for entry in existing.get("entries", [])}
    for entry in queue_entries:
        merged[entry["manualId"]] = entry
    payload = {
        "schemaVersion": "1.0.0",
        "reportType": "batch_human_review_queue",
        "updatedAt": _utc_now(),
        "entries": list(merged.values()),
    }
    _write_json(HUMAN_REVIEW_QUEUE_PATH, payload)


def should_queue_for_review(audit: dict[str, Any]) -> bool:
    if audit.get("hasArchitectureException"):
        return True
    counts = audit.get("counts") or {}
    if int(counts.get("conflictCount") or 0) > 0:
        return True
    if audit.get("primaryDisposition") == "unresolved" and counts.get("promotionBlocked"):
        return True
    if audit.get("batchState") == "stopped_trigger":
        return True
    return False


def _load_pilot_baseline_index() -> dict[str, dict[str, Any]]:
    if not PILOT_RESULTS_PATH.is_file():
        return {}
    payload = _read_json(PILOT_RESULTS_PATH)
    return {
        str(result["manualId"]): result
        for result in payload.get("manualResults", [])
        if result.get("manualId")
    }


def classify_manual_entry(entry: dict[str, Any]) -> dict[str, Any]:
    return _classify_manual_slot(_entry_to_slot(entry))


def run_batch(options: BatchRunOptions) -> dict[str, Any]:
    auth = assert_execution_authorized(options.execution_lock_path, skip_auth=options.skip_auth)
    freeze = freeze_cohort_manifest(options.manifest_path, options.cohort_path)
    cohort_hash = freeze["cohortHash"]
    manifest_hash = freeze["manifestHash"]

    resumed_checkpoint = None
    resume_context: dict[str, Any] | None = None
    if options.resume_batch_run_id:
        resumed_checkpoint = load_checkpoint(options.resume_batch_run_id)
        if resumed_checkpoint is None:
            raise BatchManifestFreezeError(
                f"resume checkpoint missing for batchRunId={options.resume_batch_run_id}"
            )
        resume_auth_path = (
            options.resume_authorization_path
            or default_resume_authorization_path(options.resume_batch_run_id)
        )
        resume_auth = load_resume_authorization(resume_auth_path)
        resume_context = validate_resume_authorization(
            resume_auth,
            batch_run_id=options.resume_batch_run_id,
            checkpoint=resumed_checkpoint,
            manifest_path=options.manifest_path,
            cohort_hash=cohort_hash,
            processing_manifest_hash=manifest_hash,
            resume_auth_path=resume_auth_path,
        )
        if resumed_checkpoint.get("cohortHash") != cohort_hash:
            raise BatchManifestFreezeError("resume cohortHash mismatch — cohort artifact changed since authorization")
        batch_run_id = options.resume_batch_run_id
        started_at = str(resumed_checkpoint.get("startedAt") or _utc_now())
    else:
        batch_run_id = build_batch_run_id(cohort_hash)
        started_at = _utc_now()

    frozen_before = verify_frozen_hashes()
    if not frozen_before["verified"]:
        raise FrozenHashMutationError("; ".join(frozen_before["errors"]))

    cohort = _read_json(options.cohort_path)
    entries = _cohort_entries(cohort)
    if options.max_manuals is not None:
        entries = entries[: options.max_manuals]

    base_normalize_fn = options.normalize_manual_fn or run_manual_normalization

    def normalize_fn(manual_entry: dict[str, Any]) -> dict[str, Any]:
        manual_id = str(manual_entry.get("manualId"))
        force = manual_id in options.force_manual_ids
        if options.normalize_manual_fn is not None:
            return base_normalize_fn(manual_entry)
        return run_manual_normalization(manual_entry, force=force)
    if options.manifest_loader_fn is not None:
        manifest = options.manifest_loader_fn()
    elif options.manifest_path != MANIFEST_PATH:
        manifest = _read_json(options.manifest_path)
    else:
        manifest = load_manifest()

    completed_manual_ids: set[str] = set()
    resume_skip_manual_ids: set[str] = set()
    manual_audits: list[dict[str, Any]] = []
    review_queue: list[dict[str, Any]] = []
    batch_status = "in_progress"
    stop_reason: str | None = None
    stopped_at_manual_id: str | None = None
    forward_halted = False

    if resumed_checkpoint:
        resume_auth_path = (
            options.resume_authorization_path
            or default_resume_authorization_path(options.resume_batch_run_id or "")
        )
        resume_auth = load_resume_authorization(resume_auth_path)
        manual_audits.extend(resumed_checkpoint.get("manualAudits", []))
        entries_by_id = {str(entry.get("manualId")): entry for entry in entries}
        for prior in resumed_checkpoint.get("manualAudits", []):
            state = prior.get("batchState")
            manual_id = str(prior["manualId"])
            if state in {"completed", "skipped_authorized"}:
                resume_skip_manual_ids.add(manual_id)
        for clearance in resume_auth.get("architectureExceptionClearances") or []:
            manual_id = str(clearance.get("manualId"))
            prior_audit = next(
                audit for audit in resumed_checkpoint.get("manualAudits", []) if audit.get("manualId") == manual_id
            )
            resume_skip_manual_ids.add(manual_id)
            manual_audits.append(
                build_cleared_stop_audit(
                    clearance,
                    entries_by_id.get(manual_id, {"manualId": manual_id}),
                    batch_run_id=batch_run_id,
                    prior_audit=prior_audit,
                )
            )
        completed_manual_ids = set(resume_skip_manual_ids)

    pilot_baselines = _load_pilot_baseline_index()

    for entry in entries:
        manual_id = str(entry.get("manualId"))
        if forward_halted:
            pending_audit = build_manual_audit_manifest(
                entry,
                {"promotionBlocked": True},
                batch_run_id=batch_run_id,
                content_hash=compute_manual_content_hash(manual_id),
                batch_state="pending",
                skipped_reason="batch_forward_progress_halted",
            )
            manual_audits.append(pending_audit)
            continue

        skip_ids = resume_skip_manual_ids if resumed_checkpoint else completed_manual_ids
        if manual_id in skip_ids and manual_id not in options.force_manual_ids:
            continue

        content_hash = compute_manual_content_hash(manual_id)
        prior_completed = next(
            (audit for audit in manual_audits if audit.get("manualId") == manual_id and audit.get("batchState") == "completed"),
            None,
        )
        if (
            prior_completed
            and prior_completed.get("provenance", {}).get("contentHash") == content_hash
            and manual_id not in options.force_manual_ids
        ):
            continue

        if manual_id in PILOT_BASELINE_MANUAL_IDS and manual_id not in options.force_manual_ids:
            pilot_result = pilot_baselines.get(manual_id, {})
            classification = pilot_result or classify_manual_entry(entry)
            if classification.get("batchStop") or classification.get("architectureException"):
                batch_state = "stopped_trigger"
                forward_halted = True
                batch_status = "stopped"
                stopped_at_manual_id = manual_id
                stop_reason = (
                    f"architecture_exception on {manual_id} — batch forward progress STOP per batch contract"
                )
                audit = build_manual_audit_manifest(
                    entry,
                    classification,
                    batch_run_id=batch_run_id,
                    content_hash=content_hash,
                    batch_state=batch_state,
                    skipped_reason="pilot_baseline_protected_stop_retained",
                    normalization_status="skipped",
                    normalization_error=None,
                )
            else:
                audit = build_manual_audit_manifest(
                    entry,
                    classification,
                    batch_run_id=batch_run_id,
                    content_hash=content_hash,
                    batch_state="skipped_authorized",
                    skipped_reason="pilot_baseline_protected",
                    normalization_status="skipped",
                    normalization_error=None,
                )
            manual_audits.append(audit)
            completed_manual_ids.add(manual_id)
            if should_queue_for_review(audit):
                review_queue.append(
                    {
                        "manualId": manual_id,
                        "primaryDisposition": audit["primaryDisposition"],
                        "batchState": audit["batchState"],
                        "batchRunId": batch_run_id,
                        "queuedAt": _utc_now(),
                    }
                )
            if options.write_artifacts and not options.dry_run:
                write_manual_audit(batch_run_id, audit, dry_run=False)
            continue

        if manual_id in PILOT_BASELINE_MANUAL_IDS and manual_id in options.force_manual_ids and not auth["authorized"]:
            raise PilotBaselineOverwriteError(
                f"force-manual on pilot baseline {manual_id} requires locked execution authorization"
            )

        normalization_outcome = execute_manual_normalization(
            entry,
            manifest,
            normalize_fn=normalize_fn,
        )
        content_hash = compute_manual_content_hash(manual_id)
        normalization_status = normalization_outcome.get("status")
        normalization_error = normalization_outcome.get("error")
        if normalization_outcome.get("status") != "success":
            classification = classification_for_normalization_failure(normalization_outcome)
        else:
            classification = classify_manual_entry(entry)

        batch_state = "completed"
        if classification.get("batchStop") or classification.get("architectureException"):
            batch_state = "stopped_trigger"
            forward_halted = True
            batch_status = "stopped"
            stopped_at_manual_id = manual_id
            stop_reason = (
                f"architecture_exception on {manual_id} — batch forward progress STOP per batch contract"
            )

        audit = build_manual_audit_manifest(
            entry,
            classification,
            batch_run_id=batch_run_id,
            content_hash=content_hash,
            batch_state=batch_state,
            normalization_status=normalization_status,
            normalization_error=normalization_error,
        )
        manual_audits.append(audit)
        completed_manual_ids.add(manual_id)

        if should_queue_for_review(audit):
            review_queue.append(
                {
                    "manualId": manual_id,
                    "primaryDisposition": audit["primaryDisposition"],
                    "batchState": batch_state,
                    "batchRunId": batch_run_id,
                    "queuedAt": _utc_now(),
                }
            )

        if options.write_artifacts and not options.dry_run:
            write_manual_audit(batch_run_id, audit, dry_run=False)

        if forward_halted:
            continue

    if forward_halted:
        for entry in entries:
            manual_id = str(entry.get("manualId"))
            if any(audit.get("manualId") == manual_id for audit in manual_audits):
                continue
            pending_audit = build_manual_audit_manifest(
                entry,
                {"promotionBlocked": True},
                batch_run_id=batch_run_id,
                content_hash=compute_manual_content_hash(manual_id),
                batch_state="pending",
                skipped_reason="batch_forward_progress_halted",
            )
            manual_audits.append(pending_audit)
    elif batch_status == "in_progress":
        batch_status = "completed"

    frozen_after = verify_frozen_hashes()
    if not frozen_after["verified"]:
        batch_status = "failed"
        stop_reason = "; ".join(frozen_after["errors"])

    finished_at = _utc_now()
    manuals_completed = sum(1 for audit in manual_audits if audit.get("batchState") in {"completed", "skipped_authorized", "stopped_trigger"})
    manuals_pending = sum(1 for audit in manual_audits if audit.get("batchState") == "pending")

    checkpoint_manifest_freeze = freeze
    if resume_context is not None:
        checkpoint_manifest_freeze = {
            "observationManifestHash": resume_context["observationManifestHash"],
            "processingManifestHash": resume_context["processingManifestHash"],
            "resumeAuthorizationArtifact": resume_context["resumeAuthorizationArtifact"],
            "remediationCommit": resume_context.get("remediationCommit"),
        }

    checkpoint_payload = {
        "schemaVersion": "1.0.0",
        "reportType": "cg_production_normalization_batch_checkpoint",
        "batchRunId": batch_run_id,
        "cohortArtifact": options.cohort_path.name,
        "manifestHash": manifest_hash,
        "cohortHash": cohort_hash,
        "manifestFreeze": checkpoint_manifest_freeze,
        "authorization": auth,
        "startedAt": started_at,
        "finishedAt": finished_at,
        "batchStatus": batch_status,
        "stopReason": stop_reason,
        "stoppedAtManualId": stopped_at_manual_id,
        "manualsCompleted": manuals_completed,
        "manualsPending": manuals_pending,
        "frozenHashesVerifiedBefore": frozen_before["verified"],
        "frozenHashesVerifiedAfter": frozen_after["verified"],
        "dryRun": options.dry_run,
        "manualAudits": manual_audits,
    }
    if resume_context is not None:
        checkpoint_payload["resumeGeneration"] = resume_context["resumeGeneration"]

    if options.write_artifacts:
        write_checkpoint(checkpoint_payload)
        update_human_review_queue(review_queue, dry_run=options.dry_run)

    result_payload = {
        "schemaVersion": "1.0.0",
        "reportType": "cg_production_normalization_batch_run",
        "workstream": "CG-PRODUCTION-NORMALIZATION-BATCH-EXECUTION",
        "status": batch_status,
        "generatedAt": finished_at,
        "orchestrator": "backend/scripts/normalization/batch_orchestrator.py",
        "batchRunId": batch_run_id,
        "manifestHash": manifest_hash,
        "cohortHash": cohort_hash,
        "authorization": auth,
        "batchStatus": batch_status,
        "stopReason": stop_reason,
        "stoppedAtManualId": stopped_at_manual_id,
        "manualsCompleted": manuals_completed,
        "manualsPending": manuals_pending,
        "frozenHashesVerifiedBefore": frozen_before["verified"],
        "frozenHashesVerifiedAfter": frozen_after["verified"],
        "dryRun": options.dry_run,
        "manualAudits": manual_audits,
        "checkpointArtifact": checkpoint_path(batch_run_id).name,
    }
    if resume_context is not None:
        result_payload["resumeGeneration"] = resume_context["resumeGeneration"]
        result_payload["manifestFreeze"] = checkpoint_manifest_freeze
    return result_payload
