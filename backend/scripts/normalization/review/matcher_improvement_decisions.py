from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import REVIEW_DIR

DECISIONS_FILENAME = "CG_MATCHER_IMPROVEMENT_REVIEW_DECISIONS_v1.json"
ALLOWED_DECISIONS = frozenset({"approve", "defer", "reject", "no_change"})


def decisions_path() -> Path:
    return REVIEW_DIR / DECISIONS_FILENAME


def load_matcher_improvement_decisions() -> dict[str, Any]:
    path = decisions_path()
    if not path.is_file():
        return {
            "schemaVersion": 1,
            "reportType": "matcher_improvement_review_decisions",
            "gateId": "matcher-improvement-wave1",
            "decisions": {},
        }
    return json.loads(path.read_text(encoding="utf-8"))


def save_matcher_improvement_decisions(store: dict[str, Any]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    decisions_path().write_text(json.dumps(store, indent=2), encoding="utf-8")
