from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.candidate_review_decisions import load_decisions
from normalization.review.matcher_reconciled_candidate_review import (
    EXPECTED_SCOPE,
    review_path,
    run_preflight,
    run_review_gate,
)
from normalization.review.matcher_reconciled_candidate_review_decisions import (
    ALLOWED_DECISIONS,
    decisions_path,
    load_matcher_reconciled_decisions,
)
from normalization.review.wave1_closure_audit import validate_frozen_hashes
from normalization.review.wave1_existing_canonical_mapping import load_review_index, select_wave_candidates as select_wave1
from normalization.review.wave2_new_platform_knowledge import select_wave_candidates as select_wave2


def test_preflight_exact_fifty_two_scope():
    preflight = run_preflight()
    assert preflight["passed"] is True
    assert preflight["expectedScope"] == 52
    assert len(preflight["scopeCandidateIds"]) == 52
    assert len(set(preflight["scopeCandidateIds"])) == 52
    assert not preflight["overlap"]["wave1"]
    assert not preflight["overlap"]["wave2"]
    assert not preflight["overlap"]["historical796"]
    assert preflight["canonicalPromotionImplied"] is False


def test_review_gate_artifacts_green():
    payload = run_review_gate(write_artifacts=True)
    assert payload["review"]["status"] == "GREEN"
    assert payload["review"]["expectedScopeCount"] == EXPECTED_SCOPE
    assert len(payload["review"]["scopeRecords"]) == EXPECTED_SCOPE
    on_disk = json.loads(review_path().read_text(encoding="utf-8"))
    assert on_disk["status"] == "GREEN"


def test_decision_store_isolated_from_796():
    store = load_matcher_reconciled_decisions()
    assert store.get("mergedIntoProductionReviewDecisions") is False
    assert store.get("automaticDecisionsApplied") is False
    assert decisions_path().name == "CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_v1.json"
    assert len(load_decisions().get("decisions") or {}) == 796


def test_allowed_decision_vocabulary():
    assert ALLOWED_DECISIONS == frozenset({"accepted", "deferred", "rejected"})


def test_scope_not_in_wave_decision_cohorts():
    preflight = run_preflight()
    ids = set(preflight["scopeCandidateIds"])
    prod = load_decisions().get("decisions") or {}
    index = load_review_index()
    wave2 = {r["candidateId"] for r in select_wave2(index)}
    wave1_decisions = {cid for cid in prod if cid not in wave2}
    assert not ids & wave1_decisions
    assert not ids & wave2
    hashes_ok, _ = validate_frozen_hashes()
    assert hashes_ok
