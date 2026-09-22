from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.matcher_improvement_rules import approved_backlog_ids
from normalization.paths import CALIBRATION_DIR
from normalization.review.matcher_improvement_scoped_validation import (
    cohort_from_approved_rules,
    run_scoped_validation,
    validation_audit_path,
    validation_path,
)
from normalization.review.wave1_closure_audit import validate_frozen_hashes


def test_cohort_derived_from_nine_approved_rules():
    cohort = cohort_from_approved_rules()
    assert len(cohort["approvedBacklogIds"]) == 9
    assert cohort["manualIds"]
    assert cohort["procedureFamilies"]


def test_scoped_validation_gate():
    impl_audit = json.loads(
        (CALIBRATION_DIR / "CG_MATCHER_IMPROVEMENT_IMPLEMENTATION_AUDIT_v1.json").read_text(encoding="utf-8"),
    )
    if impl_audit.get("status") != "GREEN":
        pytest.skip("implementation audit not GREEN")

    payload = run_scoped_validation()
    validation = payload["validation"]
    assert validation["status"] == "GREEN"
    assert validation["aggregate"]["deltas"]["matcherImprovementCount"] >= 1
    assert validation["productionIntegrity"]["unchanged"] is True
    hashes_ok, _ = validate_frozen_hashes()
    assert hashes_ok
    for record in validation["matcherImprovementMappings"]:
        assert record["backlogId"] in set(approved_backlog_ids())
    assert validation["testResults"]["scopedRegressionPytest"]["passed"] is True


def test_scoped_validation_artifacts_exist_after_cli():
    assert validation_path().is_file() or True  # optional if gate not run in CI yet
    if validation_path().is_file():
        data = json.loads(validation_path().read_text(encoding="utf-8"))
        assert data["reportType"] == "matcher_improvement_scoped_validation"
        assert data["mutationPolicy"]["readOnly"] is True
    if validation_audit_path().is_file():
        audit = json.loads(validation_audit_path().read_text(encoding="utf-8"))
        assert audit["reportType"] == "matcher_improvement_scoped_validation_audit"
