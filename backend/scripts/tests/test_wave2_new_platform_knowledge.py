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

from normalization.paths import CALIBRATION_DIR, REVIEW_DIR
from normalization.review.candidate_review_decisions import load_decisions
from normalization.review.wave1_existing_canonical_mapping import load_review_index, select_wave_candidates as select_wave1
from normalization.review.wave2_new_platform_knowledge import (
    EXPECTED_CANDIDATE_COUNT,
    REVIEW_CLASS,
    WAVE_ID,
    load_wave_definition,
    run_wave2_preflight,
    select_wave_candidates,
    wave_order_key,
)


@pytest.fixture
def live_index():
    return load_review_index()


def test_wave2_exact_candidate_count(live_index):
    wave = select_wave_candidates(live_index)
    assert len(wave) == EXPECTED_CANDIDATE_COUNT


def test_wave2_deterministic_ordering(live_index):
    wave = select_wave_candidates(live_index)
    keys = [wave_order_key(record) for record in wave]
    assert keys == sorted(keys)


def test_wave2_no_duplicate_candidate_ids(live_index):
    wave = select_wave_candidates(live_index)
    ids = [record["candidateId"] for record in wave]
    assert len(ids) == len(set(ids))


def test_wave2_review_class_exact(live_index):
    wave = select_wave_candidates(live_index)
    assert all(record["reviewClass"] == REVIEW_CLASS for record in wave)


def test_wave2_definition_artifact():
    payload = load_wave_definition()
    assert payload["waveId"] == WAVE_ID
    assert payload["expectedCandidateCount"] == EXPECTED_CANDIDATE_COUNT
    assert payload["promotionExcluded"] is True
    assert payload["canonicalMutationAllowed"] is False


def test_preflight_passes_on_live_index():
    preflight = run_wave2_preflight()
    assert preflight["passed"] is True
    assert preflight["actualCandidateCount"] == EXPECTED_CANDIDATE_COUNT
    assert preflight["frozenHashesValid"] is True
    assert preflight["wave1ClosureIntact"] is True
    assert preflight["decisionsGenerated"] is False


def test_preflight_no_wave2_decisions_generated_yet(live_index):
    wave_ids = {record["candidateId"] for record in select_wave_candidates(live_index)}
    decisions = load_decisions().get("decisions") or {}
    wave2_decisions = [candidate_id for candidate_id in wave_ids if candidate_id in decisions]
    assert wave2_decisions == []


def test_preflight_fail_closed_wrong_review_class(live_index):
    mutated = deepcopy(live_index)
    for record in mutated["candidateRecords"]:
        if record.get("reviewClass") == REVIEW_CLASS:
            record["reviewClass"] = "unresolved"
            break
    else:
        pytest.fail("no newPlatformKnowledge record found")
    preflight = run_wave2_preflight(index=mutated)
    assert preflight["passed"] is False


def test_wave2_candidate_ids_do_not_overlap_wave1(live_index):
    wave1_ids = {record["candidateId"] for record in select_wave1(live_index)}
    wave2_ids = {record["candidateId"] for record in select_wave_candidates(live_index)}
    assert wave1_ids.isdisjoint(wave2_ids)


def test_frozen_hash_validation():
    registry = json.loads((CALIBRATION_DIR / "frozen_canonical_hashes_v1.json").read_text(encoding="utf-8"))
    for ontology_id, entry in registry["frozenOntologies"].items():
        path = Path(__file__).resolve().parents[3] / entry["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["hash"], ontology_id


def test_wave2_definition_file_exists():
    path = REVIEW_DIR / "waves" / "CG_WAVE2_NEW_PLATFORM_KNOWLEDGE_REVIEW_v1.json"
    assert path.is_file()
