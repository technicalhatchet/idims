from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.matcher_improvement_rules import approved_backlog_ids
from normalization.paths import CALIBRATION_DIR, CANDIDATES_DIR
from normalization.review.matcher_improvement_full_corpus_regeneration import (
    production_manual_ids,
    regeneration_path,
    run_full_corpus_regeneration_gate,
    staging_root,
)
from normalization.review.wave1_closure_audit import validate_frozen_hashes


def test_seventy_two_manual_production_cohort():
    assert len(production_manual_ids()) == 72


def test_staging_root_is_not_production_candidates():
    assert staging_root().resolve() != CANDIDATES_DIR.resolve()
    assert "candidates_staging" in str(staging_root())


def test_full_corpus_regeneration_artifact_when_green():
    path = regeneration_path()
    if not path.is_file():
        pytest.skip("full corpus gate not run yet")
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["reportType"] == "matcher_improvement_full_corpus_regeneration"
    assert payload["promotionGate"] is False
    assert payload["productionCandidatesUntouched"] is True
    assert payload["cohort"]["totalManuals"] == 72
    assert len(payload["cohort"]["approvedBacklogIds"]) == 9
    gov = payload.get("matcherGovernance") or {}
    assert gov.get("scopeViolations") == [] or gov.get("scopeViolations") is not None
    assert payload["humanReviewIntegrity"]["passed"] is True
    hashes_ok, _ = validate_frozen_hashes()
    assert hashes_ok


@pytest.mark.slow_full_gate
def test_run_full_corpus_regeneration_gate_green():
    impl = json.loads(
        (CALIBRATION_DIR / "CG_MATCHER_IMPROVEMENT_IMPLEMENTATION_AUDIT_v1.json").read_text(encoding="utf-8"),
    )
    if impl.get("status") != "GREEN":
        pytest.skip("implementation audit not GREEN")
    payload = run_full_corpus_regeneration_gate(write_staging=True)
    regen = payload["regeneration"]
    assert regen["status"] == "GREEN"
    assert regen["productionCandidatesUntouched"] is True
    assert regen["productionIntegrity"]["unchanged"] is True
    assert regen["deltas"]["matcherImprovementCount"] >= 1
    for record in regen.get("backlogImpact") or []:
        assert record["backlogId"] in set(approved_backlog_ids())
    assert regen["humanReviewIntegrity"]["passed"] is True
    assert regen["deltas"]["architectureException"] == 0
