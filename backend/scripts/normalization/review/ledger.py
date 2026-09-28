from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import REVIEW_DIR


def ledger_path() -> Path:
    return REVIEW_DIR / "ledger.json"


def load_ledger() -> dict[str, Any]:
    path = ledger_path()
    if not path.is_file():
        return {"candidates": {}, "promotions": []}
    return json.loads(path.read_text(encoding="utf-8"))


def save_ledger(ledger: dict[str, Any]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    ledger_path().write_text(json.dumps(ledger, indent=2), encoding="utf-8")


def update_candidate_status(
    candidate_id: str,
    status: str,
    reviewer: str | None = None,
    reason: str | None = None,
    manual_id: str | None = None,
    *,
    resolved_canonical_id: str | None = None,
    resolved_test_target_id: str | None = None,
    resolution_classification: str | None = None,
) -> dict[str, Any]:
    ledger = load_ledger()
    entry = ledger["candidates"].get(candidate_id, {})
    history = entry.get("reviewHistory", [])
    history.append(
        {
            "at": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "reviewer": reviewer,
            "reason": reason,
        },
    )
    updated = {
        **entry,
        "status": status,
        "manualId": manual_id or entry.get("manualId"),
        "reviewer": reviewer,
        "reason": reason,
        "reviewHistory": history,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    if resolved_canonical_id:
        updated["resolvedCanonicalId"] = resolved_canonical_id
    if resolved_test_target_id:
        updated["resolvedTestTargetId"] = resolved_test_target_id
    if resolution_classification:
        updated["resolutionClassification"] = resolution_classification
    ledger["candidates"][candidate_id] = updated
    save_ledger(ledger)
    return ledger["candidates"][candidate_id]


def mark_candidates_promoted(candidate_ids: list[str], promotion_id: str) -> None:
    ledger = load_ledger()
    now = datetime.now(timezone.utc).isoformat()
    for candidate_id in candidate_ids:
        entry = ledger["candidates"].get(candidate_id, {})
        history = entry.get("reviewHistory", [])
        history.append(
            {
                "at": now,
                "status": "promoted",
                "promotionId": promotion_id,
            },
        )
        ledger["candidates"][candidate_id] = {
            **entry,
            "status": "promoted",
            "promotedAt": now,
            "promotionId": promotion_id,
            "reviewHistory": history,
        }
    ledger["promotions"].append(
        {
            "promotionId": promotion_id,
            "candidateIds": candidate_ids,
            "promotedAt": now,
        },
    )
    save_ledger(ledger)
