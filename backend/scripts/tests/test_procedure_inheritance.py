from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.lifecycle import NormalizationLifecycleError
from normalization.normalize_procedure import load_procedure_seeds_for_manual
from normalization.paths import PROCEDURE_SEED_DIR
from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization


def test_rs22t_inheritance_loads_rs28_procedures():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-RS22T-SXS")
    procedures = load_procedure_seeds_for_manual(
        entry,
        PROCEDURE_SEED_DIR / entry["seedDir"],
    )
    assert len(procedures) > 0
    inherited = [p for p in procedures if p["source"].get("inheritedFromManualId")]
    assert len(inherited) == len(procedures)
    assert all(
        p["source"]["inheritedFromManualId"] == "SAMSUNG-RS28-SXS"
        for p in inherited
    )
    assert all(p["source"]["manualId"] == "SAMSUNG-RS22T-SXS" for p in procedures)
    assert not any(
        p["source"].get("seedSourceManualId") == "SAMSUNG-RF260B-FRIDGE"
        for p in procedures
    )


def test_rtm18_inheritance_loads_documented_midea_rss_subset():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "INSIGNIA-RTM18-FRIDGE")
    expected_ids = {
        "midearss-rc-temp-sensor",
        "midearss-fz-temp-sensor",
        "midearss-fz-defrost-sensor",
        "midearss-communication",
        "midearss-ambient-sensor",
    }
    procedures = load_procedure_seeds_for_manual(
        entry,
        PROCEDURE_SEED_DIR / entry["seedDir"],
    )
    loaded_ids = {p["procedureId"] for p in procedures}
    assert loaded_ids == expected_ids
    assert all(
        p["source"]["inheritedFromManualId"] == "MIDEA-RSS-FRIDGE"
        for p in procedures
    )


def test_manual_without_inheritance_does_not_load_sibling_seeds():
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-RS22T-SXS")
    entry_without_inheritance = {**entry}
    entry_without_inheritance.pop("procedureInheritance", None)
    procedures = load_procedure_seeds_for_manual(
        entry_without_inheritance,
        PROCEDURE_SEED_DIR / entry["seedDir"],
    )
    assert procedures == []


def test_inheritance_declared_zero_procedures_fails_closed(tmp_path, monkeypatch):
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-RS22T-SXS")
    broken_entry = {
        **entry,
        "procedureInheritance": {
            "mode": "explicit_sibling_reuse",
            "sourceManualIds": ["NONEXISTENT-MANUAL"],
        },
    }
    monkeypatch.setattr("normalization.pipeline.CANDIDATES_DIR", tmp_path)
    with pytest.raises(NormalizationLifecycleError) as exc_info:
        run_manual_normalization(broken_entry)
    assert exc_info.value.code == "zero_procedure_inheritance"


def test_existing_candidates_not_silently_wiped_by_zero_output(tmp_path, monkeypatch):
    manifest = load_manifest()
    entry = find_manual_entry(manifest, "SAMSUNG-RS22T-SXS")
    manual_dir = tmp_path / "SAMSUNG-RS22T-SXS"
    manual_dir.mkdir(parents=True)
    (manual_dir / "canonical_mapping_candidates.json").write_text(
        json.dumps(
            {
                "manualId": "SAMSUNG-RS22T-SXS",
                "candidates": [{"id": "map-existing", "sourceTerm": "MCU"}],
            }
        ),
        encoding="utf-8",
    )
    broken_entry = {
        **entry,
        "procedureInheritance": {
            "mode": "explicit_sibling_reuse",
            "sourceManualIds": ["NONEXISTENT-MANUAL"],
        },
    }
    monkeypatch.setattr("normalization.pipeline.CANDIDATES_DIR", tmp_path)
    with pytest.raises(NormalizationLifecycleError) as exc_info:
        run_manual_normalization(broken_entry)
    assert exc_info.value.code == "zero_procedure_inheritance"
    payload = json.loads(
        (manual_dir / "canonical_mapping_candidates.json").read_text(encoding="utf-8")
    )
    assert len(payload["candidates"]) == 1
