from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.wave2_pattern_synthesis import (
    classify_wave2_source_pattern,
    run_wave2_pattern_synthesis,
    synthesis_artifact_path,
    write_pattern_synthesis,
)


def test_classify_wave2_source_patterns():
    assert classify_wave2_source_pattern("overlay-foo-meas-bar") == "generated_overlay_identifier"
    assert classify_wave2_source_pattern("E8 — Diverter valve") == "error_code_prefixed_label"
    assert classify_wave2_source_pattern("TEST #5: Moisture") == "structural_title_noise"


def test_synthesis_schema_and_binding_counts():
    payload = run_wave2_pattern_synthesis()
    assert payload["reportType"] == "cg_wave2_pattern_synthesis"
    assert payload["wave2Reference"]["reviewedCandidateCount"] == 426
    assert payload["summary"]["measurementBindingCount"] == 182
    assert payload["summary"]["procedureTestBindingCount"] == 244
    assert payload["summary"]["generatedOverlayIdentifierCount"] == 182
    assert payload["mutationPolicy"]["automaticFilteringRulesApplied"] is False
    assert payload["mutationPolicy"]["normalizationPipelineMutated"] is False


def test_write_synthesis_artifact():
    payload = run_wave2_pattern_synthesis()
    path = write_pattern_synthesis(payload)
    assert path == synthesis_artifact_path()
    loaded = json.loads(path.read_text(encoding="utf-8"))
    assert loaded["findings"]
    assert any(item["pattern"] == "measurementBinding" for item in loaded["findings"])
