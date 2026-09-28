from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, CANDIDATES_DIR, REVIEW_DIR

INDEX_FILENAME = "CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_INDEX_v1.json"
DECISIONS_FILENAME = "CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json"

FORBIDDEN_WRITE_PREFIXES = (
    "knowledge/canonical/",
    "normalization/candidates/",
    "normalization/promotions/",
    "normalization/calibration/",
)

ROLLBACK_BOUNDARY = {
    "scope": "review_tooling_only",
    "safeToDelete": [
        f"normalization/review/{INDEX_FILENAME}",
        f"normalization/review/{DECISIONS_FILENAME}",
    ],
    "neverDeleteDuringRollback": [
        "knowledge/canonical/",
        "normalization/candidates/",
        "normalization/review/batch_human_review_queue.json",
        "normalization/review/ledger.json",
        "normalization/calibration/CG_PRODUCTION_NORMALIZATION_BATCH_OBSERVATION_RUN_v1.json",
        "normalization/candidates/*/architecture_exception.json",
    ],
    "reviewDecisionsAreNonCanonical": True,
}


def run_preflight(
    *,
    batch_run_id: str,
    processing_manifest_hash: str,
    checkpoint_path: Path | None = None,
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if not CANDIDATES_DIR.is_dir():
        errors.append(f"candidates directory missing: {CANDIDATES_DIR}")

    candidate_dirs = sorted(
        path.name
        for path in CANDIDATES_DIR.iterdir()
        if path.is_dir() and not path.name.startswith("_")
    )
    if not candidate_dirs:
        errors.append("no candidate manual directories found")

    checkpoint = checkpoint_path or (
        CALIBRATION_DIR / f"CG_PRODUCTION_NORMALIZATION_BATCH_CHECKPOINT_{batch_run_id}.json"
    )
    if not checkpoint.is_file():
        warnings.append(f"checkpoint not found: {checkpoint}")
    else:
        payload = json.loads(checkpoint.read_text(encoding="utf-8"))
        if payload.get("batchRunId") != batch_run_id:
            errors.append("checkpoint batchRunId mismatch")
        manifest_freeze = payload.get("manifestFreeze") or {}
        checkpoint_hash = (
            payload.get("processingManifestHash")
            or payload.get("manifestHash")
            or manifest_freeze.get("processingManifestHash")
        )
        if checkpoint_hash != processing_manifest_hash:
            errors.append("checkpoint processingManifestHash mismatch")

    REVIEW_DIR.mkdir(parents=True, exist_ok=True)

    return {
        "passed": not errors,
        "batchRunId": batch_run_id,
        "processingManifestHash": processing_manifest_hash,
        "candidateManualCount": len(candidate_dirs),
        "errors": errors,
        "warnings": warnings,
        "rollbackBoundary": ROLLBACK_BOUNDARY,
        "forbiddenWritePrefixes": list(FORBIDDEN_WRITE_PREFIXES),
    }
