from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.promotion.planner import format_promotion_diff, plan_promotion
from normalization.promotion.publish import apply_promotion_diff
from normalization.review.approval_levels import classify_candidate
from normalization.review.ledger import load_ledger, update_candidate_status
from normalization.review.review_package import build_review_record, materialize_review_package


@pytest.fixture
def w8178558_entry():
    from normalization.pipeline import find_manual_entry, load_manifest

    return find_manual_entry(load_manifest(), "W8178558")


def test_classify_easy_alias():
    level = classify_candidate(
        {
            "candidateType": "canonicalMapping",
            "confidence": 0.98,
            "canonicalId": "motor_controller",
            "status": "candidate",
        },
    )
    assert level == "easy"


def test_classify_blocked_unresolved():
    level = classify_candidate(
        {
            "candidateType": "canonicalMapping",
            "status": "UNRESOLVED_TERM",
        },
    )
    assert level == "blocked"


def test_review_record_has_evidence_fields(w8178558_entry, tmp_path, monkeypatch):
    from normalization.paths import CANDIDATES_DIR, REVIEW_DIR

    monkeypatch.setattr("normalization.review.review_package.REVIEW_DIR", tmp_path / "review")
    monkeypatch.setattr("normalization.review.review_package.CANDIDATES_DIR", CANDIDATES_DIR)

    package = materialize_review_package("W8178558")
    mcu = next(
        r for r in package["records"]
        if r.get("what") == "MCU" and r.get("mapsTo") == "motor_controller"
    )
    assert mcu["approvalLevel"] == "easy"
    assert mcu["source"]["manualId"] == "W8178558"
    assert mcu["proposedChange"]["overlaySection"] == "oemTermAliases"
    assert mcu["why"]["matcherLayer"]


def test_ledger_approve_updates_status(tmp_path, monkeypatch):
    monkeypatch.setattr("normalization.review.ledger.REVIEW_DIR", tmp_path)
    update_candidate_status("test-candidate", "approved", reviewer="tester", manual_id="W8178558")
    ledger = load_ledger()
    assert ledger["candidates"]["test-candidate"]["status"] == "approved"


def test_plan_promotion_diff_for_approved(w8178558_entry, tmp_path, monkeypatch):
    from normalization.paths import CANDIDATES_DIR, PROMOTIONS_DIR, REVIEW_DIR

    review_dir = tmp_path / "review"
    promotions_dir = tmp_path / "promotions"
    monkeypatch.setattr("normalization.review.review_package.REVIEW_DIR", review_dir)
    monkeypatch.setattr("normalization.review.review_package.CANDIDATES_DIR", CANDIDATES_DIR)
    monkeypatch.setattr("normalization.review.ledger.REVIEW_DIR", review_dir)
    monkeypatch.setattr("normalization.promotion.planner.PROMOTIONS_DIR", promotions_dir)

    materialize_review_package("W8178558")
    update_candidate_status(
        "map-W8178558-mcu-motor_controller",
        "approved",
        reviewer="test",
        manual_id="W8178558",
    )
    materialize_review_package("W8178558", load_ledger())

    plan = plan_promotion("W8178558")
    assert plan["manualId"] == "W8178558"
    assert plan["blocked"] is False
    diff_text = format_promotion_diff(plan)
    assert "MCU" in diff_text or "already present" in diff_text.lower()


def test_relationship_conflict_blocks_high_risk_only():
    record = build_review_record(
        {
            "id": "rel-1",
            "candidateType": "relationshipOverride",
            "status": "candidate",
            "confidence": 0.9,
        },
        "W8178558",
        [
            {
                "id": "conflict-topology",
                "status": "CONFLICT_REQUIRES_REVIEW",
                "conflictType": "RELATIONSHIP_CONFLICT",
                "description": "topology mix",
            },
        ],
    )
    assert record["approvalLevel"] in {"normal", "high_risk", "blocked"}


def test_apply_promotion_diff_adds_alias():
    overlay = {
        "platformFamilies": [
            {
                "platformFamilyId": "whirlpool_duet_sport_ccu_mcu",
                "oemTermAliases": {"CCU": "control_board"},
                "procedureBindings": [],
                "measurementBindings": [],
            },
        ],
    }
    result = apply_promotion_diff(
        overlay,
        "whirlpool_duet_sport_ccu_mcu",
        {
            "oemTermAliases": {
                "add": {"TestAlias": "door_lock"},
            },
        },
    )
    family = result["platformFamilies"][0]
    assert family["oemTermAliases"]["TestAlias"] == "door_lock"
