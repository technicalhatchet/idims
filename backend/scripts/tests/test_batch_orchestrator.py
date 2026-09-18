from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_DIR.parents[1]
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
    execute_manual_normalization,
    freeze_cohort_manifest,
    load_execution_authorization,
    run_batch,
)
from normalization.lifecycle import NormalizationLifecycleError

PILOT_COHORT_PATH = (
    REPO_ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "knowledge"
    / "normalization"
    / "calibration"
    / "CG_PRODUCTION_NORMALIZATION_PILOT_COHORT_v1.json"
)
CANONICAL_DIR = (
    REPO_ROOT / "frontend" / "components" / "diagnostics" / "knowledge" / "canonical"
)


def _mini_cohort(tmp_path: Path, *, pilot_only: bool = False) -> Path:
    entries = [
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
    ]
    if not pilot_only:
        entries.append(
            {
                "manualId": "W8178559",
                "platformId": "whirlpool_duet_sport_dryer",
                "templateId": "electric_dryer",
                "expectedFrozenOntologyId": "vented_dryer",
                "provenance": {"manifestSource": "procedureManualManifest.json"},
            }
        )
    cohort = {
        "schemaVersion": "1.0.0",
        "sourceOfTruth": "frontend/components/diagnostics/procedures/procedureManualManifest.json",
        "entries": entries,
    }
    path = tmp_path / "mini_cohort.json"
    path.write_text(json.dumps(cohort), encoding="utf-8")
    return path


def _fake_manifest() -> dict:
    return {
        "manuals": [
            {
                "manualId": "W8178559",
                "platformId": "whirlpool_duet_sport_dryer",
                "templateId": "electric_dryer",
                "seedDir": "whirlpool_duet_sport_dryer",
                "label": "Duet Sport dryer",
            }
        ]
    }


def test_execution_authorization_fail_closed(tmp_path: Path):
    lock_path = tmp_path / "unauthorized-lock.json"
    lock_path.write_text(
        json.dumps(
            {
                "normalizationBatchAuthorized": False,
                "batchExecutionAuthorized": False,
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(BatchAuthorizationError):
        assert_execution_authorized(lock_path)


def test_execution_authorization_top_level_tuple_authoritative(tmp_path: Path):
    lock = {
        "normalizationBatchAuthorized": True,
        "batchExecutionAuthorized": True,
        "headlineMetrics": {
            "normalizationBatchAuthorized": False,
            "batchExecutionAuthorized": False,
        },
    }
    lock_path = tmp_path / "lock.json"
    lock_path.write_text(json.dumps(lock), encoding="utf-8")
    auth = load_execution_authorization(lock_path)
    assert auth["authorized"] is False
    assert "mismatch" in auth["reason"]


def test_execution_authorization_headline_only_not_sufficient(tmp_path: Path):
    lock = {
        "headlineMetrics": {
            "normalizationBatchAuthorized": True,
            "batchExecutionAuthorized": True,
        },
    }
    lock_path = tmp_path / "lock.json"
    lock_path.write_text(json.dumps(lock), encoding="utf-8")
    auth = load_execution_authorization(lock_path)
    assert auth["authorized"] is False


def test_execution_authorization_top_level_true_authorized(tmp_path: Path):
    lock = {
        "normalizationBatchAuthorized": True,
        "batchExecutionAuthorized": True,
        "headlineMetrics": {
            "normalizationBatchAuthorized": True,
            "batchExecutionAuthorized": True,
        },
    }
    lock_path = tmp_path / "lock.json"
    lock_path.write_text(json.dumps(lock), encoding="utf-8")
    auth = load_execution_authorization(lock_path)
    assert auth["authorized"] is True
    assert auth["normalizationBatchAuthorized"] is True
    assert auth["batchExecutionAuthorized"] is True


def test_normalization_lifecycle_failure_recorded_in_batch_audit(tmp_path: Path):
    cohort_path = _mini_cohort(tmp_path, pilot_only=True)
    cohort = json.loads(cohort_path.read_text(encoding="utf-8"))
    cohort["entries"] = [
        {
            "manualId": "W8178559",
            "platformId": "whirlpool_duet_sport_dryer",
            "templateId": "electric_dryer",
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        }
    ]
    cohort_path.write_text(json.dumps(cohort), encoding="utf-8")

    def _lifecycle_fail(_manual_entry: dict) -> dict:
        raise NormalizationLifecycleError("zero inherited procedures", "zero_procedure_inheritance")

    result = run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
            normalize_manual_fn=_lifecycle_fail,
            manifest_loader_fn=_fake_manifest,
        )
    )
    audit = result["manualAudits"][0]
    assert audit["provenance"]["normalizationStatus"] == "failed"
    assert audit["counts"]["promotionBlocked"] is True
    assert audit["primaryDisposition"] == "unresolved"


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
    normalize_calls: list[str] = []

    def _normalize(manual_entry: dict) -> dict:
        normalize_calls.append(str(manual_entry["manualId"]))
        return {"manualId": manual_entry["manualId"], "manifest": {"status": "candidate"}}

    result = run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
            normalize_manual_fn=_normalize,
            manifest_loader_fn=_fake_manifest,
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
    assert normalize_calls == []


def test_default_normalize_fn_is_run_manual_normalization(tmp_path: Path):
    cohort_path = _mini_cohort(tmp_path, pilot_only=True)
    cohort = json.loads(cohort_path.read_text(encoding="utf-8"))
    cohort["entries"] = [
        {
            "manualId": "W8178559",
            "platformId": "whirlpool_duet_sport_dryer",
            "templateId": "electric_dryer",
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        }
    ]
    cohort_path.write_text(json.dumps(cohort), encoding="utf-8")

    with patch(
        "normalization.batch_orchestrator.run_manual_normalization",
        return_value={"manualId": "W8178559", "manifest": {"status": "candidate"}},
    ) as pipeline_normalize:
        run_batch(
            BatchRunOptions(
                cohort_path=cohort_path,
                skip_auth=True,
                dry_run=True,
                write_artifacts=False,
                manifest_loader_fn=_fake_manifest,
            )
        )
        pipeline_normalize.assert_called_once()
        assert pipeline_normalize.call_args.args[0]["manualId"] == "W8178559"


def test_normalize_invoked_once_per_eligible_manual(tmp_path: Path):
    cohort_path = _mini_cohort(tmp_path, pilot_only=True)
    cohort = json.loads(cohort_path.read_text(encoding="utf-8"))
    cohort["entries"] = [
        {
            "manualId": "W8178559",
            "platformId": "whirlpool_duet_sport_dryer",
            "templateId": "electric_dryer",
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        }
    ]
    cohort_path.write_text(json.dumps(cohort), encoding="utf-8")

    calls: list[str] = []

    def _normalize(manual_entry: dict) -> dict:
        calls.append(str(manual_entry["manualId"]))
        return {"manualId": manual_entry["manualId"], "manifest": {"status": "candidate"}}

    run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
            normalize_manual_fn=_normalize,
            manifest_loader_fn=_fake_manifest,
        )
    )
    assert calls == ["W8178559"]


def test_normalization_failure_is_recorded(tmp_path: Path):
    cohort_path = _mini_cohort(tmp_path, pilot_only=True)
    cohort = json.loads(cohort_path.read_text(encoding="utf-8"))
    cohort["entries"] = [
        {
            "manualId": "W8178559",
            "platformId": "whirlpool_duet_sport_dryer",
            "templateId": "electric_dryer",
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        }
    ]
    cohort_path.write_text(json.dumps(cohort), encoding="utf-8")

    def _fail(_manual_entry: dict) -> dict:
        raise RuntimeError("seed missing")

    result = run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
            normalize_manual_fn=_fail,
            manifest_loader_fn=_fake_manifest,
        )
    )
    audit = result["manualAudits"][0]
    assert audit["provenance"]["normalizationStatus"] == "failed"
    assert "seed missing" in str(audit["provenance"]["normalizationError"])


def test_content_hash_idempotency_on_resume(tmp_path: Path):
    cohort_path = _mini_cohort(tmp_path, pilot_only=True)
    cohort = json.loads(cohort_path.read_text(encoding="utf-8"))
    cohort["entries"] = [
        {
            "manualId": "W8178559",
            "platformId": "whirlpool_duet_sport_dryer",
            "templateId": "electric_dryer",
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        }
    ]
    cohort_path.write_text(json.dumps(cohort), encoding="utf-8")

    calls: list[str] = []

    def _normalize(manual_entry: dict) -> dict:
        calls.append(str(manual_entry["manualId"]))
        return {"manualId": manual_entry["manualId"], "manifest": {"status": "candidate"}}

    first = run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=False,
            write_artifacts=True,
            normalize_manual_fn=_normalize,
            manifest_loader_fn=_fake_manifest,
        )
    )
    checkpoint = checkpoint_path(first["batchRunId"])
    try:
        assert calls == ["W8178559"]
        calls.clear()
        second = run_batch(
            BatchRunOptions(
                cohort_path=cohort_path,
                skip_auth=True,
                dry_run=True,
                write_artifacts=False,
                resume_batch_run_id=first["batchRunId"],
                normalize_manual_fn=_normalize,
                manifest_loader_fn=_fake_manifest,
            )
        )
        assert second["manifestHash"] == first["manifestHash"]
        assert second["cohortHash"] == first["cohortHash"]
        assert calls == []
    finally:
        if checkpoint.is_file():
            checkpoint.unlink()


def test_pilot_cohort_baseline_compatible_without_normalization_calls():
    normalize_calls: list[str] = []

    def _normalize(manual_entry: dict) -> dict:
        normalize_calls.append(str(manual_entry["manualId"]))
        return {"manualId": manual_entry["manualId"], "manifest": {"status": "candidate"}}

    result = run_batch(
        BatchRunOptions(
            cohort_path=PILOT_COHORT_PATH,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
            normalize_manual_fn=_normalize,
        )
    )

    assert result["batchStatus"] == "stopped"
    assert normalize_calls == []
    flexwash = next(
        audit for audit in result["manualAudits"] if audit["manualId"] == "SAMSUNG-FLEXWASH-WASHER"
    )
    assert flexwash["batchState"] == "stopped_trigger"
    assert flexwash["primaryDisposition"] == "architecture_exception"


def test_execute_manual_normalization_uses_frozen_manifest_entry():
    cohort_entry = {
        "manualId": "W8178559",
        "platformId": "whirlpool_duet_sport_dryer",
        "templateId": "electric_dryer",
    }
    captured: dict = {}

    def _normalize(manual_entry: dict) -> dict:
        captured["manual_entry"] = manual_entry
        return {"manualId": manual_entry["manualId"]}

    outcome = execute_manual_normalization(
        cohort_entry,
        _fake_manifest(),
        normalize_fn=_normalize,
    )
    assert outcome["status"] == "success"
    assert captured["manual_entry"]["seedDir"] == "whirlpool_duet_sport_dryer"


def test_frozen_hashes_unchanged_after_mocked_batch_run(tmp_path: Path):
    cohort_path = _mini_cohort(tmp_path, pilot_only=True)
    cohort = json.loads(cohort_path.read_text(encoding="utf-8"))
    cohort["entries"] = [
        {
            "manualId": "W8178559",
            "platformId": "whirlpool_duet_sport_dryer",
            "templateId": "electric_dryer",
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        }
    ]
    cohort_path.write_text(json.dumps(cohort), encoding="utf-8")

    def _normalize(manual_entry: dict) -> dict:
        return {"manualId": manual_entry["manualId"], "manifest": {"status": "candidate"}}

    result = run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
            normalize_manual_fn=_normalize,
            manifest_loader_fn=_fake_manifest,
        )
    )
    assert result["frozenHashesVerifiedBefore"] is True
    assert result["frozenHashesVerifiedAfter"] is True


def test_run_manual_normalization_not_called_from_publish_path(tmp_path: Path):
    cohort_path = _mini_cohort(tmp_path, pilot_only=True)
    cohort = json.loads(cohort_path.read_text(encoding="utf-8"))
    cohort["entries"] = [
        {
            "manualId": "W8178559",
            "platformId": "whirlpool_duet_sport_dryer",
            "templateId": "electric_dryer",
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        }
    ]
    cohort_path.write_text(json.dumps(cohort), encoding="utf-8")

    with patch("normalization.promotion.publish.publish_promotion") as publish_mock:
        run_batch(
            BatchRunOptions(
                cohort_path=cohort_path,
                skip_auth=True,
                dry_run=True,
                write_artifacts=False,
                normalize_manual_fn=lambda entry: {
                    "manualId": entry["manualId"],
                    "manifest": {"status": "candidate"},
                },
                manifest_loader_fn=_fake_manifest,
            )
        )
        publish_mock.assert_not_called()

    canonical_before = {
        path.relative_to(CANONICAL_DIR): path.read_bytes()
        for path in CANONICAL_DIR.rglob("*.json")
    }
    canonical_after = {
        path.relative_to(CANONICAL_DIR): path.read_bytes()
        for path in CANONICAL_DIR.rglob("*.json")
    }
    assert canonical_before == canonical_after
