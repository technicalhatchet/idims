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
from normalization.review.existing_frozen_mapping_missed_drilldown import (
    EXPECTED_MISSED_COUNT,
    MATCHING_FAILURE_MODES,
    drilldown_audit_path,
    drilldown_path,
    run_existing_frozen_mapping_missed_drilldown,
    select_existing_frozen_mapping_missed_records,
    write_existing_frozen_mapping_missed_drilldown,
)
from normalization.review.frozen_canonical_vocabulary import load_frozen_canonical_ids
from normalization.review.unresolved_pool_analysis import pool_content_hash, select_unresolved_candidates
from normalization.review.wave1_existing_canonical_mapping import load_review_index


@pytest.fixture
def live_index():
    return load_review_index()


def test_missed_pool_is_374(live_index):
    decisions = load_decisions()
    frozen_ids = load_frozen_canonical_ids()
    records, _ = select_existing_frozen_mapping_missed_records(live_index, decisions, frozen_ids)
    assert len(records) == EXPECTED_MISSED_COUNT


def test_drilldown_integrity_and_labels(live_index):
    before_hash = pool_content_hash(select_unresolved_candidates(live_index))
    before_decisions = load_decisions()

    payload = run_existing_frozen_mapping_missed_drilldown()
    drilldown = payload["drilldown"]
    audit = payload["audit"]

    assert drilldown["status"] == "READ_ONLY_FROZEN_MAPPING_MISSED_DRILLDOWN_COMPLETE"
    assert audit["status"] == "READ_ONLY_FROZEN_MAPPING_MISSED_DRILLDOWN_COMPLETE"
    assert drilldown["analyzedRecordCount"] == 374
    assert set(drilldown["matchingFailureModeCounts"]) <= MATCHING_FAILURE_MODES
    assert drilldown["mutationPolicy"]["matcherChanged"] is False
    assert drilldown["mutationPolicy"]["aliasesAdded"] is False
    assert drilldown["mutationPolicy"]["newCanonicalFunctionsInferred"] is False

    for item in drilldown["matcherImprovementBacklog"][:20]:
        assert item["implementationAuthorized"] is False
        if item.get("frozenCanonicalId"):
            assert item["frozenCanonicalId"] != "__no_single_target__"

    assert audit["integrityChecks"]["passed"] is True
    assert audit["integrityChecks"]["analyzedExistingFrozenMappingMissedCount"] == 374
    assert audit["integrityChecks"]["unresolvedCount"] == 1100
    assert audit["integrityChecks"]["canonicalMappingGapCount"] == 1078

    after_hash = pool_content_hash(select_unresolved_candidates(load_review_index()))
    assert before_hash == after_hash
    assert before_decisions == load_decisions()


def test_write_drilldown_artifacts():
    payload = run_existing_frozen_mapping_missed_drilldown()
    d_path, a_path = write_existing_frozen_mapping_missed_drilldown(payload)
    assert d_path == drilldown_path()
    assert a_path == drilldown_audit_path()
    loaded = json.loads(d_path.read_text(encoding="utf-8"))
    assert loaded["executiveAnswers"]["smallestSafeMatcherAliasBacklog"] is not None


def test_frozen_hash_regression():
    registry = json.loads((CALIBRATION_DIR / "frozen_canonical_hashes_v1.json").read_text(encoding="utf-8"))
    for ontology_id, entry in registry["frozenOntologies"].items():
        path = Path(__file__).resolve().parents[3] / entry["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["hash"], ontology_id
