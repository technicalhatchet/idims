from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from run_compounding_efficiency_report import (
    build_efficiency_report,
    extract_gate_preview_metrics,
    format_bar_chart,
)
from normalization.paths import CALIBRATION_DIR


def test_extract_gate_preview_from_fl_batch_baseline():
    baseline = json.loads((CALIBRATION_DIR / "compounding_baseline_v1_whirlpool_fl.json").read_text())
    gate = extract_gate_preview_metrics(baseline, "W8178558")
    assert gate["newHumanDecisionCount"] == 10
    assert gate["exactInheritanceAtGate"] == 20
    assert gate["newHumanDecisionRate"] == 0.2439


def test_extract_gate_preview_from_tl3_baseline():
    baseline = json.loads((CALIBRATION_DIR / "compounding_baseline_v1_whirlpool_tl3.json").read_text())
    gate = extract_gate_preview_metrics(baseline, "W11416787")
    assert gate["newHumanDecisionCount"] == 2
    assert gate["inheritedPlatformFamilyKnowledge"] == 19
    assert gate["newCanonicalKnowledge"] == 0


def test_build_efficiency_report_read_only_seven_manuals():
    report = build_efficiency_report(CALIBRATION_DIR)
    assert report["readOnly"] is True
    assert report["metricsSource"] == "gate_preview"
    assert len(report["manuals"]) == 7
    assert report["summary"]["inheritanceCurveHumanDecisions"] == [10, 9, 14, 0, 2, 6, 7]
    assert report["summary"]["newCanonicalKnowledgeAcrossCohort"] == 0
    assert report["leakage"]["samsung_to_whirlpool_platform"] == 0


def test_samsung_fl2_semantic_case_documented_not_inferred():
    report = build_efficiency_report(CALIBRATION_DIR)
    samsung2 = next(
        row for row in report["manuals"] if row["manualId"] == "SAMSUNG-FL-WF6000R-WASHER"
    )
    assert samsung2["humanGateDecisions"] == 7
    assert samsung2["semanticInheritance"]["humanBurdenCount"] == 1
    assert samsung2["semanticInheritance"]["documentedCases"][0]["concept"] == "inverter_board"
    assert samsung2["supplementalMatcherLayer"]["inheritedPlatformFamilyKnowledge"] == 16


def test_bar_chart_uses_frozen_decision_counts():
    report = build_efficiency_report(CALIBRATION_DIR)
    chart = format_bar_chart(report)
    assert "Whirlpool TL #2" in chart
    assert "0" in chart
    assert report["barChart"]["maxValue"] == 14
