from __future__ import annotations

import hashlib
import json
import sys
from copy import deepcopy
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR
from normalization.review.candidate_review_decisions import load_decisions
from normalization.review.wave2_closure_audit import (
    EXPECTED_CANDIDATE_COUNT,
    closure_audit_path,
    reconcile_wave2_decisions,
    run_wave2_closure_audit,
)
from normalization.review.wave2_new_platform_knowledge import load_review_index, select_wave_candidates


@pytest.fixture
def live_index():
    return load_review_index()


@pytest.fixture
def live_wave(live_index):
    return select_wave_candidates(live_index)


@pytest.fixture
def live_decisions():
    return load_decisions()


def test_wave2_closure_exact_counts(live_wave, live_decisions):
    reconciliation = reconcile_wave2_decisions(live_wave, live_decisions)
    assert reconciliation["passed"] is True
    assert reconciliation["expectedCandidateCount"] == EXPECTED_CANDIDATE_COUNT
    assert reconciliation["reviewedCandidateCount"] == 426
    assert reconciliation["missingDecisionCount"] == 0
    assert reconciliation["outOfWaveDecisionCount"] == 0
    assert reconciliation["duplicateDecisionCount"] == 0


def test_wave2_closure_fail_closed_missing_decision(live_wave, live_decisions):
    mutated = deepcopy(live_decisions)
    first_id = live_wave[0]["candidateId"]
    del mutated["decisions"][first_id]
    reconciliation = reconcile_wave2_decisions(live_wave, mutated)
    assert reconciliation["passed"] is False
    assert reconciliation["missingDecisionCount"] == 1


def test_wave2_closure_audit_reports_closed(live_decisions):
    audit = run_wave2_closure_audit()
    assert audit["status"] == "WAVE2_CLOSED"
    assert audit["reviewedCandidateCount"] == 426
    assert audit["promotionPerformed"] is False
    assert audit["canonicalMutationDetected"] is False
    assert audit["candidateMutationDetected"] is False
    assert audit["wave1Integrity"]["passed"] is True
    assert audit["frozenHashValidation"]["passed"] is True
    assert len(live_decisions.get("decisions") or {}) == 796


def test_frozen_hash_regression():
    registry = json.loads((CALIBRATION_DIR / "frozen_canonical_hashes_v1.json").read_text(encoding="utf-8"))
    for ontology_id, entry in registry["frozenOntologies"].items():
        path = Path(__file__).resolve().parents[3] / entry["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["hash"], ontology_id


def test_closure_artifact_path_written():
    from normalization.review.wave2_closure_audit import write_closure_audit

    audit = run_wave2_closure_audit()
    path = write_closure_audit(audit)
    loaded = json.loads(path.read_text(encoding="utf-8"))
    assert loaded["status"] == audit["status"]
