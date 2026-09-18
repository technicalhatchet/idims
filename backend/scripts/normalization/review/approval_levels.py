from __future__ import annotations

from typing import Any

APPROVAL_LEVELS = (
    "easy",
    "normal",
    "careful",
    "high_risk",
    "blocked",
)

EASY_ALIAS_CONFIDENCE = 0.95


def classify_candidate(candidate: dict[str, Any]) -> str:
    status = str(candidate.get("status") or "candidate")
    if status in {"UNRESOLVED_TERM", "CONFLICT_REQUIRES_REVIEW", "FILTERED_NOISE"}:
        return "blocked"
    if status == "COMPOUND_TERM_CANDIDATE":
        return "careful"

    registry_review = candidate.get("reviewLevel")
    if registry_review in APPROVAL_LEVELS:
        return str(registry_review)

    candidate_type = candidate.get("candidateType")
    confidence = float(candidate.get("confidence") or 0)

    if candidate_type == "canonicalMapping":
        if candidate.get("mappingType") == "seed_component_id":
            return str(candidate.get("reviewLevel") or "normal")
        if candidate.get("mappingType") == "compound_alias":
            return "careful"
        if confidence >= EASY_ALIAS_CONFIDENCE and candidate.get("canonicalId"):
            return "easy"
        return "normal"

    if candidate_type == "procedureTestBinding":
        return "normal"

    if candidate_type == "measurementBinding":
        return "normal"

    if candidate_type in {"relationshipOverride", "relationshipAddition"}:
        return "high_risk"

    if candidate_type == "canonicalOverride":
        return "high_risk"

    return "normal"


def auto_review_status(candidate: dict[str, Any], approval_level: str) -> str:
    if approval_level == "blocked":
        return "needs_review"
    return str(candidate.get("status") or "candidate")
