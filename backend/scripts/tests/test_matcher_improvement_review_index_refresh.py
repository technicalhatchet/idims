from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.candidate_review_decisions import decisions_path
from normalization.review.matcher_improvement_production_reconciliation import reconciliation_path
from normalization.review.matcher_improvement_review_index_refresh import (
    refresh_changeset_path,
    refresh_path,
    run_matcher_improvement_review_index_refresh_gate,
)
from normalization.review.wave1_closure_audit import validate_frozen_hashes


def test_reconciliation_prerequisite_green():
    recon = json.loads(reconciliation_path().read_text(encoding="utf-8"))
    assert recon["status"] == "GREEN"
    assert recon.get("canonicalPromotionImplied") is False


def test_review_index_refresh_gate_dry_run_preserves_decisions_bytes():
    before = decisions_path().read_bytes()
    payload = run_matcher_improvement_review_index_refresh_gate(apply_mutations=False)
    assert decisions_path().read_bytes() == before
    refresh = payload["refresh"]
    assert refresh["matcherExecuted"] is False
    assert refresh["canonicalPromotionImplied"] is False
    assert refresh["productionCandidateMutation"] is False


def test_review_index_refresh_artifacts_after_apply():
    if not refresh_path().is_file():
        pytest.skip("run matcher improvement review index refresh gate first")
    refresh = json.loads(refresh_path().read_text(encoding="utf-8"))
    assert refresh["status"] == "GREEN"
    assert refresh["integrity"]["decisionsByteIdentical"] is True
    tally = refresh["summary"]["historicalDecisionReconciliation"]
    assert sum(tally.values()) == 796
    assert tally.get("HISTORICAL_CANDIDATE_MISSING", 0) == 0
    assert not refresh["missingHistoricalCandidates"]
    wave = refresh["waveRegression"]
    assert wave["wave1"]["historicalDecisionCohort"] == 370
    assert wave["wave1"]["accepted"] == 328
    assert wave["wave2"]["accepted"] == 426
    baseline = refresh.get("baselineVerification") or []
    staging_only = [b for b in baseline if b.get("status") == "staging_only_absent"]
    assert len(staging_only) == 10
    hashes_ok, _ = validate_frozen_hashes()
    assert hashes_ok
    changeset = json.loads(refresh_changeset_path().read_text(encoding="utf-8"))
    assert changeset["status"] == "GREEN"
