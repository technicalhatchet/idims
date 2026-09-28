from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.canonical_matcher import build_mapping_candidates
from normalization.pipeline import find_manual_entry, load_manifest
from normalization.seed_component_registry import resolve_seed_component_id


def test_heater_seed_mapping_washer_scope():
    match = resolve_seed_component_id("heater", "washer", "whirlpool_duet_sport")
    assert match is not None
    assert match["canonicalId"] == "wash_heater"
    assert match["reviewLevel"] == "normal"
    assert match["confidence"] >= 0.95


def test_heater_seed_not_applied_to_dishwasher():
    match = resolve_seed_component_id("heater", "dishwasher", "whirlpool_dishwasher_acu")
    assert match is None


def test_door_switch_careful_review():
    match = resolve_seed_component_id("door_switch", "washer")
    assert match is not None
    assert match["canonicalId"] == "door_lock"
    assert match["reviewLevel"] == "careful"
    assert match["confidence"] < 0.9


def test_seed_candidate_preserves_source_term():
    entry = find_manual_entry(load_manifest(), "W8178558")
    fake = {
        "procedureId": "test-heater-proc",
        "title": "Heater test",
        "componentIds": ["heater"],
        "steps": [],
        "source": {"pages": []},
    }
    candidates, _ = build_mapping_candidates([fake], entry, "washer")
    heater = next(c for c in candidates if c.get("seedComponentId") == "heater")
    assert heater["sourceTerm"] == "heater"
    assert heater["canonicalId"] == "wash_heater"
    assert heater["mappingType"] == "seed_component_id"
    assert heater["reviewLevel"] == "normal"
