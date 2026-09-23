from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.canonical_matcher import build_mapping_candidates, match_source_term
from normalization.pipeline import find_manual_entry, load_manifest
from normalization.term_preprocessor import (
    is_procedural_noise,
    is_structural_token,
    preprocess_title,
    strip_structural_and_procedural_markers,
)


def test_procedural_noise_test():
    assert is_procedural_noise("TEST")
    assert is_procedural_noise("ohms")


def test_structural_token_c2():
    assert is_structural_token("C2")
    assert is_structural_token("J14")


def test_strip_test_prefix_door_lock():
    cleaned, notes = strip_structural_and_procedural_markers("TEST #5 — Door Lock")
    assert cleaned == "Door Lock"
    assert notes


def test_strip_section_and_motor_test_suffix():
    cleaned, _ = strip_structural_and_procedural_markers("§5-4 MOTOR TEST")
    assert cleaned == "MOTOR"


def test_preprocess_title_dispenser_motor():
    result = preprocess_title("§5-4: Detergent Dispenser Motor")
    assert result.action == "match"
    assert result.match_term == "Detergent Dispenser Motor"


def test_match_title_prefix_door_lock():
    result = match_source_term("TEST #5 — Door Lock", "washer")
    assert result["canonicalId"] == "door_lock"
    assert result["extractedTerm"] == "Door Lock"


def test_title_test_token_filtered_not_candidate():
    fake_entry = {
        "manualId": "TEST-MANUAL",
        "platformId": "test_platform",
        "extractionDoc": None,
    }
    fake_procedure = {
        "procedureId": "fake-test-proc",
        "title": "TEST #5 — Door Lock",
        "componentIds": [],
        "steps": [],
        "source": {"pages": []},
    }
    candidates, filters = build_mapping_candidates([fake_procedure], fake_entry, "washer")
    test_candidates = [
        c for c in candidates if str(c.get("sourceTerm")).upper() == "TEST"
    ]
    assert not test_candidates
    assert filters["proceduralNoise"] >= 1
    door_lock = [c for c in candidates if c.get("canonicalId") == "door_lock"]
    assert door_lock
