from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import REVIEW_DIR

DECISIONS_FILENAME = "CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_DECISIONS_v1.json"
GATE_ID = "matcher-improvement-delta-reconciliation-v1"

POPULATION_A_DECISIONS = frozenset({"accept_staged", "defer_staged", "reject_staged"})
POPULATION_B_DECISIONS = frozenset({"accept_staged", "keep_production_baseline", "defer_review"})


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def decisions_path() -> Path:
    return REVIEW_DIR / DECISIONS_FILENAME


def empty_decisions_store() -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_delta_reconciliation_decisions",
        "gateId": GATE_ID,
        "generatedAt": _utc_now(),
        "decisions": {},
        "automaticDecisionsApplied": False,
    }


def load_delta_reconciliation_decisions() -> dict[str, Any]:
    path = decisions_path()
    if not path.is_file():
        return empty_decisions_store()
    return json.loads(path.read_text(encoding="utf-8"))


def save_delta_reconciliation_decisions(store: dict[str, Any]) -> Path:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    store["updatedAt"] = _utc_now()
    path = decisions_path()
    path.write_text(json.dumps(store, indent=2), encoding="utf-8")
    return path
