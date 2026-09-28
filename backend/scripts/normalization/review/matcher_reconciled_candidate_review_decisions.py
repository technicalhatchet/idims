from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import REVIEW_DIR

DECISIONS_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_v1.json"
GATE_ID = "matcher-reconciled-candidate-review-v1"
ALLOWED_DECISIONS = frozenset({"accepted", "deferred", "rejected"})


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def decisions_path() -> Path:
    return REVIEW_DIR / DECISIONS_FILENAME


def empty_decisions_store() -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "reportType": "matcher_reconciled_candidate_review_decisions",
        "gateId": GATE_ID,
        "generatedAt": _utc_now(),
        "decisions": {},
        "automaticDecisionsApplied": False,
        "mergedIntoProductionReviewDecisions": False,
    }


def load_matcher_reconciled_decisions() -> dict[str, Any]:
    path = decisions_path()
    if not path.is_file():
        return empty_decisions_store()
    return json.loads(path.read_text(encoding="utf-8"))


def save_matcher_reconciled_decisions(store: dict[str, Any]) -> Path:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    store["updatedAt"] = _utc_now()
    store["automaticDecisionsApplied"] = False
    store["mergedIntoProductionReviewDecisions"] = False
    path = decisions_path()
    path.write_text(json.dumps(store, indent=2), encoding="utf-8")
    return path
