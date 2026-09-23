from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR
from normalization.review.candidate_review_decisions import load_decisions
from normalization.review.matcher_improvement_review import (
    EXPECTED_REVIEW_ITEM_COUNT,
    build_review_items,
    load_drilldown,
    review_audit_path,
    review_path,
    run_matcher_improvement_preflight,
    write_matcher_improvement_review_artifacts,
)
from normalization.review.unresolved_pool_analysis import pool_content_hash, select_unresolved_candidates
from normalization.review.wave1_existing_canonical_mapping import load_review_index


def test_smallest_safe_backlog_has_seventeen_items():
    drilldown = load_drilldown()
    items = build_review_items(drilldown)
    assert len(items) == EXPECTED_REVIEW_ITEM_COUNT
    for item in items:
        assert item.get("implementationAuthorized") is False
        assert item.get("frozenCanonicalId")
        assert item.get("reviewerBrief")


def test_matcher_improvement_preflight_and_integrity():
    before_hash = pool_content_hash(select_unresolved_candidates(load_review_index()))
    before_decisions = load_decisions()

    preflight = run_matcher_improvement_preflight()
    assert preflight["passed"] is True
    assert preflight["actualReviewItemCount"] == 17
    assert preflight["integrityChecks"]["passed"] is True
    assert preflight["integrityChecks"]["productionReviewDecisionCount"] == 796
    assert preflight["integrityChecks"]["unresolvedCount"] == 1100
    assert preflight["integrityChecks"]["canonicalMappingGapCount"] == 1078
    assert preflight["integrityChecks"]["matcherChanged"] is False

    after_hash = pool_content_hash(select_unresolved_candidates(load_review_index()))
    assert before_hash == after_hash
    assert before_decisions == load_decisions()


def test_write_matcher_review_artifacts():
    preflight = run_matcher_improvement_preflight()
    review_file, audit_file = write_matcher_improvement_review_artifacts(preflight)
    assert review_file == review_path()
    assert audit_file == review_audit_path()
    review = json.loads(review_file.read_text(encoding="utf-8"))
    assert review["status"] == "READY_FOR_HUMAN_MATCHER_IMPROVEMENT_REVIEW"
    assert review["matcherImplementationAllowed"] is False
    assert len(review["reviewItems"]) == 17


def test_frozen_hash_regression():
    registry = json.loads((CALIBRATION_DIR / "frozen_canonical_hashes_v1.json").read_text(encoding="utf-8"))
    for ontology_id, entry in registry["frozenOntologies"].items():
        path = Path(__file__).resolve().parents[3] / entry["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["hash"], ontology_id
