from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest import mock

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.candidate_review_decisions import decisions_path
from normalization.review.matcher_reconciled_candidate_production_apply import (
    EXPECTED_ACCEPTED,
    apply_path,
    lock_path,
    run_production_apply_gate,
    write_production_apply_artifacts,
)
from normalization.review.wave1_closure_audit import validate_frozen_hashes


def test_preflight_happy_path_no_production_mutation():
    before = decisions_path().read_bytes()
    payload = run_production_apply_gate(apply_mutations=False, apply_authorization_granted=False)
    assert decisions_path().read_bytes() == before
    apply_report = payload["apply"]
    assert apply_report["status"] == "GREEN"
    assert apply_report["productionMutationsExecuted"] is False
    assert apply_report["canonicalPromotionImplied"] is False
    assert apply_report["summary"]["authorizedScope"] == EXPECTED_ACCEPTED
    assert apply_report["summary"]["authorizedChangesPlanned"] == EXPECTED_ACCEPTED
    assert apply_report["summary"]["unauthorizedChanges"] == 0
    assert len(apply_report["preflightRecords"]) == EXPECTED_ACCEPTED
    assert payload["lock"]["applyAuthorizationGranted"] is False
    assert payload["lock"]["productionMutationsExecuted"] is False
    hashes_ok, _ = validate_frozen_hashes()
    assert hashes_ok


def test_apply_blocked_without_authorization():
    payload = run_production_apply_gate(apply_mutations=True, apply_authorization_granted=False)
    assert payload["apply"]["status"] == "STOP"
    assert any("applyAuthorizationGranted" in e for e in payload["apply"]["errors"])


def test_wrong_decision_count_fails(monkeypatch):
    from normalization.review import matcher_reconciled_candidate_production_apply as mod

    def fake_closure():
        return {
            "status": "GREEN",
            "expectedCount": 52,
            "reviewedCount": 52,
            "acceptedCount": 51,
            "deferredCount": 0,
            "rejectedCount": 0,
            "missingDecisionCandidateIds": [],
            "duplicateDecisionCount": 0,
            "outOfScopeDecisionCandidateIds": [],
            "historicalDecisionMutations": 0,
            "canonicalMutations": 0,
            "matcherMutations": 0,
            "productionCandidateMutations": 0,
            "canonicalPromotionImplied": False,
            "errors": [],
        }

    monkeypatch.setattr(mod, "_load_closure", fake_closure)
    payload = run_production_apply_gate(apply_mutations=False, apply_authorization_granted=False)
    assert payload["apply"]["status"] == "STOP"


def test_apply_mutations_true_without_authorize_stops():
    payload = run_production_apply_gate(apply_mutations=True, apply_authorization_granted=False)
    assert payload["apply"]["status"] == "STOP"
    assert payload["lock"]["productionMutationsExecuted"] is False


def test_historical_decisions_unchanged_on_preflight():
    before_hash = decisions_path().read_text(encoding="utf-8")
    run_production_apply_gate(apply_mutations=False, apply_authorization_granted=False)
    assert decisions_path().read_text(encoding="utf-8") == before_hash


def test_artifacts_written_green():
    payload = run_production_apply_gate(apply_mutations=False, apply_authorization_granted=False)
    if payload["apply"]["status"] != "GREEN":
        pytest.skip("preflight not green in workspace")
    write_production_apply_artifacts(payload)
    on_disk = json.loads(apply_path().read_text(encoding="utf-8"))
    lock = json.loads(lock_path().read_text(encoding="utf-8"))
    assert on_disk["status"] == "GREEN"
    assert lock["productionMutationsExecuted"] is False


def test_closure_duplicate_decisions_fails(monkeypatch):
    from normalization.review import matcher_reconciled_candidate_production_apply as mod

    def fake_closure():
        base = json.loads(mod.closure_path().read_text(encoding="utf-8"))
        base["duplicateDecisionCount"] = 1
        return base

    monkeypatch.setattr(mod, "_load_closure", fake_closure)
    payload = run_production_apply_gate(apply_mutations=False, apply_authorization_granted=False)
    assert payload["apply"]["status"] == "STOP"


def test_frozen_canonical_hash_failure_stops(monkeypatch):
    from normalization.review import matcher_reconciled_candidate_production_apply as mod

    monkeypatch.setattr(mod, "validate_frozen_hashes", lambda: (False, ["frozen hash mismatch"]))
    payload = run_production_apply_gate(apply_mutations=False, apply_authorization_granted=False)
    assert payload["apply"]["status"] == "STOP"
    assert any("frozen" in e.lower() for e in payload["apply"]["errors"])


def test_missing_production_candidate_stops(monkeypatch):
    from normalization.review import matcher_reconciled_candidate_production_apply as mod

    real_loader = mod._load_mapping_candidates

    def empty_one_manual(manual_id, candidates_dir):
        rows = real_loader(manual_id, candidates_dir)
        if manual_id == "FRIGIDAIRE-PRMC-FRIDGE":
            return []
        return rows

    monkeypatch.setattr(mod, "_load_mapping_candidates", empty_one_manual)
    payload = run_production_apply_gate(apply_mutations=False, apply_authorization_granted=False)
    assert payload["apply"]["status"] == "STOP"
    assert any("production candidate missing" in e for e in payload["apply"]["errors"])


def test_idempotency_when_all_stamps_already_applied(monkeypatch):
    from normalization.review import matcher_reconciled_candidate_production_apply as mod

    payload0 = run_production_apply_gate(apply_mutations=False, apply_authorization_granted=False)
    if payload0["apply"]["status"] != "GREEN":
        pytest.skip("preflight not green")
    records = payload0["apply"]["preflightRecords"]
    for r in records:
        r["alreadyApplied"] = True
        r["plannedAction"] = "noop_already_applied"

    monkeypatch.setattr(
        mod,
        "_build_preflight_records",
        lambda _accepted: (records, []),
    )
    payload = run_production_apply_gate(apply_mutations=True, apply_authorization_granted=True)
    assert payload["apply"]["status"] == "GREEN"
    assert payload["apply"]["applyState"] == "already_applied"
    assert payload["apply"]["summary"]["authorizedChangesPlanned"] == 0
    assert payload["apply"]["productionMutationsExecuted"] is True
    assert payload["apply"]["summary"]["productionFilesTouched"] == 0
