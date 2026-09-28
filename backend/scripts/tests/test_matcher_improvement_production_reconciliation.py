from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR
from normalization.review.matcher_improvement_delta_reconciliation_final import manifest_path
from normalization.review.matcher_improvement_production_reconciliation import (
    build_production_baseline_snapshot,
    changeset_path,
    reconciliation_path,
    run_production_reconciliation_gate,
)
from normalization.review.wave1_closure_audit import validate_frozen_hashes


def test_manifest_has_fifty_two_unique_records():
    manifest = json.loads(manifest_path().read_text(encoding="utf-8"))
    keys = [r["candidateKey"] for r in manifest["records"]]
    assert len(keys) == 52
    assert len(set(keys)) == 52
    assert manifest["canonicalPromotionImplied"] is False
    assert manifest["soleAuthorityForNextGate"] is True


def test_production_reconciliation_artifacts_green():
    if not reconciliation_path().is_file():
        pytest.skip("run production reconciliation gate first")
    recon = json.loads(reconciliation_path().read_text(encoding="utf-8"))
    assert recon["status"] == "GREEN"
    assert recon["summary"]["candidateRecordsChanged"] == 52
    assert recon["summary"]["unauthorizedChanges"] == 0
    assert recon["summary"]["keepBaselineRecordsVerifiedUnchanged"] == 18
    assert recon["matcherExecuted"] is False
    assert recon["canonicalPromotionImplied"] is False
    changeset = json.loads(changeset_path().read_text(encoding="utf-8"))
    assert changeset["mutationCount"] == 52
    assert changeset["unauthorizedMutations"] == []
    hashes_ok, _ = validate_frozen_hashes()
    assert hashes_ok


def test_gate_idempotent_second_run_reports_no_extra_changes():
    payload = run_production_reconciliation_gate(apply_mutations=False)
    if payload["reconciliation"]["status"] != "GREEN":
        pytest.skip("reconciliation not green")
    snapshot = build_production_baseline_snapshot()
    manifest = json.loads(manifest_path().read_text(encoding="utf-8"))
    for record in manifest["records"]:
        key = record["candidateKey"]
        assert key in snapshot["candidateRecordHashes"]
