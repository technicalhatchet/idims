from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.wave1_closure_audit import classify_source_term_pattern
from normalization.review.wave1_pattern_synthesis import (
    run_wave1_pattern_synthesis,
    synthesis_artifact_path,
    write_pattern_synthesis,
)


def test_classify_patterns():
    assert classify_source_term_pattern("TEST #5: Moisture Sensor") == "oem_test_heading"
    assert classify_source_term_pattern("DP2") == "connector_identifier"


def test_synthesis_schema_and_wave1_pattern_counts():
    payload = run_wave1_pattern_synthesis()
    assert payload["reportType"] == "cg_wave1_pattern_synthesis"
    assert payload["wave1Reference"]["reviewedCount"] == 370
    assert payload["oemTestHeadingAnalysis"]["wave1Count"] == 33
    assert payload["manualSectionHeadingAnalysis"]["wave1Count"] == 6
    assert payload["manualSectionHeadingAnalysis"]["wave1ReviewStatusCounts"]["deferred"] == 4
    assert list(payload["connectorIdentifierAnalysis"]["wave1Identifiers"]) == ["DP2", "MS2", "PR6"]
    assert payload["supplyTerminologyAnalysis"]["wave1"]["count"] == 36
    assert payload["supplyTerminologyAnalysis"]["wave1"]["mappingCounts"]["power_supply"] == 30
    assert payload["supplyTerminologyAnalysis"]["wave1"]["mappingCounts"]["supply"] == 6
    assert payload["recommendedNextAction"]["productionMutationAuthorized"] is False
    assert payload["mutationPolicy"]["normalizationPipelineMutated"] is False


def test_synthesis_oem_occurs_outside_wave1():
    payload = run_wave1_pattern_synthesis()
    oem = payload["oemTestHeadingAnalysis"]
    assert oem["corpusOccursOutsideWave1"] is True
    assert oem["corpusCount"] > oem["wave1Count"]


def test_write_synthesis_artifact():
    payload = run_wave1_pattern_synthesis()
    path = write_pattern_synthesis(payload)
    assert path == synthesis_artifact_path()
    loaded = json.loads(path.read_text(encoding="utf-8"))
    assert loaded["crossCorpusRecurrence"]["sourceTermSupplyCount"] >= 36
