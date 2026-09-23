from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.candidate_review_index_refresh import (
    refresh_changeset_path,
    refresh_path,
    run_candidate_review_index_refresh_gate,
)
from normalization.review.matcher_improvement_production_reconciliation import reconciliation_path
from normalization.review.wave1_closure_audit import validate_frozen_hashes


def test_production_reconciliation_prerequisite_green():
    recon = json.loads(reconciliation_path().read_text(encoding="utf-8"))
    assert recon["status"] == "GREEN"
    assert recon.get("mutationsApplied") is True
    assert recon.get("canonicalPromotionImplied") is False


def test_index_refresh_dry_run_reports_diff_without_writing_index(tmp_path, monkeypatch):
    from normalization.review import candidate_review_index_refresh as refresh_mod
    from normalization.review.candidate_review_index import index_path, write_candidate_review_index
    from normalization.review.candidate_review_index import build_candidate_review_index

    original_index_path = index_path()
    if not original_index_path.is_file():
        pytest.skip("production review index missing")

    before_bytes = original_index_path.read_bytes()
    payload = run_candidate_review_index_refresh_gate(apply_mutations=False)
    assert original_index_path.read_bytes() == before_bytes
    refresh = payload["refresh"]
    assert refresh["derivedIndexRefreshOnly"] is True
    assert refresh["matcherExecuted"] is False
    assert refresh["canonicalPromotionImplied"] is False
    assert refresh["productionCandidateMutation"] is False
    summary = refresh["summary"]
    assert summary["sourceCandidatePopulation"] == summary["indexPopulationAfter"]
    assert summary["duplicateCandidateIdentities"] == 0


def test_index_refresh_artifacts_green_after_gate_run():
    if not refresh_path().is_file():
        pytest.skip("run candidate review index refresh gate first")
    refresh = json.loads(refresh_path().read_text(encoding="utf-8"))
    assert refresh["status"] == "GREEN"
    assert refresh["mutationsApplied"] is True
    assert refresh["summary"]["duplicateCandidateIdentities"] == 0
    assert refresh["integrity"]["productionDecisionsCount"] == 796
    idem = refresh.get("idempotentSecondPass") or {}
    assert idem.get("semanticFingerprintMatch") is True
    extra = idem.get("recordDiff") or {}
    assert not extra.get("additions")
    assert not extra.get("removals")
    assert not extra.get("modified")
    changeset = json.loads(refresh_changeset_path().read_text(encoding="utf-8"))
    assert changeset["unauthorizedIndexMutations"] == []
    hashes_ok, _ = validate_frozen_hashes()
    assert hashes_ok
