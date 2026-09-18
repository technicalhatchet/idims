from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.batch_orchestrator import (
    BatchAuthorizationError,
    BatchRunOptions,
    assert_execution_authorized,
    build_batch_run_id,
    checkpoint_path,
    compute_cohort_hash,
    compute_manifest_hash,
    freeze_cohort_manifest,
    run_batch,
)


def _mini_cohort(tmp_path: Path) -> Path:
    cohort = {
        "schemaVersion": "1.0.0",
        "sourceOfTruth": "frontend/components/diagnostics/procedures/procedureManualManifest.json",
        "entries": [
            {
                "manualId": "W11169652",
                "platformId": "whirlpool_fl_dd",
                "templateId": "washer",
                "expectedFrozenOntologyId": "front_load_washer",
                "provenance": {"manifestSource": "procedureManualManifest.json"},
            },
            {
                "manualId": "SAMSUNG-FLEXWASH-WASHER",
                "platformId": "samsung_flexwash",
                "templateId": "washer",
                "expectedFrozenOntologyId": "front_load_washer",
                "provenance": {"manifestSource": "procedureManualManifest.json"},
                "specialHandling": {"batchHandling": "architecture_exception_expected"},
            },
            {
                "manualId": "W8178559",
                "platformId": "whirlpool_duet_sport_dryer",
                "templateId": "electric_dryer",
                "expectedFrozenOntologyId": "vented_dryer",
                "provenance": {"manifestSource": "procedureManualManifest.json"},
            },
        ],
    }
    path = tmp_path / "mini_cohort.json"
    path.write_text(json.dumps(cohort), encoding="utf-8")
    return path


def test_execution_authorization_fail_closed():
    with pytest.raises(BatchAuthorizationError):
        assert_execution_authorized()


def test_manifest_freeze_records_hashes():
    freeze = freeze_cohort_manifest()
    assert len(freeze["manifestHash"]) == 64
    assert len(freeze["cohortHash"]) == 64
    assert freeze["manifestHash"] == compute_manifest_hash()
    assert freeze["cohortHash"] == compute_cohort_hash()


def test_batch_run_id_uses_cohort_hash_prefix():
    cohort_hash = compute_cohort_hash()
    batch_run_id = build_batch_run_id(cohort_hash)
    assert batch_run_id.startswith("batch-")
    assert batch_run_id.endswith(cohort_hash[:8])


def test_architecture_exception_stop_semantics(tmp_path: Path):
    cohort_path = _mini_cohort(tmp_path)
    result = run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
        )
    )

    audits = {audit["manualId"]: audit for audit in result["manualAudits"]}
    assert audits["W11169652"]["batchState"] == "skipped_authorized"
    assert audits["SAMSUNG-FLEXWASH-WASHER"]["batchState"] == "stopped_trigger"
    assert audits["SAMSUNG-FLEXWASH-WASHER"]["primaryDisposition"] == "architecture_exception"
    assert audits["W8178559"]["batchState"] == "pending"
    assert result["batchStatus"] == "stopped"
    assert result["manualsPending"] >= 1
    assert result["frozenHashesVerifiedBefore"] is True
    assert result["frozenHashesVerifiedAfter"] is True


def test_content_hash_idempotency_on_resume(tmp_path: Path):
    cohort_path = _mini_cohort(tmp_path)
    first = run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=False,
            write_artifacts=True,
            max_manuals=1,
        )
    )
    checkpoint = checkpoint_path(first["batchRunId"])
    try:
        second = run_batch(
            BatchRunOptions(
                cohort_path=cohort_path,
                skip_auth=True,
                dry_run=True,
                write_artifacts=False,
                resume_batch_run_id=first["batchRunId"],
            )
        )
        assert second["manifestHash"] == first["manifestHash"]
        assert second["cohortHash"] == first["cohortHash"]
    finally:
        if checkpoint.is_file():
            checkpoint.unlink()
