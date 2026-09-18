from __future__ import annotations

import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.calibration.golden_runner import evaluate_golden_case, evaluate_golden_set
from normalization.canonical_matcher import match_source_term
from normalization.compound_term_parser import extract_functional_nouns, tokenize_oem_phrase, try_compound_match
from normalization.canonical_matcher import load_alias_registry, load_canonical_component_ids
from normalization.compound_term_parser import load_canonical_component_aliases
from normalization.paths import CANONICAL_WASHER_PATH


def test_tokenize_detergent_dispenser_motor():
    tokens = tokenize_oem_phrase("Detergent Dispenser Motor")
    assert tokens == ["detergent", "dispenser", "motor"]


def test_extract_functional_nouns_dispenser_motor():
    decomposition = extract_functional_nouns(["detergent", "dispenser", "motor"])
    assert decomposition["domain"] == "detergent"
    assert decomposition["component"] == "dispenser"
    assert decomposition["actuator"] == "motor"


def test_compound_match_detergent_dispenser_motor():
    registry = load_alias_registry()
    canonical_aliases = load_canonical_component_aliases("washer", CANONICAL_WASHER_PATH)
    match = try_compound_match("Detergent Dispenser Motor", registry, canonical_aliases)
    assert match is not None
    assert match.canonical_id == "dosing_pump"
    assert match.matched_phrase == "dispenser motor"
    assert match.confidence <= 0.88


def test_match_source_term_mcu():
    result = match_source_term("MCU", "washer")
    assert result["canonicalId"] == "motor_controller"
    assert result["status"] == "candidate"
    assert result["confidence"] >= 0.9


def test_match_source_term_compound_status():
    result = match_source_term("Detergent Dispenser Motor", "washer")
    assert result["canonicalId"] == "dosing_pump"
    assert result["status"] == "COMPOUND_TERM_CANDIDATE"
    assert result["mappingType"] == "compound_alias"


def test_match_source_term_unresolved_fragment():
    result = match_source_term("Front Load", "washer")
    assert result["canonicalId"] is None
    assert result["status"] == "UNRESOLVED_TERM"


def test_golden_set_passes():
    report = evaluate_golden_set()
    assert report["failed"] == 0, report.get("failures")
    assert report["passRate"] == 1.0


def test_golden_case_approve_aliases():
    case = {
        "id": "test-ccu",
        "sourceTerm": "CCU",
        "templateId": "washer",
        "expectedCanonicalId": "control_board",
        "expectedStatus": "candidate",
        "expectedMappingType": "alias",
        "minConfidence": 0.85,
    }
    result = evaluate_golden_case(case)
    assert result["passed"]
