from __future__ import annotations

from typing import Any


def build_proposed_change(candidate: dict[str, Any]) -> dict[str, Any]:
    candidate_type = candidate.get("candidateType")

    if candidate_type == "canonicalMapping":
        return {
            "overlaySection": "oemTermAliases",
            "operation": "add",
            "value": {
                str(candidate.get("sourceTerm")): candidate.get("canonicalId"),
            },
        }

    if candidate_type == "procedureTestBinding":
        return {
            "overlaySection": "procedureBindings",
            "operation": "add",
            "value": {
                "procedureId": candidate.get("procedureId"),
                "testTargetId": candidate.get("canonicalTestTarget"),
                "displayTitle": candidate.get("displayTitle"),
                "componentIds": candidate.get("componentIds") or [],
            },
        }

    if candidate_type == "measurementBinding":
        return {
            "overlaySection": "measurementBindings",
            "operation": "add",
            "value": {
                "procedureId": candidate.get("procedureId"),
                "measurementKnowledgeId": candidate.get("measurementKnowledgeId"),
                "testTargetId": candidate.get("canonicalTestTarget"),
            },
        }

    return {
        "overlaySection": "unknown",
        "operation": "noop",
        "value": {},
    }


def describe_proposed_change(candidate: dict[str, Any]) -> str:
    proposed = build_proposed_change(candidate)
    section = proposed.get("overlaySection")
    value = proposed.get("value") or {}

    if section == "oemTermAliases":
        for term, canonical_id in value.items():
            return f"alias: {term} → {canonical_id}"
    if section == "procedureBindings":
        return (
            f"procedureTestBinding: {value.get('procedureId')} "
            f"→ {value.get('testTargetId')}"
        )
    if section == "measurementBindings":
        return (
            f"measurementBinding: {value.get('measurementKnowledgeId')} "
            f"→ {value.get('testTargetId')}"
        )
    return "no proposed overlay change"
