from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.promotion.equivalence import (
    apply_plan_to_overlay_copy,
    compare_promotion_equivalence,
)
from normalization.promotion.planner import MANUAL_TO_OVERLAY, find_platform_family, load_overlay_file


@pytest.fixture
def w8178558_target():
    return MANUAL_TO_OVERLAY["W8178558"]


def test_promotion_equivalence_identity(w8178558_target):
    overlay = load_overlay_file(w8178558_target["overlayFile"])
    family = find_platform_family(overlay, w8178558_target["platformFamilyId"])
    report = compare_promotion_equivalence(family, family, manual_id="W8178558")
    assert report["equivalent"] is True
    assert all(report["checks"].values())


def test_promotion_equivalence_empty_diff_is_identity(w8178558_target):
    overlay = load_overlay_file(w8178558_target["overlayFile"])
    family = find_platform_family(overlay, w8178558_target["platformFamilyId"])
    empty_plan = {
        "diff": {
            "oemTermAliases": {"add": {}, "skip": {}},
            "procedureBindings": {"add": [], "skip": []},
            "measurementBindings": {"add": [], "skip": []},
        },
    }
    generated_overlay = apply_plan_to_overlay_copy(
        w8178558_target["overlayFile"],
        w8178558_target["platformFamilyId"],
        empty_plan,
    )
    generated_family = find_platform_family(
        generated_overlay,
        w8178558_target["platformFamilyId"],
    )
    report = compare_promotion_equivalence(family, generated_family, manual_id="W8178558")
    assert report["equivalent"] is True


def test_promotion_equivalence_detects_alias_drift(w8178558_target):
    overlay = load_overlay_file(w8178558_target["overlayFile"])
    family = find_platform_family(overlay, w8178558_target["platformFamilyId"])
    drift_plan = {
        "diff": {
            "oemTermAliases": {
                "add": {"MCU": "control_board"},
                "skip": {},
            },
            "procedureBindings": {"add": [], "skip": []},
            "measurementBindings": {"add": [], "skip": []},
        },
    }
    generated_overlay = apply_plan_to_overlay_copy(
        w8178558_target["overlayFile"],
        w8178558_target["platformFamilyId"],
        drift_plan,
    )
    generated_family = find_platform_family(
        generated_overlay,
        w8178558_target["platformFamilyId"],
    )
    report = compare_promotion_equivalence(family, generated_family, manual_id="W8178558")
    assert report["equivalent"] is False
    assert report["checks"]["canonicalAliases"] is False


def test_compiler_loop_report_exists_after_run():
    report_path = (
        ROOT
        / "frontend"
        / "components"
        / "diagnostics"
        / "knowledge"
        / "normalization"
        / "calibration"
        / "compiler_loop_W8178558.json"
    )
    if not report_path.is_file():
        pytest.skip("Run python backend/scripts/run_compiler_loop.py first")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report.get("equivalence", {}).get("equivalent") is True
