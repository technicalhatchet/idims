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

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, REVIEW_DIR
from normalization.review.frozen_canonical_vocabulary import load_frozen_canonical_ids
from normalization.review.wave1_existing_canonical_mapping import (
    EXPECTED_CANDIDATE_COUNT,
    REVIEW_CLASS,
    load_review_index,
    run_wave1_preflight,
    select_wave_candidates,
    wave_order_key,
    WAVE_ID,
)


@pytest.fixture
def live_index():
    return load_review_index()


def test_wave1_exact_candidate_count(live_index):
    wave = select_wave_candidates(live_index)
    assert len(wave) == EXPECTED_CANDIDATE_COUNT


def test_wave1_deterministic_ordering(live_index):
    wave = select_wave_candidates(live_index)
    keys = [wave_order_key(record) for record in wave]
    assert keys == sorted(keys)


def test_wave1_no_duplicate_candidate_ids(live_index):
    wave = select_wave_candidates(live_index)
    ids = [record["candidateId"] for record in wave]
    assert len(ids) == len(set(ids))


def test_wave1_all_canonical_ids_in_frozen_vocabulary(live_index):
    frozen_ids = load_frozen_canonical_ids()
    wave = select_wave_candidates(live_index)
    for record in wave:
        proposed = record["mapsTo"]["proposedCanonicalId"]
        assert proposed
        assert str(proposed) in frozen_ids


def test_wave1_review_class_exact(live_index):
    wave = select_wave_candidates(live_index)
    assert all(record["reviewClass"] == REVIEW_CLASS for record in wave)


def test_preflight_passes_on_live_index():
    preflight = run_wave1_preflight()
    assert preflight["passed"] is True
    assert preflight["waveId"] == WAVE_ID
    assert preflight["actualCandidateCount"] == EXPECTED_CANDIDATE_COUNT
    assert preflight["frozenHashesValid"] is True
    assert preflight["decisionsGenerated"] is False


def test_preflight_fail_closed_wrong_review_class(live_index):
    mutated = deepcopy(live_index)
    for record in mutated["candidateRecords"]:
        if record.get("reviewClass") == REVIEW_CLASS:
            record["reviewClass"] = "newCanonicalKnowledge"
            break
    else:
        pytest.fail("no existingCanonicalMapping record found in live index")
    preflight = run_wave1_preflight(index=mutated)
    assert preflight["passed"] is False
    assert preflight["actualCandidateCount"] == EXPECTED_CANDIDATE_COUNT - 1


def test_preflight_fail_closed_unknown_canonical_id(live_index):
    mutated = deepcopy(live_index)
    for record in mutated["candidateRecords"]:
        if record.get("reviewClass") == REVIEW_CLASS:
            record["mapsTo"]["proposedCanonicalId"] = "definitely_not_a_frozen_canonical_id"
            break
    preflight = run_wave1_preflight(index=mutated)
    assert preflight["passed"] is False
    assert any("not in frozen vocabulary" in error for error in preflight["errors"])


def test_preflight_rejects_new_canonical_knowledge_in_index(live_index):
    mutated = deepcopy(live_index)
    mutated["candidateRecords"].append(
        {
            "candidateId": "test::canonical_mapping::new-canonical",
            "manualId": "TEST",
            "reviewClass": "newCanonicalKnowledge",
            "mapsTo": {"proposedCanonicalId": "door_lock"},
            "what": {"procedureId": "test-proc"},
        },
    )
    preflight = run_wave1_preflight(index=mutated)
    assert preflight["passed"] is False


def test_frozen_hash_validation():
    registry = json.loads((CALIBRATION_DIR / "frozen_canonical_hashes_v1.json").read_text(encoding="utf-8"))
    for ontology_id, entry in registry["frozenOntologies"].items():
        path = Path(__file__).resolve().parents[3] / entry["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["hash"], ontology_id


def test_wave_definition_artifact_exists():
    path = REVIEW_DIR / "waves" / "CG_WAVE1_EXISTING_CANONICAL_MAPPING_REVIEW_v1.json"
    assert path.is_file()
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["waveId"] == WAVE_ID
    assert payload["expectedCandidateCount"] == EXPECTED_CANDIDATE_COUNT
    assert payload["promotionExcluded"] is True
    assert payload["canonicalMutationAllowed"] is False
