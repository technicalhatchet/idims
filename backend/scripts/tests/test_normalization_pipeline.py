from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.canonical_matcher import build_mapping_candidates, load_canonical_component_ids
from normalization.conflict_detector import detect_alias_conflicts, topology_signature
from normalization.normalize_procedure import load_procedure_seeds_for_manual
from normalization.overlay_candidate_builder import build_overlay_candidates
from normalization.paths import CANONICAL_WASHER_PATH, CANDIDATES_DIR
from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization


@pytest.fixture
def w8178558_entry():
    manifest = load_manifest()
    return find_manual_entry(manifest, "W8178558")


def test_vented_dryer_canonical_ids_load():
    ids = load_canonical_component_ids("electric_dryer")
    assert "heat_source" in ids
    assert "lint_filter" in ids
    assert "wash_heater" not in ids


def test_w8178559_heating_element_maps_to_heat_source_not_wash_heater():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "W8178559")
    from normalization.canonical_matcher import match_source_term

    result = match_source_term("heating_element", "electric_dryer")
    assert result["canonicalId"] == "heat_source"
    assert result["canonicalId"] != "wash_heater"


def test_w8178558_normalizes_procedures(w8178558_entry):
    from normalization.paths import PROCEDURE_SEED_DIR

    seed_dir = PROCEDURE_SEED_DIR / w8178558_entry["seedDir"]
    procedures = load_procedure_seeds_for_manual(w8178558_entry, seed_dir)
    assert len(procedures) >= 5
    motor = next(p for p in procedures if p["procedureId"] == "w8178558-motor-circuit")
    assert motor["source"]["manualId"] == "W8178558"
    assert motor["provenance"]["manualId"] == "W8178558"
    assert any(step["type"] == "measurement" for step in motor["steps"])


def test_w8178558_mapping_candidates_include_mcu(w8178558_entry):
    from normalization.paths import PROCEDURE_SEED_DIR

    procedures = load_procedure_seeds_for_manual(
        w8178558_entry,
        PROCEDURE_SEED_DIR / w8178558_entry["seedDir"],
    )
    mappings, _filters = build_mapping_candidates(procedures, w8178558_entry, "washer")
    mcu_maps = [
        m for m in mappings
        if str(m.get("sourceTerm")).upper() == "MCU"
        and m.get("canonicalId") == "motor_controller"
    ]
    assert mcu_maps, "expected MCU → motor_controller mapping candidate"
    assert mcu_maps[0]["confidence"] >= 0.9
    assert mcu_maps[0]["provenance"]["manualId"] == "W8178558"


def test_w8178558_overlay_candidates_bind_motor_test(w8178558_entry):
    from normalization.paths import PROCEDURE_SEED_DIR

    procedures = load_procedure_seeds_for_manual(
        w8178558_entry,
        PROCEDURE_SEED_DIR / w8178558_entry["seedDir"],
    )
    overlays = build_overlay_candidates(procedures, w8178558_entry, "washer")
    motor_binding = next(
        o for o in overlays
        if o.get("procedureId") == "w8178558-motor-circuit"
        and o.get("candidateType") == "procedureTestBinding"
    )
    assert motor_binding["canonicalTestTarget"] == "motor_output_test"
    assert motor_binding["confidence"] >= 0.9

    measurement_bindings = [
        o for o in overlays
        if o.get("procedureId") == "w8178558-motor-circuit"
        and o.get("candidateType") == "measurementBinding"
    ]
    assert any(
        m.get("measurementKnowledgeId") == "whirlpoolDuetSportWasherMotorOhms"
        for m in measurement_bindings
    )


def test_topology_signature_duet_sport_vs_fl_dd(w8178558_entry):
    from normalization.paths import PROCEDURE_SEED_DIR

    manifest = load_manifest()
    fl_dd = find_manual_entry(manifest, "W11169652")
    duet_procedures = load_procedure_seeds_for_manual(
        w8178558_entry,
        PROCEDURE_SEED_DIR / w8178558_entry["seedDir"],
    )
    fl_dd_procedures = load_procedure_seeds_for_manual(
        fl_dd,
        PROCEDURE_SEED_DIR / fl_dd["seedDir"],
    )
    assert topology_signature(w8178558_entry, duet_procedures) == "ccu_mcu_motor"
    assert topology_signature(fl_dd, fl_dd_procedures) == "direct_drive_motor"


def test_alias_conflict_detection():
    conflicts = detect_alias_conflicts(
        [
            {
                "sourceTerm": "MCU",
                "canonicalId": "motor_controller",
                "status": "candidate",
                "provenance": {"manualId": "A"},
            },
            {
                "sourceTerm": "MCU",
                "canonicalId": "control_board",
                "status": "candidate",
                "provenance": {"manualId": "B"},
            },
        ],
    )
    assert conflicts
    assert conflicts[0]["status"] == "CONFLICT_REQUIRES_REVIEW"
    assert conflicts[0]["conflictType"] == "ALIAS_CONFLICT"


def test_run_manual_writes_candidate_files(w8178558_entry, tmp_path, monkeypatch):
    monkeypatch.setattr(
        "normalization.pipeline.CANDIDATES_DIR",
        tmp_path,
    )
    result = run_manual_normalization(w8178558_entry)
    manual_dir = tmp_path / "W8178558"
    assert manual_dir.is_dir()
    assert (manual_dir / "normalized_procedures.json").is_file()
    assert (manual_dir / "canonical_mapping_candidates.json").is_file()
    assert (manual_dir / "overlay_candidates.json").is_file()
    assert (manual_dir / "pipeline_manifest.json").is_file()
    manifest = json.loads((manual_dir / "pipeline_manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "candidate"
    assert result["manifest"]["counts"]["procedures"] >= 5


def test_canonical_json_unchanged_by_pipeline(w8178558_entry, tmp_path, monkeypatch):
    before = CANONICAL_WASHER_PATH.read_text(encoding="utf-8")
    monkeypatch.setattr("normalization.pipeline.CANDIDATES_DIR", tmp_path)
    run_manual_normalization(w8178558_entry)
    after = CANONICAL_WASHER_PATH.read_text(encoding="utf-8")
    assert before == after
