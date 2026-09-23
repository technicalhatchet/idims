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
from normalization.review.unresolved_pool_analysis import (
    BATCH_RUN_ID,
    REVIEW_CLASS,
    analysis_path,
    assign_governance_hints,
    audit_path,
    pool_content_hash,
    run_unresolved_pool_analysis,
    select_unresolved_candidates,
    write_unresolved_pool_analysis,
)
from normalization.review.wave1_existing_canonical_mapping import load_review_index


@pytest.fixture
def live_index():
    return load_review_index()


def test_unresolved_pool_count_matches_inventory(live_index):
    unresolved = select_unresolved_candidates(live_index)
    assert live_index["batchRunId"] == BATCH_RUN_ID
    assert live_index["countsByReviewClass"][REVIEW_CLASS] == 1100
    assert len(unresolved) == 1100


def test_governance_hints_never_use_new_canonical_knowledge_label(live_index):
    unresolved = select_unresolved_candidates(live_index)
    for record in unresolved[:200]:
        hints = assign_governance_hints(record)
        assert "newCanonicalKnowledge" not in hints
        assert all(hint != "newCanonicalKnowledge" for hint in hints)


def test_analysis_is_read_only_and_preserves_pool(live_index):
    before_hash = pool_content_hash(select_unresolved_candidates(live_index))
    before_decisions = len(load_decisions().get("decisions") or {})

    payload = run_unresolved_pool_analysis()
    assert payload["analysis"]["status"] == "READ_ONLY_ANALYSIS_COMPLETE"
    assert payload["audit"]["status"] == "READ_ONLY_ANALYSIS_COMPLETE"
    assert payload["analysis"]["totalUnresolvedCount"] == 1100
    assert payload["audit"]["integrityChecks"]["unresolvedCountBefore"] == 1100
    assert payload["audit"]["integrityChecks"]["unresolvedCountAfter"] == 1100
    assert payload["audit"]["integrityChecks"]["reviewDecisionCount"] == before_decisions
    assert payload["audit"]["integrityChecks"]["frozenCanonicalHashesValid"] is True
    assert payload["audit"]["integrityChecks"]["wave1ClosureIntact"] is True
    assert payload["audit"]["integrityChecks"]["wave2ClosureIntact"] is True
    assert payload["audit"]["integrityChecks"]["wave3Empty"] is True
    assert payload["audit"]["integrityChecks"]["promotionPerformed"] is False

    after_hash = pool_content_hash(select_unresolved_candidates(load_review_index()))
    after_decisions = len(load_decisions().get("decisions") or {})
    assert before_hash == after_hash
    assert before_decisions == after_decisions


def test_analysis_includes_expected_aggregate_sections():
    payload = run_unresolved_pool_analysis()
    analysis = payload["analysis"]
    assert analysis["countsByCandidateType"]["canonicalMapping"] == 1078
    assert analysis["countsByProposedCanonicalId"]["__none__"] == 1078
    assert analysis["countsBySourceTermPattern"]["manual_section_heading"] == 323
    assert len(analysis["topRepeatedPatterns"]) > 0
    assert analysis["mutationPolicy"]["readOnly"] is True


def test_write_analysis_artifacts():
    payload = run_unresolved_pool_analysis()
    analysis_file, audit_file = write_unresolved_pool_analysis(payload)
    assert analysis_file == analysis_path()
    assert audit_file == audit_path()
    loaded = json.loads(analysis_file.read_text(encoding="utf-8"))
    assert loaded["status"] == "READ_ONLY_ANALYSIS_COMPLETE"


def test_frozen_hash_regression():
    registry = json.loads((CALIBRATION_DIR / "frozen_canonical_hashes_v1.json").read_text(encoding="utf-8"))
    for ontology_id, entry in registry["frozenOntologies"].items():
        path = Path(__file__).resolve().parents[3] / entry["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["hash"], ontology_id
