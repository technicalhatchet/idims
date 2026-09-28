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
from normalization.review.wave2_new_platform_knowledge import select_wave_candidates as select_wave2
from normalization.review.wave3_new_canonical_knowledge import (
    REVIEW_CLASS,
    WAVE_ID,
    expected_candidate_count,
    inventory_candidate_count,
    load_wave_definition,
    run_wave3_preflight,
    select_wave_candidates,
    wave_order_key,
)


@pytest.fixture
def live_index():
    return load_review_index()


def test_wave3_inventory_matches_definition(live_index):
    definition = load_wave_definition()
    inventory = inventory_candidate_count(live_index)
    assert definition["expectedCandidateCount"] == inventory
    assert select_wave_candidates(live_index) == [] or len(select_wave_candidates(live_index)) == inventory


def test_wave3_exact_candidate_count_from_inventory(live_index):
    wave = select_wave_candidates(live_index)
    expected = expected_candidate_count()
    assert len(wave) == expected
    assert live_index["countsByReviewClass"][REVIEW_CLASS] == expected


def test_wave3_deterministic_ordering(live_index):
    wave = select_wave_candidates(live_index)
    keys = [wave_order_key(record) for record in wave]
    assert keys == sorted(keys)


def test_wave3_definition_artifact():
    payload = load_wave_definition()
    assert payload["waveId"] == WAVE_ID
    assert payload["reviewClass"] == REVIEW_CLASS
    assert payload["promotionExcluded"] is True
    assert payload["canonicalMutationAllowed"] is False


def test_preflight_passes_on_live_index():
    preflight = run_wave3_preflight()
    assert preflight["passed"] is True
    assert preflight["actualCandidateCount"] == preflight["expectedCandidateCount"]
    assert preflight["frozenHashesValid"] is True
    assert preflight["wave1ClosureIntact"] is True
    assert preflight["wave2ClosureIntact"] is True
    assert preflight["decisionsGenerated"] is False
    assert preflight["wave3DecisionCount"] == 0
    assert preflight["promotionPerformed"] is False


def test_preflight_no_wave3_decisions_generated_yet(live_index):
    wave_ids = {record["candidateId"] for record in select_wave_candidates(live_index)}
    decisions = load_decisions().get("decisions") or {}
    assert [candidate_id for candidate_id in wave_ids if candidate_id in decisions] == []


def test_preflight_fail_closed_wrong_review_class(live_index):
    mutated = deepcopy(live_index)
    for record in mutated["candidateRecords"]:
        if record.get("reviewClass") == REVIEW_CLASS:
            record["reviewClass"] = "unresolved"
            break
    else:
        mutated["countsByReviewClass"][REVIEW_CLASS] = 1
        mutated["candidateRecords"].append(
            {
                "candidateId": "TEST::overlay::wave3-fake",
                "manualId": "TEST",
                "reviewClass": REVIEW_CLASS,
                "what": {"procedureId": "p", "sourceTerm": "x"},
                "mapsTo": {},
                "context": {},
            },
        )
    preflight = run_wave3_preflight(index=mutated)
    assert preflight["passed"] is False


def test_wave3_candidate_ids_do_not_overlap_wave1_or_wave2(live_index):
    wave1_ids = {record["candidateId"] for record in select_wave1(live_index)}
    wave2_ids = {record["candidateId"] for record in select_wave2(live_index)}
    wave3_ids = {record["candidateId"] for record in select_wave_candidates(live_index)}
    assert wave3_ids.isdisjoint(wave1_ids)
    assert wave3_ids.isdisjoint(wave2_ids)


def test_frozen_hash_validation():
    registry = json.loads((CALIBRATION_DIR / "frozen_canonical_hashes_v1.json").read_text(encoding="utf-8"))
    for ontology_id, entry in registry["frozenOntologies"].items():
        path = Path(__file__).resolve().parents[3] / entry["file"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry["hash"], ontology_id


def test_wave3_definition_file_exists():
    path = REVIEW_DIR / "waves" / "CG_WAVE3_NEW_CANONICAL_KNOWLEDGE_REVIEW_v1.json"
    assert path.is_file()
