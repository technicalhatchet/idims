from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANDIDATES_DIR
from normalization.review.matcher_improvement_delta_reconciliation_decisions import load_delta_reconciliation_decisions
from normalization.review.matcher_improvement_delta_reconciliation_final import (
    manifest_path,
    run_final_delta_reconciliation_report,
    write_final_artifacts,
)


def test_seventy_decisions_complete():
    store = load_delta_reconciliation_decisions()
    assert len(store.get("decisions") or {}) == 70
    assert store.get("automaticDecisionsApplied") is False


def test_final_report_green_and_manifest_authority():
    payload = run_final_delta_reconciliation_report()
    final = payload["final"]
    manifest = payload["manifest"]
    assert final["status"] == "GREEN"
    assert final["humanReviewComplete"] is True
    assert final["totals"]["populationAAccepted"] == 46
    assert final["totals"]["populationBAccepted"] + final["totals"]["populationBKeptBaseline"] == 24
    assert final["totals"]["authorizedForProductionReconciliation"] == 52
    assert manifest["soleAuthorityForNextGate"] is True
    assert manifest["canonicalPromotionImplied"] is False
    assert all(r["decision"] == "accept_staged" for r in manifest["records"])
    assert len(manifest["records"]) == 52
    assert final["integrity"]["productionCandidatesUntouched"] is True


def test_final_artifacts_on_disk():
    payload = run_final_delta_reconciliation_report()
    write_final_artifacts(payload)
    assert (CALIBRATION_DIR / "CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_FINAL_v1.json").is_file()
    manifest = json.loads(manifest_path().read_text(encoding="utf-8"))
    keys = [r["candidateKey"] for r in manifest["records"]]
    assert len(keys) == len(set(keys))
