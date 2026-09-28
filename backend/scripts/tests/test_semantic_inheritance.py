from __future__ import annotations

import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.canonical_matcher import build_mapping_candidates
from normalization.pipeline import find_manual_entry, load_manifest
from normalization.semantic_inheritance import (
    build_semantic_match_context,
    try_semantic_abstention,
    try_semantic_inheritance,
)
from run_semantic_inheritance_benchmark import (
    build_semantic_inheritance_benchmark,
    regression_scan_calibration_corpus,
)
from normalization.paths import CALIBRATION_DIR, PROCEDURE_SEED_DIR
from normalization.normalize_procedure import load_procedure_seeds_for_manual

WF6000R_PRIOR = ["W8178558", "W11169652", "SAMSUNG-FL-BB8700-WASHER"]
R2_RULE_ID = "samsung-fl-pba-communication-control-board"
R3_RULE_ID = "samsung-fl-drain-leakage-drain-pump"
R4_RULE_ID = "samsung-fl-overflow-oc-water-level-sensor"


def _wf6000r_context():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-FL-WF6000R-WASHER")
    return build_semantic_match_context(entry, WF6000R_PRIOR)


# --- R1 (validated) ---


def test_inverter_board_semantic_rule_matches_wf6000r_term():
    context = _wf6000r_context()
    match = try_semantic_inheritance("§4-1: Power / voltage (9C1, 9C2)", context)
    assert match is not None
    assert match.canonical_id == "inverter_board"
    assert match.classification == "inherited_platform_family"
    assert match.prior_manual_id == "SAMSUNG-FL-BB8700-WASHER"


def test_inverter_board_rule_does_not_cross_manufacturer():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "W8178558")
    context = build_semantic_match_context(entry, [])
    match = try_semantic_inheritance("§4-1: Power / voltage (9C1, 9C2)", context)
    assert match is None


def test_inverter_board_rule_does_not_match_without_platform_prior():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-FL-WF6000R-WASHER")
    context = build_semantic_match_context(entry, ["W8178558", "W11169652"])
    match = try_semantic_inheritance("§4-1: Power / voltage (9C1, 9C2)", context)
    assert match is None


def test_build_mapping_candidates_resolves_inverter_board_with_semantic_rules():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-FL-WF6000R-WASHER")
    procedures = load_procedure_seeds_for_manual(
        entry,
        PROCEDURE_SEED_DIR / str(entry.get("seedDir")),
    )
    without, _ = build_mapping_candidates(
        procedures,
        entry,
        "washer",
        enable_semantic_inheritance=False,
    )
    with_rules, _ = build_mapping_candidates(
        procedures,
        entry,
        "washer",
        enable_semantic_inheritance=True,
    )

    unresolved_before = [
        c for c in without
        if c.get("sourceTerm") == "§4-1: Power / voltage (9C1, 9C2)"
        and not c.get("canonicalId")
    ]
    resolved_after = [
        c for c in with_rules
        if c.get("sourceTerm") == "§4-1: Power / voltage (9C1, 9C2)"
        and c.get("canonicalId") == "inverter_board"
    ]
    assert unresolved_before
    assert resolved_after
    assert resolved_after[0]["semanticInheritance"]["ruleId"] == "samsung-fl-inverter-board-power-voltage-codes"


def test_partial_inverter_code_abstains_without_full_match():
    context = _wf6000r_context()
    assert try_semantic_inheritance("§4-1: Power (9C1)", context) is None
    abstention = try_semantic_abstention("§4-1: Power (9C1)", context)
    assert abstention is not None
    assert abstention.rule_id == "samsung-fl-inverter-board-power-voltage-codes"
    assert abstention.signal_type == "diagnostic_codes_partial"


# --- R2 compound phrase (nasty regression matrix) ---


@pytest.mark.parametrize(
    ("term", "expected_canonical"),
    [
        ("§4-3: PBA communication (AC, AC3–AC6)", "control_board"),
        ("PBA communication", "control_board"),
        ("PBA communication error", "control_board"),
    ],
)
def test_r2_compound_phrase_matches(term, expected_canonical):
    context = _wf6000r_context()
    match = try_semantic_inheritance(term, context)
    assert match is not None
    assert match.rule_id == R2_RULE_ID
    assert match.canonical_id == expected_canonical
    assert match.classification == "inherited_corpus_knowledge"
    assert try_semantic_abstention(term, context) is None


@pytest.mark.parametrize(
    "term",
    [
        "PBA",
        "§4-1: Main PBA",
        "communication",
        "motor communication",
        "§4-1: MEMS PBA (8C, 8C1, 8C2)",
    ],
)
def test_r2_partial_or_excluded_terms_do_not_match(term):
    context = _wf6000r_context()
    assert try_semantic_inheritance(term, context) is None


@pytest.mark.parametrize(
    ("term", "expected_signal"),
    [
        ("PBA", "pba"),
        ("§4-1: MEMS PBA (8C, 8C1, 8C2)", "pba"),
        ("communication", "communication"),
        ("motor communication", "communication"),
    ],
)
def test_r2_abstains_on_partial_compound_evidence(term, expected_signal):
    context = _wf6000r_context()
    abstention = try_semantic_abstention(term, context)
    assert abstention is not None
    assert abstention.rule_id == R2_RULE_ID
    assert abstention.signal_type == "token_cluster"
    assert expected_signal in abstention.reason.lower()


def test_r2_does_not_cross_manufacturer():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "W8178558")
    context = build_semantic_match_context(entry, ["W11169652"])
    assert try_semantic_inheritance("PBA communication", context) is None
    assert try_semantic_abstention("PBA communication", context) is None


def test_r2_mems_pba_does_not_resolve_to_mems_sensor():
    context = _wf6000r_context()
    term = "§4-1: MEMS PBA (8C, 8C1, 8C2)"
    match = try_semantic_inheritance(term, context)
    assert match is None
    abstention = try_semantic_abstention(term, context)
    assert abstention is not None
    assert abstention.rule_id == R2_RULE_ID


def test_build_mapping_candidates_resolves_pba_communication_with_semantic_rules():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-FL-WF6000R-WASHER")
    procedures = load_procedure_seeds_for_manual(
        entry,
        PROCEDURE_SEED_DIR / str(entry.get("seedDir")),
    )
    without, _ = build_mapping_candidates(
        procedures,
        entry,
        "washer",
        enable_semantic_inheritance=False,
    )
    with_rules, _ = build_mapping_candidates(
        procedures,
        entry,
        "washer",
        enable_semantic_inheritance=True,
    )

    term = "§4-3: PBA communication (AC, AC3–AC6)"
    unresolved_before = [
        c for c in without
        if c.get("sourceTerm") == term and not c.get("canonicalId")
    ]
    resolved_after = [
        c for c in with_rules
        if c.get("sourceTerm") == term and c.get("canonicalId") == "control_board"
    ]
    assert unresolved_before
    assert resolved_after
    assert resolved_after[0]["semanticInheritance"]["ruleId"] == R2_RULE_ID


# --- R3 OEM diagnostic-title variation (aggressive leakage abstention) ---


@pytest.mark.parametrize(
    ("term", "expected_canonical"),
    [
        ("§4-3: Drain / leakage (LC, LC1)", "drain_pump"),
        ("§4-3: Drain / leakage (LC, 5C)", "drain_pump"),
        ("Drain / leakage", "drain_pump"),
    ],
)
def test_r3_drain_leakage_matches(term, expected_canonical):
    context = _wf6000r_context()
    match = try_semantic_inheritance(term, context)
    assert match is not None
    assert match.rule_id == R3_RULE_ID
    assert match.canonical_id == expected_canonical
    assert match.classification == "inherited_corpus_knowledge"
    assert try_semantic_abstention(term, context) is None


@pytest.mark.parametrize(
    "term",
    [
        "leakage",
        "water leakage",
        "§4-3: Water leakage (LC, LC1)",
        "inlet leakage",
        "door leakage",
        "drain pump",
    ],
)
def test_r3_leakage_and_partial_terms_do_not_match(term):
    context = _wf6000r_context()
    assert try_semantic_inheritance(term, context) is None


@pytest.mark.parametrize(
    "term",
    [
        "leakage",
        "water leakage",
        "inlet leakage",
        "door leakage",
    ],
)
def test_r3_abstains_on_leakage_without_drain_compound(term):
    context = _wf6000r_context()
    abstention = try_semantic_abstention(term, context)
    assert abstention is not None
    assert abstention.rule_id == R3_RULE_ID
    assert "leakage" in abstention.reason.lower()


def test_r3_does_not_cross_manufacturer():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "W8178558")
    context = build_semantic_match_context(entry, ["W11169652"])
    term = "§4-3: Drain / leakage (LC, LC1)"
    assert try_semantic_inheritance(term, context) is None
    assert try_semantic_abstention(term, context) is None


def test_build_mapping_candidates_resolves_drain_leakage_with_semantic_rules():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-FL-WF6000R-WASHER")
    procedures = load_procedure_seeds_for_manual(
        entry,
        PROCEDURE_SEED_DIR / str(entry.get("seedDir")),
    )
    without, _ = build_mapping_candidates(
        procedures,
        entry,
        "washer",
        enable_semantic_inheritance=False,
    )
    with_rules, _ = build_mapping_candidates(
        procedures,
        entry,
        "washer",
        enable_semantic_inheritance=True,
    )

    term = "§4-3: Drain / leakage (LC, 5C)"
    unresolved_before = [
        c for c in without
        if c.get("sourceTerm") == term and not c.get("canonicalId")
    ]
    resolved_after = [
        c for c in with_rules
        if c.get("sourceTerm") == term and c.get("canonicalId") == "drain_pump"
    ]
    assert unresolved_before
    assert resolved_after
    assert resolved_after[0]["semanticInheritance"]["ruleId"] == R3_RULE_ID


# --- R4 constrained functional inference (hostile FP regression) ---


@pytest.mark.parametrize(
    ("term", "expected_canonical"),
    [
        ("§4-3: Overflow (OC)", "water_level_sensor"),
        ("Overflow (OC)", "water_level_sensor"),
        ("Samsung FL Overflow (OC)", "water_level_sensor"),
    ],
)
def test_r4_overflow_oc_matches(term, expected_canonical):
    context = _wf6000r_context()
    match = try_semantic_inheritance(term, context)
    assert match is not None
    assert match.rule_id == R4_RULE_ID
    assert match.canonical_id == expected_canonical
    assert match.classification == "inherited_platform_family"
    assert try_semantic_abstention(term, context) is None


@pytest.mark.parametrize(
    "term",
    [
        "water level",
        "§4-3: Water level sensor (1C)",
        "water leakage",
        "drain overflow",
        "inlet overflow",
        "basket overflow",
        "overflow",
        "OC",
        "§4-3: Washing motor (3C)",
    ],
)
def test_r4_hostile_terms_do_not_match(term):
    context = _wf6000r_context()
    assert try_semantic_inheritance(term, context) is None


@pytest.mark.parametrize(
    ("term", "expected_rule_id"),
    [
        ("water level", R4_RULE_ID),
        ("overflow", R4_RULE_ID),
        ("OC", R4_RULE_ID),
    ],
)
def test_r4_abstains_on_partial_or_ambiguous_evidence(term, expected_rule_id):
    context = _wf6000r_context()
    abstention = try_semantic_abstention(term, context)
    assert abstention is not None
    assert abstention.rule_id == expected_rule_id


def test_r4_drain_overflow_abstains_without_matching():
    context = _wf6000r_context()
    assert try_semantic_inheritance("drain overflow", context) is None
    assert try_semantic_abstention("drain overflow", context) is not None


def test_r4_does_not_cross_manufacturer_or_generic_overflow():
    manifest = load_manifest()
    whirlpool = find_manual_entry(manifest, "W8178558")
    context = build_semantic_match_context(whirlpool, ["W11169652"])
    term = "§4-3: Overflow (OC)"
    assert try_semantic_inheritance(term, context) is None
    assert try_semantic_abstention(term, context) is None


def test_r4_requires_prior_platform_water_level_sensor_knowledge():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-FL-WF6000R-WASHER")
    context = build_semantic_match_context(entry, ["W8178558", "W11169652"])
    assert try_semantic_inheritance("§4-3: Overflow (OC)", context) is None


def test_r4_does_not_create_water_level_sensor_concept():
    context = _wf6000r_context()
    match = try_semantic_inheritance("§4-3: Overflow (OC)", context)
    assert match is not None
    assert match.canonical_id == "water_level_sensor"


def test_build_mapping_candidates_resolves_overflow_with_semantic_rules():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-FL-WF6000R-WASHER")
    procedures = load_procedure_seeds_for_manual(
        entry,
        PROCEDURE_SEED_DIR / str(entry.get("seedDir")),
    )
    without, _ = build_mapping_candidates(
        procedures,
        entry,
        "washer",
        enable_semantic_inheritance=False,
    )
    with_rules, _ = build_mapping_candidates(
        procedures,
        entry,
        "washer",
        enable_semantic_inheritance=True,
    )

    term = "§4-3: Overflow (OC)"
    unresolved_before = [
        c for c in without
        if c.get("sourceTerm") == term and not c.get("canonicalId")
    ]
    resolved_after = [
        c for c in with_rules
        if c.get("sourceTerm") == term and c.get("canonicalId") == "water_level_sensor"
    ]
    assert unresolved_before
    assert resolved_after
    assert resolved_after[0]["semanticInheritance"]["ruleId"] == R4_RULE_ID


# --- Corpus regression + benchmark ---


def test_calibration_corpus_regression_expected_semantic_matches():
    regression = regression_scan_calibration_corpus(CALIBRATION_DIR)
    assert regression["matchCount"] == regression["expectedMatchCount"] == 4
    assert regression["falsePositiveCheck"] == "PASS"
    canonical_ids = {match["canonicalId"] for match in regression["matches"]}
    assert canonical_ids == {
        "inverter_board",
        "control_board",
        "drain_pump",
        "water_level_sensor",
    }
    assert all(match["manualId"] == "SAMSUNG-FL-WF6000R-WASHER" for match in regression["matches"])


def test_semantic_benchmark_projects_reduced_mapping_burden():
    report = build_semantic_inheritance_benchmark(CALIBRATION_DIR)
    before_mapping = report["comparison"]["mappingSimulation"]["beforeMappingHumanGateDecisions"]
    after_mapping = report["comparison"]["mappingSimulation"]["afterMappingHumanGateDecisions"]
    assert after_mapping == before_mapping - 4
    assert report["comparison"]["mappingSimulation"]["semanticInheritanceAutoResolved"] == 4
    assert report["comparison"]["table"]["rows"]["newCanonical"] == [0, 0]
    assert report["comparison"]["table"]["rows"]["leakage"] == [0, 0]
    assert "abstentions" in report["comparison"]["table"]["rows"]


def test_semantic_benchmark_r4_incremental_accounting_vs_frozen_r3_baseline():
    report = build_semantic_inheritance_benchmark(CALIBRATION_DIR)
    incremental = report["incrementalAccounting"]
    assert incremental is not None
    r3 = incremental["r3ValidatedBaseline"]
    assert r3["mappingGateBurden"] == 68
    assert r3["projectedCohortHumanGateDecisions"] == 45
    assert r3["semanticInheritsAutoResolved"] == 3
    delta = incremental["currentRuleDelta"]
    assert delta["mappingGateBurdenDelta"] == 1
    assert delta["projectedCohortDelta"] == 1
    assert delta["semanticInheritsAutoResolvedDelta"] == 1
    assert delta["regressionAbstentionsDelta"] == 1
    assert delta["falsePositives"] == 0


def test_calibration_corpus_regression_abstentions_non_negative():
    regression = regression_scan_calibration_corpus(CALIBRATION_DIR)
    assert regression["abstentionCount"] >= 0
