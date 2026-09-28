from __future__ import annotations

import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.canonical_matcher import build_mapping_candidates, load_canonical_component_ids, match_source_term
from normalization.matcher_improvement_rules import (
    MatcherImprovementContext,
    approved_backlog_ids,
    try_matcher_improvement,
)
from normalization.normalize_procedure import load_procedure_seeds_for_manual
from normalization.paths import PROCEDURE_SEED_DIR
from normalization.pipeline import find_manual_entry, load_manifest
from normalization.review.matcher_improvement_decisions import load_matcher_improvement_decisions
from normalization.review.matcher_improvement_implementation import decision_tallies, run_regression_cases
from normalization.review.matcher_improvement_review import run_matcher_improvement_preflight
from normalization.review.wave1_closure_audit import validate_frozen_hashes


def test_decision_store_has_seventeen_reviews():
    tallies = decision_tallies()
    assert sum(tallies.values()) == 17
    assert tallies.get("reject") == 1
    assert tallies.get("approve", 0) >= 8


def test_only_approved_backlog_ids_have_active_rules():
    approved = set(approved_backlog_ids())
    assert len(approved) >= 8
    deferred = {
        bid
        for bid, entry in (load_matcher_improvement_decisions().get("decisions") or {}).items()
        if entry.get("reviewStatus") == "defer"
    }
    for backlog_id in deferred:
        ctx = MatcherImprovementContext("SAMSUNG-TL-A50-WASHER", "samsungtla50-wash-probe", "washer", "samsung_tl_washer_a50")
        ids = load_canonical_component_ids("washer", "samsung_tl_washer_a50")
        match = try_matcher_improvement(
            "§5-3: Wash heater (HC, HC1)",
            "§5-3: Wash heater (HC, HC1)",
            context=ctx,
            canonical_ids=ids,
        )
        if match:
            assert match.backlog_id not in deferred


def test_user_interface_maps_to_hmi_control_for_approved_manual():
    ctx = MatcherImprovementContext(
        manual_id="W10680150",
        procedure_id="w10680150-button-indicator",
        template_id="electric_dryer",
        platform_id="whirlpool_ccu_dryer",
    )
    ids = load_canonical_component_ids("electric_dryer", "whirlpool_ccu_dryer")
    match = try_matcher_improvement("user_interface", "user_interface", context=ctx, canonical_ids=ids)
    assert match is not None
    assert match.backlog_id == "efmm-cda9def45dce"
    assert match.canonical_id == "hmi_control"


def test_rejected_wash_heater_cluster_does_not_map_to_temperature_sensor():
    ctx = MatcherImprovementContext(
        manual_id="SAMSUNG-TL-A50-WASHER",
        procedure_id="samsungtla50-wash-heater",
        template_id="washer",
        platform_id="samsung_tl_washer_a50",
    )
    ids = load_canonical_component_ids("washer", "samsung_tl_washer_a50")
    match = try_matcher_improvement(
        "§5-3: Wash heater (HC, HC1)",
        "§5-3: Wash heater (HC, HC1)",
        context=ctx,
        canonical_ids=ids,
    )
    assert match is None or match.backlog_id != "efmm-64d66fbb30c3"


def test_build_mapping_candidates_emits_matcher_improvement_for_user_interface():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "W8178559")
    procedures = load_procedure_seeds_for_manual(entry, PROCEDURE_SEED_DIR / str(entry["seedDir"]))
    candidates, _ = build_mapping_candidates(procedures, entry, str(entry["templateId"]))
    mig = [c for c in candidates if c.get("mappingType") == "matcher_improvement"]
    assert any(c.get("matcherImprovement", {}).get("backlogId") == "efmm-cda9def45dce" for c in mig)


def test_regression_case_suite_passes():
    result = run_regression_cases()
    assert result["failedCount"] == 0


def test_preflight_and_frozen_hashes_still_pass():
    preflight = run_matcher_improvement_preflight()
    assert preflight["passed"] is True
    ok, errors = validate_frozen_hashes()
    assert ok, errors
