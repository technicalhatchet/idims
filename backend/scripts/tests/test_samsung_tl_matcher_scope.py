from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.canonical_matcher import (
    build_mapping_candidates,
    load_canonical_component_ids,
    load_full_registry,
    match_source_term,
)
from normalization.normalize_procedure import load_procedure_seeds_for_manual
from normalization.overlay_candidate_builder import build_overlay_candidates
from normalization.paths import PROCEDURE_SEED_DIR
from normalization.pipeline import find_manual_entry, load_manifest


def _samsung_tl_entry():
    manifest = load_manifest()
    return find_manual_entry(manifest, "SAMSUNG-TL-A50-WASHER")


def _samsung_tl_procedures(entry):
    seed_dir = PROCEDURE_SEED_DIR / entry["seedDir"]
    return load_procedure_seeds_for_manual(entry, seed_dir)


def test_samsung_tl_loads_top_load_canonical_not_fl():
    entry = _samsung_tl_entry()
    platform_id = entry["platformId"]
    ids = load_canonical_component_ids("washer", platform_id)
    assert "lid_lock" in ids
    assert "power_supply" in ids
    assert "door_lock" not in ids
    assert "supply" not in ids


def test_samsung_tl_registry_excludes_fl_overlays():
    entry = _samsung_tl_entry()
    registry = load_full_registry("washer", entry["platformId"])
    layers = {source for _, _, source in registry.values()}
    assert not any("samsung_fl" in layer for layer in layers)
    assert not any("whirlpool_front_load" in layer for layer in layers)
    assert not any(layer.startswith("manufacturer_overlay:") for layer in layers)


def test_samsung_tl_door_lock_seed_maps_to_lid_lock():
    entry = _samsung_tl_entry()
    result = match_source_term("door_lock", "washer", platform_id=entry["platformId"])
    assert result["canonicalId"] == "lid_lock"
    assert result["confidence"] > 0


def test_samsung_tl_supply_seed_maps_to_power_supply():
    entry = _samsung_tl_entry()
    result = match_source_term("supply", "washer", platform_id=entry["platformId"])
    assert result["canonicalId"] == "power_supply"
    assert result["confidence"] > 0


def test_samsung_tl_door_lock_procedure_uses_lid_lock_test():
    entry = _samsung_tl_entry()
    procedures = _samsung_tl_procedures(entry)
    overlays = build_overlay_candidates(procedures, entry, "washer")
    door_binding = next(
        o
        for o in overlays
        if o.get("procedureId") == "samsungtla50-door-lock"
        and o.get("candidateType") == "procedureTestBinding"
    )
    assert door_binding["canonicalTestTarget"] == "lid_lock_test"
    assert "door_lock_test" not in door_binding["canonicalTestTarget"]


def test_samsung_tl_main_control_maps_without_samsung_fl_layer():
    entry = _samsung_tl_entry()
    procedures = _samsung_tl_procedures(entry)
    mappings, _ = build_mapping_candidates(procedures, entry, "washer")
    main_control = next(
        m
        for m in mappings
        if m.get("sourceTerm") == "main_control" and m.get("canonicalId") == "control_board"
    )
    layers = [
        source.get("layer")
        for source in (main_control.get("provenance") or {}).get("sources") or []
        if source.get("type") == "matcher"
    ]
    assert layers
    assert not any("samsung_fl" in str(layer) for layer in layers)


def test_w8178558_still_uses_front_load_washer_ontology():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "W8178558")
    ids = load_canonical_component_ids("washer", entry["platformId"])
    assert "door_lock" in ids
    assert "lid_lock" not in ids
