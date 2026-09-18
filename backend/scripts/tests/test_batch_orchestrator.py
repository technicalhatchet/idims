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
    BatchManifestFreezeError,
    BatchRunOptions,
    assert_execution_authorized,
    build_batch_run_id,
    checkpoint_path,
    compute_batch_manual_counts,
    compute_cohort_hash,
    compute_manifest_hash,
    execute_manual_normalization,
    freeze_cohort_manifest,
    load_execution_authorization,
    run_batch,
    sha256_file,
    validate_resume_authorization,
    verify_authorized_manifest_delta,
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


def _resume_manifest() -> dict:
    return {
        "manuals": [
            {
                "manualId": "W8178559",
                "platformId": "whirlpool_duet_sport_dryer",
                "templateId": "electric_dryer",
                "seedDir": "whirlpool_duet_sport_dryer",
                "label": "Duet Sport dryer",
            },
            {
                "manualId": "SAMSUNG-FLEXWASH-WASHER",
                "platformId": "samsung_flexwash",
                "templateId": "washer",
                "seedDir": "samsung_flexwash",
                "label": "FlexWash",
            },
            {
                "manualId": "SAMSUNG-LAUNDRY-COMBO-WD53",
                "platformId": "samsung_laundry_combo",
                "templateId": "aio_laundry",
                "seedDir": "samsung_laundry_combo",
                "label": "WD53 combo",
            },
            {
                "manualId": "UNCLEARED-ARCH-MANUAL",
                "platformId": "samsung_flexwash",
                "templateId": "washer",
                "seedDir": "samsung_flexwash",
                "label": "Uncleared arch",
            },
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
    cohort_hash = sha256_file(cohort_path)
    resume_auth = tmp_path / f"CG_PRODUCTION_NORMALIZATION_BATCH_RESUME_AUTHORIZATION_{first['batchRunId']}.json"
    resume_auth.write_text(
        json.dumps(
            {
                "batchRunId": first["batchRunId"],
                "cohortHash": cohort_hash,
                "observationManifestHash": first["manifestHash"],
                "processingManifestHash": first["manifestHash"],
                "remediationCommit": "test",
                "allowedManifestDelta": {"addedFields": [], "manualIds": []},
                "architectureExceptionClearances": [],
            }
        ),
        encoding="utf-8",
    )
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
                resume_authorization_path=resume_auth,
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


OBSERVATION_MANIFEST_HASH = "857b4852617ac8169fb2e5cb48d4cd3475500f40d6e89d5fe800aea46bd24f4e"
PROCESSING_MANIFEST_HASH = "0d537288a76ed9b2bdc3fd7fec8ccb9e5187bf282dc68b917790a1fd184a4013"
OBSERVATION_COHORT_HASH = "5d21398612d00da6f74f94c7d283a10cd5e94a4ac7eb0078fc99f0446e17f4cf"
BATCH_RUN_ID = "batch-20260918-5d213986"


def _resume_cohort(tmp_path: Path) -> Path:
    cohort = {
        "schemaVersion": "1.0.0",
        "sourceOfTruth": "frontend/components/diagnostics/procedures/procedureManualManifest.json",
        "entries": [
            {
                "manualId": "W8178559",
                "platformId": "whirlpool_duet_sport_dryer",
                "templateId": "electric_dryer",
                "provenance": {"manifestSource": "procedureManualManifest.json"},
            },
            {
                "manualId": "SAMSUNG-FLEXWASH-WASHER",
                "platformId": "samsung_flexwash",
                "templateId": "washer",
                "specialHandling": {"batchHandling": "architecture_exception_expected"},
                "provenance": {"manifestSource": "procedureManualManifest.json"},
            },
            {
                "manualId": "SAMSUNG-LAUNDRY-COMBO-WD53",
                "platformId": "samsung_laundry_combo",
                "templateId": "aio_laundry",
                "provenance": {"manifestSource": "procedureManualManifest.json"},
            },
        ],
    }
    path = tmp_path / "resume_cohort.json"
    path.write_text(json.dumps(cohort), encoding="utf-8")
    return path


def _resume_checkpoint(tmp_path: Path, *, cohort_hash: str = OBSERVATION_COHORT_HASH) -> Path:
    checkpoint = {
        "batchRunId": BATCH_RUN_ID,
        "manifestHash": OBSERVATION_MANIFEST_HASH,
        "cohortHash": cohort_hash,
        "startedAt": "2026-09-18T06:18:51.882942+00:00",
        "manualAudits": [
            {
                "manualId": "W8178559",
                "batchState": "completed",
                "primaryDisposition": "canonical_mapping",
                "provenance": {"contentHash": "abc"},
            },
            {
                "manualId": "SAMSUNG-FLEXWASH-WASHER",
                "batchState": "stopped_trigger",
                "primaryDisposition": "architecture_exception",
                "hasCanonicalMappings": True,
                "hasOverlayCandidates": True,
                "hasUnresolvedTerms": True,
                "counts": {"promotionBlocked": True},
                "provenance": {"contentHash": "flex"},
            },
            {
                "manualId": "SAMSUNG-LAUNDRY-COMBO-WD53",
                "batchState": "pending",
                "primaryDisposition": "pending",
                "provenance": {},
            },
        ],
    }
    path = tmp_path / f"CG_PRODUCTION_NORMALIZATION_BATCH_CHECKPOINT_{BATCH_RUN_ID}.json"
    path.write_text(json.dumps(checkpoint), encoding="utf-8")
    return path


def _resume_authorization(tmp_path: Path, **overrides: object) -> Path:
    payload = {
        "batchRunId": BATCH_RUN_ID,
        "cohortHash": OBSERVATION_COHORT_HASH,
        "observationManifestHash": OBSERVATION_MANIFEST_HASH,
        "processingManifestHash": PROCESSING_MANIFEST_HASH,
        "remediationCommit": "27cf998f",
        "allowedManifestDelta": {
            "addedFields": ["procedureInheritance"],
            "manualIds": ["SAMSUNG-RS22T-SXS", "INSIGNIA-RTM18-FRIDGE"],
        },
        "architectureExceptionClearances": [
            {
                "manualId": "SAMSUNG-FLEXWASH-WASHER",
                "historicalBatchState": "stopped_trigger",
                "historicalPrimaryDisposition": "architecture_exception",
                "historicalArtifact": (
                    "normalization/candidates/SAMSUNG-FLEXWASH-WASHER/architecture_exception.json"
                ),
                "frozenContract": "flexwash_integration_boundary_functional_contract_frozen_v1.json",
                "freezeClosure": "CG_P08_FLEXWASH_FREEZE_CLOSURE_v1.json",
                "resumeDisposition": "skipped_authorized",
                "resumeSkippedReason": "architecture_exception_cleared_frozen_integration_boundary",
                "reNormalize": False,
            }
        ],
    }
    payload.update(overrides)
    path = tmp_path / f"CG_PRODUCTION_NORMALIZATION_BATCH_RESUME_AUTHORIZATION_{BATCH_RUN_ID}.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def _mini_manifest_pair(tmp_path: Path) -> tuple[Path, Path]:
    baseline = {
        "manuals": [
            {"manualId": "BASE-A", "seedDir": "a"},
            {"manualId": "BASE-B", "seedDir": "b"},
        ]
    }
    current = {
        "manuals": [
            {"manualId": "BASE-A", "seedDir": "a"},
            {
                "manualId": "BASE-B",
                "seedDir": "b",
                "procedureInheritance": {"mode": "explicit_sibling_reuse"},
            },
        ]
    }
    baseline_path = tmp_path / "baseline.json"
    current_path = tmp_path / "current.json"
    baseline_path.write_text(json.dumps(baseline, indent=2), encoding="utf-8")
    current_path.write_text(json.dumps(current, indent=2), encoding="utf-8")
    return baseline_path, current_path


def _resume_fixture(tmp_path: Path) -> tuple[Path, Path, Path, str]:
    cohort_path = _resume_cohort(tmp_path)
    cohort_hash = sha256_file(cohort_path)
    checkpoint = _resume_checkpoint(tmp_path, cohort_hash=cohort_hash)
    resume_auth = _resume_authorization(tmp_path, cohortHash=cohort_hash)
    return cohort_path, checkpoint, resume_auth, cohort_hash


def test_resume_without_authorization_fails_closed(tmp_path: Path, monkeypatch):
    cohort_path, checkpoint, _, _ = _resume_fixture(tmp_path)
    monkeypatch.setattr("normalization.batch_orchestrator.checkpoint_path", lambda _id: checkpoint)
    with pytest.raises(BatchManifestFreezeError):
        run_batch(
            BatchRunOptions(
                cohort_path=cohort_path,
                skip_auth=True,
                dry_run=True,
                write_artifacts=False,
                resume_batch_run_id=BATCH_RUN_ID,
                manifest_loader_fn=_fake_manifest,
            )
        )


def test_resume_wrong_processing_manifest_hash_fails(tmp_path: Path, monkeypatch):
    cohort_path, checkpoint, _, cohort_hash = _resume_fixture(tmp_path)
    resume_auth = _resume_authorization(
        tmp_path,
        cohortHash=cohort_hash,
        processingManifestHash="deadbeef",
    )
    monkeypatch.setattr("normalization.batch_orchestrator.checkpoint_path", lambda _id: checkpoint)
    with pytest.raises(BatchManifestFreezeError, match="processing manifestHash"):
        run_batch(
            BatchRunOptions(
                cohort_path=cohort_path,
                skip_auth=True,
                dry_run=True,
                write_artifacts=False,
                resume_batch_run_id=BATCH_RUN_ID,
                resume_authorization_path=resume_auth,
                manifest_path=REPO_ROOT / "frontend/components/diagnostics/procedures/procedureManualManifest.json",
                manifest_loader_fn=_fake_manifest,
            )
        )


def test_resume_wrong_cohort_hash_fails(tmp_path: Path, monkeypatch):
    cohort_path, checkpoint, _, cohort_hash = _resume_fixture(tmp_path)
    resume_auth = _resume_authorization(tmp_path, cohortHash="0" * 64)
    monkeypatch.setattr("normalization.batch_orchestrator.checkpoint_path", lambda _id: checkpoint)
    with pytest.raises(BatchManifestFreezeError, match="cohortHash"):
        run_batch(
            BatchRunOptions(
                cohort_path=cohort_path,
                skip_auth=True,
                dry_run=True,
                write_artifacts=False,
                resume_batch_run_id=BATCH_RUN_ID,
                resume_authorization_path=resume_auth,
                manifest_loader_fn=_fake_manifest,
            )
        )


def test_resume_unauthorized_manifest_delta_fails(tmp_path: Path):
    _, current_path = _mini_manifest_pair(tmp_path)
    mutated = {
        "manuals": [
            {"manualId": "BASE-A", "seedDir": "a", "procedureInheritance": {"mode": "bad"}},
            {"manualId": "BASE-B", "seedDir": "b"},
        ]
    }
    current_path.write_text(json.dumps(mutated, indent=2), encoding="utf-8")
    with pytest.raises(BatchManifestFreezeError, match="unauthorized manifest delta"):
        verify_authorized_manifest_delta(
            current_path,
            "observation-hash-unused",
            {
                "addedFields": ["procedureInheritance"],
                "manualIds": ["BASE-B"],
            },
        )


def test_valid_resume_authorization_accepts_remediated_manifest():
    manifest_path = REPO_ROOT / "frontend/components/diagnostics/procedures/procedureManualManifest.json"
    resume_auth_path = (
        REPO_ROOT
        / "frontend/components/diagnostics/knowledge/normalization/calibration"
        / f"CG_PRODUCTION_NORMALIZATION_BATCH_RESUME_AUTHORIZATION_{BATCH_RUN_ID}.json"
    )
    checkpoint = {
        "batchRunId": BATCH_RUN_ID,
        "manifestHash": OBSERVATION_MANIFEST_HASH,
        "cohortHash": OBSERVATION_COHORT_HASH,
        "manualAudits": [
            {
                "manualId": "SAMSUNG-FLEXWASH-WASHER",
                "batchState": "stopped_trigger",
                "primaryDisposition": "architecture_exception",
            }
        ],
    }
    resume_auth = json.loads(resume_auth_path.read_text(encoding="utf-8"))
    context = validate_resume_authorization(
        resume_auth,
        batch_run_id=BATCH_RUN_ID,
        checkpoint=checkpoint,
        manifest_path=manifest_path,
        cohort_hash=OBSERVATION_COHORT_HASH,
        processing_manifest_hash=compute_manifest_hash(manifest_path),
        resume_auth_path=resume_auth_path,
    )
    assert context["processingManifestHash"] == PROCESSING_MANIFEST_HASH
    assert context["observationManifestHash"] == OBSERVATION_MANIFEST_HASH
    assert context["resumeGeneration"] == 2


def test_resume_skip_set_and_flexwash_cleared_stop(tmp_path: Path, monkeypatch):
    cohort_path, checkpoint, resume_auth, _ = _resume_fixture(tmp_path)
    normalize_calls: list[str] = []

    def _normalize(manual_entry: dict) -> dict:
        normalize_calls.append(str(manual_entry["manualId"]))
        return {
            "manualId": manual_entry["manualId"],
            "manifest": {"status": "candidate"},
        }

    monkeypatch.setattr("normalization.batch_orchestrator.checkpoint_path", lambda _id: checkpoint)
    result = run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
            resume_batch_run_id=BATCH_RUN_ID,
            resume_authorization_path=resume_auth,
                normalize_manual_fn=_normalize,
                manifest_loader_fn=_resume_manifest,
            )
        )

    flexwash_audits = [
        audit for audit in result["manualAudits"] if audit["manualId"] == "SAMSUNG-FLEXWASH-WASHER"
    ]
    assert any(audit["batchState"] == "stopped_trigger" for audit in flexwash_audits)
    assert any(audit["batchState"] == "cleared_stop" for audit in flexwash_audits)
    assert "W8178559" not in normalize_calls
    assert "SAMSUNG-FLEXWASH-WASHER" not in normalize_calls
    assert normalize_calls == ["SAMSUNG-LAUNDRY-COMBO-WD53"]
    assert result["batchStatus"] == "completed"
    assert result.get("resumeGeneration") == 2
    assert result["manualsPending"] == 0
    assert result["manualsCompleted"] == len(json.loads(cohort_path.read_text(encoding="utf-8"))["entries"])


def test_compute_batch_manual_counts_ignores_superseded_pending_rows():
    cohort_size = 3
    manual_audits = [
        {"manualId": "A", "batchState": "completed"},
        {"manualId": "B", "batchState": "pending"},
        {"manualId": "B", "batchState": "completed"},
        {"manualId": "C", "batchState": "skipped_authorized"},
    ]
    completed, pending = compute_batch_manual_counts(
        manual_audits,
        batch_status="completed",
        cohort_size=cohort_size,
    )
    assert completed == cohort_size
    assert pending == 0


def test_completed_batch_reports_zero_pending_after_resume_style_continuation(tmp_path: Path, monkeypatch):
    cohort_path, checkpoint, resume_auth, _ = _resume_fixture(tmp_path)
    cohort = json.loads(cohort_path.read_text(encoding="utf-8"))
    cohort["entries"] = [
        {
            "manualId": "W8178559",
            "platformId": "whirlpool_duet_sport_dryer",
            "templateId": "electric_dryer",
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        },
        {
            "manualId": "SAMSUNG-FLEXWASH-WASHER",
            "platformId": "samsung_flexwash",
            "templateId": "washer",
            "specialHandling": {"batchHandling": "architecture_exception_expected"},
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        },
        {
            "manualId": "SAMSUNG-LAUNDRY-COMBO-WD53",
            "platformId": "samsung_laundry_combo",
            "templateId": "aio_laundry",
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        },
    ]
    cohort_path.write_text(json.dumps(cohort), encoding="utf-8")
    checkpoint_data = json.loads(checkpoint.read_text(encoding="utf-8"))
    checkpoint_data["manualAudits"] = [
        {
            "manualId": "W8178559",
            "batchState": "completed",
            "primaryDisposition": "canonical_mapping",
            "provenance": {"contentHash": "abc"},
        },
        {
            "manualId": "SAMSUNG-FLEXWASH-WASHER",
            "batchState": "stopped_trigger",
            "primaryDisposition": "architecture_exception",
            "provenance": {"contentHash": "flex"},
        },
        {
            "manualId": "SAMSUNG-LAUNDRY-COMBO-WD53",
            "batchState": "pending",
            "primaryDisposition": "pending",
            "provenance": {},
        },
    ]
    checkpoint.write_text(json.dumps(checkpoint_data), encoding="utf-8")

    monkeypatch.setattr("normalization.batch_orchestrator.checkpoint_path", lambda _id: checkpoint)
    result = run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
            resume_batch_run_id=BATCH_RUN_ID,
            resume_authorization_path=resume_auth,
            normalize_manual_fn=lambda entry: {
                "manualId": entry["manualId"],
                "manifest": {"status": "candidate"},
            },
            manifest_loader_fn=_resume_manifest,
        )
    )

    latest = {}
    for audit in result["manualAudits"]:
        latest[audit["manualId"]] = audit["batchState"]
    assert result["batchStatus"] == "completed"
    assert result["manualsCompleted"] == 3
    assert result["manualsPending"] == 0
    assert latest["SAMSUNG-LAUNDRY-COMBO-WD53"] == "completed"
    assert latest["SAMSUNG-FLEXWASH-WASHER"] == "cleared_stop"
    assert "pending" not in latest.values()


def test_non_cleared_architecture_exception_still_stops(tmp_path: Path, monkeypatch):
    cohort = json.loads(_resume_cohort(tmp_path).read_text(encoding="utf-8"))
    cohort["entries"].append(
        {
            "manualId": "UNCLEARED-ARCH-MANUAL",
            "platformId": "samsung_flexwash",
            "templateId": "washer",
            "specialHandling": {"batchHandling": "architecture_exception_expected"},
            "provenance": {"manifestSource": "procedureManualManifest.json"},
        }
    )
    cohort_path = tmp_path / "resume_cohort_with_uncleared.json"
    cohort_path.write_text(json.dumps(cohort), encoding="utf-8")
    checkpoint_data = json.loads(_resume_checkpoint(tmp_path).read_text(encoding="utf-8"))
    checkpoint_data["manualAudits"].append(
        {
            "manualId": "UNCLEARED-ARCH-MANUAL",
            "batchState": "pending",
            "primaryDisposition": "pending",
            "provenance": {},
        }
    )
    cohort_hash = sha256_file(cohort_path)
    checkpoint = tmp_path / f"CG_PRODUCTION_NORMALIZATION_BATCH_CHECKPOINT_{BATCH_RUN_ID}.json"
    checkpoint_data["cohortHash"] = cohort_hash
    checkpoint.write_text(json.dumps(checkpoint_data), encoding="utf-8")
    resume_auth = _resume_authorization(tmp_path, cohortHash=cohort_hash)
    arch_path = (
        REPO_ROOT
        / "frontend/components/diagnostics/knowledge/normalization/candidates/UNCLEARED-ARCH-MANUAL"
    )
    arch_path.mkdir(parents=True, exist_ok=True)
    (arch_path / "architecture_exception.json").write_text(
        json.dumps({"manualId": "UNCLEARED-ARCH-MANUAL", "batchDisposition": "STOP"}),
        encoding="utf-8",
    )
    (arch_path / "canonical_mapping_candidates.json").write_text(
        json.dumps({"manualId": "UNCLEARED-ARCH-MANUAL", "candidates": []}),
        encoding="utf-8",
    )
    (arch_path / "overlay_candidates.json").write_text(
        json.dumps({"manualId": "UNCLEARED-ARCH-MANUAL", "candidates": []}),
        encoding="utf-8",
    )
    (arch_path / "conflicts.json").write_text(
        json.dumps({"manualId": "UNCLEARED-ARCH-MANUAL", "conflicts": []}),
        encoding="utf-8",
    )
    (arch_path / "normalized_procedures.json").write_text(
        json.dumps({"manualId": "UNCLEARED-ARCH-MANUAL", "procedures": []}),
        encoding="utf-8",
    )

    monkeypatch.setattr("normalization.batch_orchestrator.checkpoint_path", lambda _id: checkpoint)
    try:
        result = run_batch(
            BatchRunOptions(
                cohort_path=cohort_path,
                skip_auth=True,
                dry_run=True,
                write_artifacts=False,
                resume_batch_run_id=BATCH_RUN_ID,
                resume_authorization_path=resume_auth,
                    normalize_manual_fn=lambda entry: {
                        "manualId": entry["manualId"],
                        "manifest": {"status": "candidate"},
                    },
                    manifest_loader_fn=_resume_manifest,
                )
            )
    finally:
        for path in arch_path.glob("*"):
            path.unlink()
        arch_path.rmdir()

    uncleared_audits = [
        audit for audit in result["manualAudits"] if audit["manualId"] == "UNCLEARED-ARCH-MANUAL"
    ]
    assert len(uncleared_audits) >= 2
    uncleared = uncleared_audits[-1]
    assert uncleared["batchState"] == "stopped_trigger"
    assert result["batchStatus"] == "stopped"


def test_resume_force_remains_false_by_default(tmp_path: Path, monkeypatch):
    cohort_path, checkpoint, resume_auth, _ = _resume_fixture(tmp_path)
    captured_force: list[bool] = []

    def _normalize(manual_entry: dict) -> dict:
        return {"manualId": manual_entry["manualId"], "manifest": {"status": "candidate"}}

    def _wrapped(entry: dict) -> dict:
        return _normalize(entry)

    monkeypatch.setattr("normalization.batch_orchestrator.checkpoint_path", lambda _id: checkpoint)
    run_batch(
        BatchRunOptions(
            cohort_path=cohort_path,
            skip_auth=True,
            dry_run=True,
            write_artifacts=False,
            resume_batch_run_id=BATCH_RUN_ID,
            resume_authorization_path=resume_auth,
                normalize_manual_fn=_normalize,
                manifest_loader_fn=_resume_manifest,
            )
        )
    assert captured_force == []


def test_flexwash_clearance_rejects_missing_contract(tmp_path: Path):
    checkpoint = json.loads(
        _resume_checkpoint(tmp_path).read_text(encoding="utf-8"),
    )
    clearance = {
        "manualId": "SAMSUNG-FLEXWASH-WASHER",
        "historicalBatchState": "stopped_trigger",
        "historicalPrimaryDisposition": "architecture_exception",
        "historicalArtifact": "normalization/candidates/SAMSUNG-FLEXWASH-WASHER/architecture_exception.json",
        "frozenContract": "missing-contract.json",
        "freezeClosure": "CG_P08_FLEXWASH_FREEZE_CLOSURE_v1.json",
        "reNormalize": False,
    }
    with pytest.raises(BatchManifestFreezeError, match="missing frozen contract"):
        from normalization.batch_orchestrator import _verify_architecture_exception_clearance

        _verify_architecture_exception_clearance(clearance, checkpoint)
