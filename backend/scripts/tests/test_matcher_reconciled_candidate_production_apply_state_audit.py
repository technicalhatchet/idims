from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR


AUDIT_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_STATE_AUDIT_v1.json"


def test_production_apply_state_audit_on_disk():
    path = CALIBRATION_DIR / AUDIT_FILENAME
    assert path.is_file(), "state audit artifact missing; run read-only state audit generator"
    audit = json.loads(path.read_text(encoding="utf-8"))
    summary = audit["summary"]
    assert audit["classification"] in {"A", "B", "C", "D"}
    assert summary["authorizedScope"] == 52
    assert summary["mappingContentMatchesReview"] == 52
    assert summary["validApplyStamps"] == 52
    assert summary["reconciliationChangesetHashMatchesExcludingStamp"] == 52
    assert summary["commitExactRecordMatches"] == 52
    assert audit["classification"] == "D"
    lock = audit["artifactState"]["lock"]
    assert lock["applyAuthorizationGranted"] is True
    assert lock["productionMutationsExecuted"] is True
    assert audit["artifactState"]["applyReport"]["changesetEntryCount"] == 0
