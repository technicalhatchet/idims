from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR
from normalization.review.matcher_improvement_delta_review import (
    delta_review_path,
    run_delta_review_gate,
    staging_root,
)
from normalization.paths import CANDIDATES_DIR


def test_staging_separate_from_production():
    assert staging_root().resolve() != CANDIDATES_DIR.resolve()


def test_delta_review_artifact_when_ready():
    path = delta_review_path()
    if not path.is_file():
        pytest.skip("run run_matcher_improvement_delta_review.py")
    review = json.loads(path.read_text(encoding="utf-8"))
    assert review["promotionGate"] is False
    assert review["productionSwapAllowed"] is False
    assert review["counts"]["matcherImprovementMappings"] == 46
    assert review["humanReviewSafety"]["productionCandidatesUntouched"] is True
    assert review["humanReviewSafety"]["waveIntegrityPassed"] is True


def test_delta_review_gate_ready():
    regen = CALIBRATION_DIR / "CG_MATCHER_IMPROVEMENT_FULL_CORPUS_REGENERATION_v1.json"
    if not regen.is_file():
        pytest.skip("full corpus regen missing")
    if not staging_root().is_dir():
        pytest.skip("staged corpus missing")
    payload = run_delta_review_gate()
    review = payload["review"]
    assert review["status"] == "GREEN — DELTA REVIEW READY"
    assert review["counts"]["allDeltas"] == 54
    assert review["counts"]["addedToUnresolved"] == 12
    assert review["counts"]["removedViaMatcherImprovement"] == 46
    assert review["counts"]["removedViaOtherPaths"] == 12
    assert review["counts"]["unexplainedNonAuthorized"] == 0
    assert review["counts"]["unexplainedAddedUnresolved"] == 0
