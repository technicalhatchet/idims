from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CANDIDATES_DIR, GLOBAL_CONFLICTS_PATH, REVIEW_DIR
from .approval_levels import auto_review_status, classify_candidate
from .proposed_change import build_proposed_change, describe_proposed_change


def _load_global_conflicts() -> list[dict[str, Any]]:
    if not GLOBAL_CONFLICTS_PATH.is_file():
        return []
    return json.loads(GLOBAL_CONFLICTS_PATH.read_text(encoding="utf-8")).get("conflicts", [])


def _conflicts_for_manual(manual_id: str) -> list[dict[str, Any]]:
    conflicts: list[dict[str, Any]] = []
    manual_conflicts_path = CANDIDATES_DIR / manual_id / "conflicts.json"
    if manual_conflicts_path.is_file():
        conflicts.extend(
            json.loads(manual_conflicts_path.read_text(encoding="utf-8")).get("conflicts", []),
        )
    for conflict in _load_global_conflicts():
        assertions = conflict.get("assertions") or []
        manual_ids = set()
        for assertion in assertions:
            if isinstance(assertion, dict) and assertion.get("manualIds"):
                manual_ids.update(assertion.get("manualIds") or [])
            elif isinstance(assertion, dict) and assertion.get("manualId"):
                manual_ids.add(assertion.get("manualId"))
        if manual_id in manual_ids:
            conflicts.append(conflict)
    return conflicts


def _matcher_layer(provenance: dict[str, Any]) -> str | None:
    for source in provenance.get("sources") or []:
        if source.get("type") == "matcher":
            return str(source.get("layer"))
    return None


def build_review_record(
    candidate: dict[str, Any],
    manual_id: str,
    manual_conflicts: list[dict[str, Any]],
    ledger_status: str | None = None,
) -> dict[str, Any]:
    provenance = candidate.get("provenance") or {}
    approval_level = classify_candidate(candidate)
    status = ledger_status or auto_review_status(candidate, approval_level)

    what = candidate.get("sourceTerm") or candidate.get("procedureId") or candidate.get("id")
    maps_to = (
        candidate.get("canonicalId")
        or candidate.get("canonicalTestTarget")
        or candidate.get("measurementKnowledgeId")
    )

    return {
        "candidateId": candidate.get("id"),
        "candidateType": candidate.get("candidateType"),
        "status": status,
        "rawCandidateStatus": candidate.get("status"),
        "approvalLevel": approval_level,
        "confidence": candidate.get("confidence"),
        "what": what,
        "extractedTerm": candidate.get("extractedTerm"),
        "seedComponentId": candidate.get("seedComponentId"),
        "blockedReason": candidate.get("blockedReason"),
        "mapsTo": maps_to,
        "why": {
            "confidence": candidate.get("confidence"),
            "matcherLayer": _matcher_layer(provenance),
            "mappingType": candidate.get("mappingType"),
            "matchedPhrase": candidate.get("matchedPhrase"),
            "decomposition": candidate.get("decomposition"),
            "summary": describe_proposed_change(candidate),
        },
        "source": {
            "manualId": provenance.get("manualId") or manual_id,
            "platformId": provenance.get("platformId"),
            "procedureId": provenance.get("procedureId"),
            "pages": provenance.get("pages") or [],
            "extractionDoc": next(
                (
                    source.get("path")
                    for source in (provenance.get("sources") or [])
                    if source.get("type") == "extraction_doc"
                ),
                None,
            ),
        },
        "conflicts": manual_conflicts,
        "proposedChange": build_proposed_change(candidate),
        "provenance": provenance,
        "reviewHistory": [],
    }


def materialize_review_package(
    manual_id: str,
    ledger: dict[str, Any] | None = None,
) -> dict[str, Any]:
    manual_dir = CANDIDATES_DIR / manual_id
    if not manual_dir.is_dir():
        raise FileNotFoundError(f"No candidate folder for manual {manual_id}")

    manifest = json.loads((manual_dir / "pipeline_manifest.json").read_text(encoding="utf-8"))
    mapping_candidates = json.loads(
        (manual_dir / "canonical_mapping_candidates.json").read_text(encoding="utf-8"),
    ).get("candidates", [])
    overlay_candidates = json.loads(
        (manual_dir / "overlay_candidates.json").read_text(encoding="utf-8"),
    ).get("candidates", [])

    all_candidates = mapping_candidates + overlay_candidates
    manual_conflicts = _conflicts_for_manual(manual_id)
    ledger_entries = (ledger or {}).get("candidates", {})

    records = []
    for candidate in all_candidates:
        candidate_id = candidate.get("id")
        ledger_entry = ledger_entries.get(candidate_id, {})
        resolved_canonical = ledger_entry.get("resolvedCanonicalId")
        if resolved_canonical:
            candidate = {
                **candidate,
                "canonicalId": resolved_canonical,
                "confidence": max(float(candidate.get("confidence") or 0), 0.9),
            }
        resolved_test_target = ledger_entry.get("resolvedTestTargetId")
        if resolved_test_target:
            candidate = {
                **candidate,
                "canonicalTestTarget": resolved_test_target,
                "confidence": max(float(candidate.get("confidence") or 0), 0.9),
            }
        record = build_review_record(
            candidate,
            manual_id,
            manual_conflicts,
            ledger_status=ledger_entry.get("status"),
        )
        if ledger_entry.get("reviewHistory"):
            record["reviewHistory"] = ledger_entry["reviewHistory"]
        if ledger_entry.get("reviewer"):
            record["reviewer"] = ledger_entry["reviewer"]
        if ledger_entry.get("promotedAt"):
            record["promotedAt"] = ledger_entry["promotedAt"]
        if ledger_entry.get("resolutionClassification"):
            record["resolutionClassification"] = ledger_entry["resolutionClassification"]
        records.append(record)

    package = {
        "manualId": manual_id,
        "platformId": manifest.get("platformId"),
        "templateId": manifest.get("templateId"),
        "ontologyId": manifest.get("ontologyId"),
        "materializedAt": datetime.now(timezone.utc).isoformat(),
        "records": records,
        "summary": summarize_review_records(records),
    }

    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    package_path = REVIEW_DIR / f"{manual_id}_review.json"
    package_path.write_text(json.dumps(package, indent=2), encoding="utf-8")
    return package


def summarize_review_records(records: list[dict[str, Any]]) -> dict[str, Any]:
    summary = {
        "total": len(records),
        "byStatus": {},
        "byApprovalLevel": {},
        "byType": {},
        "byConfidenceBucket": {
            "high_gte_0.95": 0,
            "medium_0.80_0.94": 0,
            "low_lt_0.80": 0,
            "unresolved": 0,
        },
        "byBlockedReason": {},
    }
    for record in records:
        status = record.get("status") or "candidate"
        level = record.get("approvalLevel") or "normal"
        ctype = record.get("candidateType") or "unknown"
        summary["byStatus"][status] = summary["byStatus"].get(status, 0) + 1
        summary["byApprovalLevel"][level] = summary["byApprovalLevel"].get(level, 0) + 1
        summary["byType"][ctype] = summary["byType"].get(ctype, 0) + 1

        confidence = record.get("confidence")
        raw_status = record.get("rawCandidateStatus") or record.get("status")
        if raw_status in {"UNRESOLVED_TERM", "COMPOUND_TERM_CANDIDATE"} and not record.get("mapsTo"):
            summary["byConfidenceBucket"]["unresolved"] += 1
        elif raw_status == "UNRESOLVED_TERM" or confidence is None:
            summary["byConfidenceBucket"]["unresolved"] += 1
        elif confidence >= 0.95:
            summary["byConfidenceBucket"]["high_gte_0.95"] += 1
        elif confidence >= 0.80:
            summary["byConfidenceBucket"]["medium_0.80_0.94"] += 1
        else:
            summary["byConfidenceBucket"]["low_lt_0.80"] += 1

        blocked_reason = record.get("blockedReason")
        if blocked_reason:
            summary["byBlockedReason"][blocked_reason] = (
                summary["byBlockedReason"].get(blocked_reason, 0) + 1
            )
    return summary


def load_review_package(manual_id: str) -> dict[str, Any]:
    path = REVIEW_DIR / f"{manual_id}_review.json"
    if not path.is_file():
        raise FileNotFoundError(f"Review package missing for {manual_id}. Run materialize first.")
    return json.loads(path.read_text(encoding="utf-8"))
