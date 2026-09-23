from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANDIDATES_DIR, REVIEW_DIR
from normalization.review.matcher_improvement_delta_reconciliation import (
    build_population_a,
    build_population_b,
    queue_path,
    reconciliation_path,
    run_delta_reconciliation_gate,
    run_preflight_checks,
)
from normalization.review.matcher_improvement_delta_reconciliation_decisions import (
    decisions_path,
    load_delta_reconciliation_decisions,
)
from normalization.review.matcher_improvement_delta_review import delta_review_path
from normalization.review.matcher_improvement_full_corpus_regeneration import staging_root


def test_preflight_checks_pass():
    errors, checks = run_preflight_checks()
    assert errors == []
    assert checks.get("frozenHashes") is True
    assert checks.get("productionDecisionCount") == 796


def test_delta_reconciliation_gate_green():
    if not delta_review_path().is_file() or not staging_root().is_dir():
        pytest.skip("delta review / staged corpus missing")
    payload = run_delta_reconciliation_gate(initialize_decisions=False)
    recon = payload["reconciliation"]
    assert recon["status"] == "GREEN — DELTA RECONCILIATION READY"
    assert recon["populationSummary"]["populationA"] == 46
    assert recon["populationSummary"]["populationBUnique"] >= 8
    assert recon["reconciliation"]["automaticDecisionsApplied"] is False


def test_queue_and_decisions_isolated():
    if not queue_path().is_file():
        pytest.skip("run preflight first")
    queue = json.loads(queue_path().read_text(encoding="utf-8"))
    assert len(queue.get("populationA") or []) == 46
    store = load_delta_reconciliation_decisions()
    assert store.get("automaticDecisionsApplied") is False
    assert decisions_path().resolve().parent == REVIEW_DIR.resolve()
    assert staging_root().resolve() != CANDIDATES_DIR.resolve()


def test_population_b_excludes_matcher_backlog():
    delta = json.loads(delta_review_path().read_text(encoding="utf-8"))
    pop_b = build_population_b(delta)
    for item in pop_b:
        assert not item.get("matcherImprovementBacklogId")
