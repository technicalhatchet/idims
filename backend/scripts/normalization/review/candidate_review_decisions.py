from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .candidate_review_preflight import DECISIONS_FILENAME
from ..paths import REVIEW_DIR

REVIEW_STATUSES = frozenset({"unreviewed", "accepted", "rejected", "deferred"})


def decisions_path() -> Path:
    return REVIEW_DIR / DECISIONS_FILENAME


def load_decisions() -> dict[str, Any]:
    path = decisions_path()
    if not path.is_file():
        return {
            "schemaVersion": 1,
            "reportType": "candidate_review_decisions",
            "decisions": {},
        }
    return json.loads(path.read_text(encoding="utf-8"))


def save_decisions(store: dict[str, Any]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    decisions_path().write_text(json.dumps(store, indent=2), encoding="utf-8")


def record_review_decision(
    candidate_id: str,
    review_status: str,
    *,
    manual_id: str | None = None,
    reviewer: str | None = None,
    reason: str | None = None,
    batch_run_id: str | None = None,
) -> dict[str, Any]:
    if review_status not in REVIEW_STATUSES - {"unreviewed"}:
        raise ValueError(f"invalid review status: {review_status}")

    store = load_decisions()
    now = datetime.now(timezone.utc).isoformat()
    existing = store["decisions"].get(candidate_id, {})
    history = list(existing.get("history") or [])
    history.append(
        {
            "at": now,
            "reviewStatus": review_status,
            "reviewer": reviewer,
            "reason": reason,
        },
    )
    updated = {
        **existing,
        "candidateId": candidate_id,
        "manualId": manual_id or existing.get("manualId"),
        "reviewStatus": review_status,
        "reviewer": reviewer,
        "reason": reason,
        "batchRunId": batch_run_id or existing.get("batchRunId"),
        "updatedAt": now,
        "history": history,
    }
    store["decisions"][candidate_id] = updated
    save_decisions(store)
    return updated


def merge_decisions_into_records(
    records: list[dict[str, Any]],
    decisions: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    store = decisions or load_decisions()
    decision_map = store.get("decisions") or {}
    merged: list[dict[str, Any]] = []
    for record in records:
        candidate_id = str(record.get("candidateId") or "")
        decision = decision_map.get(candidate_id) or {}
        review_status = decision.get("reviewStatus") or "unreviewed"
        merged.append(
            {
                **record,
                "reviewStatus": review_status,
                "reviewDecision": {
                    "reviewStatus": review_status,
                    "reviewer": decision.get("reviewer"),
                    "reason": decision.get("reason"),
                    "updatedAt": decision.get("updatedAt"),
                },
            },
        )
    return merged
