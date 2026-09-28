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

from normalization.review.candidate_review_decisions import load_decisions
from normalization.review.wave1_closure_audit import (
    EXPECTED_ACCEPTED,
    EXPECTED_CANDIDATE_COUNT,
    EXPECTED_DEFERRED,
    EXPECTED_REJECTED,
    analyze_deferred_patterns,
    analyze_rejected_supply_mapping,
    classify_source_term_pattern,
    closure_audit_path,
    reconcile_wave_decisions,
    run_wave1_closure_audit,
)
from normalization.review.wave1_existing_canonical_mapping import (
    load_review_index,
    select_wave_candidates,
)
from normalization.review.frozen_canonical_vocabulary import load_frozen_canonical_ids


@pytest.fixture
def live_index():
    return load_review_index()


@pytest.fixture
def live_wave(live_index):
    return select_wave_candidates(live_index)


@pytest.fixture
def live_decisions():
    return load_decisions()


def test_wave1_closure_exact_counts(live_wave, live_decisions):
    reconciliation = reconcile_wave_decisions(live_wave, live_decisions)
    assert reconciliation["passed"] is True
    assert reconciliation["expectedCount"] == EXPECTED_CANDIDATE_COUNT
    assert reconciliation["reviewedCount"] == 370
    assert reconciliation["acceptedCount"] == EXPECTED_ACCEPTED
    assert reconciliation["deferredCount"] == EXPECTED_DEFERRED
    assert reconciliation["rejectedCount"] == EXPECTED_REJECTED


def test_wave1_closure_no_missing_or_duplicate_decisions(live_wave, live_decisions):
    reconciliation = reconcile_wave_decisions(live_wave, live_decisions)
    assert reconciliation["missingDecisionCount"] == 0
    assert reconciliation["outOfWaveDecisionCount"] == 0


def test_wave1_closure_fail_closed_missing_decision(live_wave, live_decisions):
    mutated = deepcopy(live_decisions)
    first_id = live_wave[0]["candidateId"]
    del mutated["decisions"][first_id]
    reconciliation = reconcile_wave_decisions(live_wave, mutated)
    assert reconciliation["passed"] is False
    assert reconciliation["missingDecisionCount"] == 1


def test_wave1_closure_fail_closed_out_of_wave_decision(live_wave, live_decisions):
    mutated = deepcopy(live_decisions)
    mutated["decisions"]["not-in-wave::canonical_mapping::x"] = {
        "candidateId": "not-in-wave::canonical_mapping::x",
        "reviewStatus": "accepted",
        "history": [{"reviewStatus": "accepted"}],
    }
    reconciliation = reconcile_wave_decisions(live_wave, mutated)
    assert reconciliation["passed"] is False
    assert reconciliation["outOfWaveDecisionCount"] == 1


def test_deferred_pattern_grouping(live_wave, live_decisions):
    analysis = analyze_deferred_patterns(live_wave, live_decisions)
    assert analysis["deferredCount"] == EXPECTED_DEFERRED
    assert analysis["patternGroupCount"] == 4
    pattern_ids = {group["patternId"] for group in analysis["groups"]}
    assert pattern_ids == {
        "oem_test_heading",
        "manual_section_heading",
        "connector_identifier",
        "literal_supply_term",
    }


def test_classify_source_term_patterns():
    assert classify_source_term_pattern("TEST #5: Moisture Sensor") == "oem_test_heading"
    assert classify_source_term_pattern("§3-9: Dispenser Solenoid") == "manual_section_heading"
    assert classify_source_term_pattern("DP2") == "connector_identifier"
    assert classify_source_term_pattern("supply") == "literal_supply_term"


def test_supply_mapping_analysis(live_wave, live_decisions):
    frozen_ids = load_frozen_canonical_ids()
    analysis = analyze_rejected_supply_mapping(live_wave, live_decisions, frozen_ids)
    supply = analysis["wave1SupplyOccurrences"]
    assert supply["totalWithSourceTermSupply"] == 36
    assert supply["supplyToSupplyCount"] == 6
    assert supply["supplyToPowerSupplyCount"] == 30
    assert analysis["canonicalVocabulary"]["supplyPresent"] is True
    assert analysis["canonicalVocabulary"]["power_supplyPresent"] is True
    rejected = analysis["rejectedCandidate"]
    assert rejected["manualId"] == "SAMSUNG-FLEXWASH-WASHER"
    assert (rejected.get("what") or {}).get("sourceTerm") == "supply"


def test_run_wave1_closure_audit_passes():
    audit = run_wave1_closure_audit()
    assert audit["status"] == "WAVE1_CLOSED"
    assert audit["errors"] == []
    assert audit["frozenHashValidation"]["passed"] is True
    assert audit["canonicalMutationCheck"]["passed"] is True
    assert audit["normalizationMutationCheck"]["passed"] is True
    assert audit["batchMutationCheck"]["passed"] is True
    assert audit["decisionIntegrity"]["promotionExcluded"] is True


def test_closure_audit_artifact_exists_after_run():
    run_wave1_closure_audit()
    path = closure_audit_path()
    assert path.is_file()
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["status"] == "WAVE1_CLOSED"
    assert payload["acceptedCount"] == 328


def test_frozen_hash_validation():
    from normalization.review.wave1_existing_canonical_mapping import validate_frozen_hashes

    ok, errors = validate_frozen_hashes()
    assert ok is True
    assert errors == []
