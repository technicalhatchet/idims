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
from normalization.review.unresolved_frozen_vocabulary_gap_analysis import (
    ANALYSIS_CATEGORIES,
    analysis_path,
    audit_path,
    run_unresolved_frozen_vocabulary_gap_analysis,
    select_frozen_vocabulary_gap_records,
    select_procedure_test_binding_unresolved,
    write_unresolved_frozen_vocabulary_gap_analysis,
)
from normalization.review.unresolved_pool_analysis import pool_content_hash, select_unresolved_candidates
from normalization.review.wave1_existing_canonical_mapping import load_review_index


@pytest.fixture
def live_index():
    return load_review_index()


def test_gap_pool_counts(live_index):
    unresolved = select_unresolved_candidates(live_index)
    gap = select_frozen_vocabulary_gap_records(unresolved)
    ptb = select_procedure_test_binding_unresolved(unresolved)
    assert len(unresolved) == 1100
    assert len(gap) == 1078
    assert len(ptb) == 22


def test_gap_analysis_categories_and_integrity(live_index):
    before_hash = pool_content_hash(select_unresolved_candidates(live_index))
    before_decisions = load_decisions()

    payload = run_unresolved_frozen_vocabulary_gap_analysis()
    analysis = payload["analysis"]
    audit = payload["audit"]

    assert analysis["status"] == "READ_ONLY_MATCHER_GAP_ANALYSIS_COMPLETE"
    assert audit["status"] == "READ_ONLY_MATCHER_GAP_ANALYSIS_COMPLETE"
    assert analysis["canonicalMappingGapCount"] == 1078
    assert analysis["procedureTestBindingUnresolvedCount"] == 22
    assert set(analysis["analysisCategoryCounts"]) <= ANALYSIS_CATEGORIES
    assert analysis["mutationPolicy"]["newCanonicalKnowledgeAssigned"] is False
    assert analysis["governanceSignalsPreserved"]["AMBIGUOUS_COMPONENT"]["count"] == 35
    assert analysis["governanceSignalsPreserved"]["CROSS_APPLIANCE_TERM"]["count"] == 1

    assert audit["integrityChecks"]["passed"] is True
    assert audit["integrityChecks"]["reviewDecisionCount"] == 796
    assert audit["integrityChecks"]["wave3Empty"] is True

    after_hash = pool_content_hash(select_unresolved_candidates(load_review_index()))
    assert before_hash == after_hash
    assert before_decisions == load_decisions()


def test_write_gap_analysis_artifacts():
    payload = run_unresolved_frozen_vocabulary_gap_analysis()
    analysis_file, audit_file = write_unresolved_frozen_vocabulary_gap_analysis(payload)
    assert analysis_file == analysis_path()
    assert audit_file == audit_path()
    loaded = json.loads(analysis_file.read_text(encoding="utf-8"))
    assert loaded["mutationPolicy"]["aliasesAutoCreated"] is False


def test_frozen_hash_regression():
    registry = json.loads((CALIBRATION_DIR / "frozen_canonical_hashes_v1.json").read_text(encoding="utf-8"))
    for ontology_id, entry in registry["frozenOntologies"].items():
        path = Path(__file__).resolve().parents[3] / entry["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["hash"], ontology_id
