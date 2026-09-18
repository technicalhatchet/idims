from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import (
    CALIBRATION_DIR,
    CANDIDATES_DIR,
    GLOBAL_CONFLICTS_PATH,
    REVIEW_DIR,
)
from ..pipeline import load_manifest
from ..review.ledger import load_ledger
from ..review.review_package import materialize_review_package, summarize_review_records
from .overlay_coverage import (
    candidate_overlay_state,
    load_all_overlay_aliases,
    load_all_overlay_measurement_bindings,
    load_all_overlay_procedure_bindings,
)


def _confidence_bucket(confidence: float | None, status: str | None) -> str:
    if status in {"UNRESOLVED_TERM"} or confidence is None:
        return "unresolved"
    if confidence >= 0.95:
        return "high_gte_0.95"
    if confidence >= 0.80:
        return "medium_0.80_0.94"
    return "low_lt_0.80"


def _load_global_conflicts() -> list[dict[str, Any]]:
    if not GLOBAL_CONFLICTS_PATH.is_file():
        return []
    return json.loads(GLOBAL_CONFLICTS_PATH.read_text(encoding="utf-8")).get("conflicts", [])


def _duplicate_keys(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: dict[str, list[str]] = defaultdict(list)
    for record in records:
        what = str(record.get("what") or "").lower()
        maps_to = str(record.get("mapsTo") or "")
        ctype = record.get("candidateType")
        key = f"{ctype}::{what}::{maps_to}"
        seen[key].append(record.get("candidateId") or "")

    duplicates = []
    for key, ids in seen.items():
        if len(ids) > 1:
            duplicates.append({"key": key, "candidateIds": ids, "count": len(ids)})
    return duplicates


def collect_baseline_metrics(
    manual_ids: list[str] | None = None,
    materialize_reviews: bool = True,
) -> dict[str, Any]:
    manifest = load_manifest()
    all_manual_ids = [m["manualId"] for m in manifest.get("manuals", [])]
    if manual_ids is None:
        manual_ids = [
            path.name
            for path in CANDIDATES_DIR.iterdir()
            if path.is_dir() and not path.name.startswith("_")
        ]
        manual_ids = sorted(set(manual_ids))

    ledger = load_ledger()
    overlay_aliases = load_all_overlay_aliases()
    overlay_procedures = load_all_overlay_procedure_bindings()
    overlay_measurements = load_all_overlay_measurement_bindings()
    global_conflicts = _load_global_conflicts()

    totals: dict[str, Any] = {
        "manuals": 0,
        "candidates": 0,
        "byType": Counter(),
        "byStatus": Counter(),
        "byApprovalLevel": Counter(),
        "byConfidenceBucket": Counter(),
        "byOverlayState": Counter(),
        "byMappingType": Counter(),
        "conflictRefs": 0,
        "globalConflicts": {
            "total": len(global_conflicts),
            "byType": Counter(c.get("conflictType") for c in global_conflicts),
        },
        "procedureBindingConfidence": [],
        "measurementBindingConfidence": [],
        "unresolvedTerms": Counter(),
        "compoundCandidates": 0,
        "duplicateCandidateGroups": 0,
        "promotionReady": 0,
        "alreadyPublished": 0,
        "byBlockedReason": Counter(),
        "extractionFiltered": 0,
        "extractionFilteredProcedural": 0,
        "extractionFilteredStructural": 0,
        "perManual": {},
    }

    all_records: list[dict[str, Any]] = []

    for manual_id in manual_ids:
        manual_dir = CANDIDATES_DIR / manual_id
        if not manual_dir.is_dir():
            continue

        totals["manuals"] += 1

        if materialize_reviews or not (REVIEW_DIR / f"{manual_id}_review.json").is_file():
            package = materialize_review_package(manual_id, ledger)
        else:
            package = json.loads(
                (REVIEW_DIR / f"{manual_id}_review.json").read_text(encoding="utf-8"),
            )

        records = package.get("records") or []
        all_records.extend(records)
        summary = package.get("summary") or summarize_review_records(records)

        manual_stats = {
            "manualId": manual_id,
            "platformId": package.get("platformId"),
            "templateId": package.get("templateId"),
            "total": summary.get("total", 0),
            "byType": summary.get("byType", {}),
            "byApprovalLevel": summary.get("byApprovalLevel", {}),
            "blocked": summary.get("byApprovalLevel", {}).get("blocked", 0),
        }
        totals["perManual"][manual_id] = manual_stats

        manifest_path = manual_dir / "pipeline_manifest.json"
        if manifest_path.is_file():
            pipeline_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            filters = pipeline_manifest.get("extractionFilters") or {}
            totals["extractionFiltered"] += filters.get("totalFiltered", 0)
            totals["extractionFilteredProcedural"] += filters.get("proceduralNoise", 0)
            totals["extractionFilteredStructural"] += filters.get("structuralNoise", 0)

        totals["candidates"] += summary.get("total", 0)
        for key, count in (summary.get("byType") or {}).items():
            totals["byType"][key] += count
        for key, count in (summary.get("byStatus") or {}).items():
            totals["byStatus"][key] += count
        for key, count in (summary.get("byApprovalLevel") or {}).items():
            totals["byApprovalLevel"][key] += count
        for key, count in (summary.get("byConfidenceBucket") or {}).items():
            totals["byConfidenceBucket"][key] += count
        for key, count in (summary.get("byBlockedReason") or {}).items():
            totals["byBlockedReason"][key] += count

        for record in records:
            totals["conflictRefs"] += len(record.get("conflicts") or [])

            candidate_payload = {
                "candidateType": record.get("candidateType"),
                "sourceTerm": record.get("what"),
                "canonicalId": record.get("mapsTo"),
                "procedureId": (record.get("source") or {}).get("procedureId"),
                "measurementKnowledgeId": record.get("mapsTo")
                if record.get("candidateType") == "measurementBinding"
                else None,
                "status": record.get("status"),
            }
            overlay_state = candidate_overlay_state(
                candidate_payload,
                overlay_aliases,
                overlay_procedures,
                overlay_measurements,
            )
            totals["byOverlayState"][overlay_state] += 1
            if overlay_state == "promotion_ready":
                totals["promotionReady"] += 1
            if overlay_state == "already_published":
                totals["alreadyPublished"] += 1

            raw_status = record.get("rawCandidateStatus") or record.get("status")
            if raw_status == "UNRESOLVED_TERM":
                totals["unresolvedTerms"][record.get("what")] += 1
            if raw_status == "COMPOUND_TERM_CANDIDATE":
                totals["compoundCandidates"] += 1

            if record.get("candidateType") == "canonicalMapping":
                mapping_type = (record.get("why") or {}).get("mappingType") or "alias"
                totals["byMappingType"][mapping_type] += 1

            ctype = record.get("candidateType")
            confidence = record.get("confidence")
            if ctype == "procedureTestBinding" and confidence is not None:
                totals["procedureBindingConfidence"].append(confidence)
            if ctype == "measurementBinding" and confidence is not None:
                totals["measurementBindingConfidence"].append(confidence)

    duplicates = _duplicate_keys(all_records)
    totals["duplicateCandidateGroups"] = len(duplicates)
    totals["duplicateExamples"] = duplicates[:25]

    totals["unresolvedTermsTop"] = totals["unresolvedTerms"].most_common(30)
    totals["avgProcedureBindingConfidence"] = _avg(totals["procedureBindingConfidence"])
    totals["avgMeasurementBindingConfidence"] = _avg(totals["measurementBindingConfidence"])

    totals["qualityIndicators"] = _quality_indicators(totals)
    totals["manifestManualCount"] = len(all_manual_ids)
    totals["normalizedManualCount"] = totals["manuals"]

    return _serialize_counters(totals)


def _avg(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def _quality_indicators(totals: dict[str, Any]) -> dict[str, Any]:
    candidates = totals.get("candidates") or 0
    if not candidates:
        return {}

    blocked = totals.get("byApprovalLevel", {}).get("blocked", 0)
    easy = totals.get("byApprovalLevel", {}).get("easy", 0)
    careful = totals.get("byApprovalLevel", {}).get("careful", 0)
    unresolved = totals.get("byConfidenceBucket", {}).get("unresolved", 0)
    alias_conflicts = totals.get("globalConflicts", {}).get("byType", {}).get(
        "ALIAS_CONFLICT",
        0,
    )
    relationship_conflicts = totals.get("globalConflicts", {}).get("byType", {}).get(
        "RELATIONSHIP_CONFLICT",
        0,
    )

    return {
        "blockedRate": round(blocked / candidates, 4),
        "unresolvedRate": round(unresolved / candidates, 4),
        "easyApprovalShare": round(easy / candidates, 4),
        "carefulReviewShare": round(careful / candidates, 4),
        "conflictRate": round(
            (alias_conflicts + relationship_conflicts) / max(totals["manuals"], 1),
            4,
        ),
        "promotionReadyRate": round(totals.get("promotionReady", 0) / candidates, 4),
        "alreadyPublishedRate": round(totals.get("alreadyPublished", 0) / candidates, 4),
        "compoundCandidateShare": round(
            totals.get("compoundCandidates", 0) / candidates,
            4,
        ),
    }


def _serialize_counters(payload: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, Counter):
            result[key] = dict(value)
        elif isinstance(value, dict):
            result[key] = _serialize_counters(value)
        else:
            result[key] = value
    return result


def write_baseline(
    metrics: dict[str, Any],
    version: str,
    *,
    template_filter: str | None = None,
    matcher_version: str = "cg5-v1",
) -> Path:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"normalization_metrics_{version}.json"
    if template_filter:
        filename = f"normalization_metrics_{version}_{template_filter}.json"

    baseline = {
        "schemaVersion": "1.0.0",
        "baselineVersion": version,
        "matcherVersion": matcher_version,
        "templateFilter": template_filter,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
    }
    path = CALIBRATION_DIR / filename
    path.write_text(json.dumps(baseline, indent=2), encoding="utf-8")
    return path


def compare_baselines(
    before: dict[str, Any],
    after: dict[str, Any],
) -> dict[str, Any]:
    before_metrics = before.get("metrics") or before
    after_metrics = after.get("metrics") or after

    def delta(key: str) -> int | float | None:
        before_value = before_metrics.get(key)
        after_value = after_metrics.get(key)
        if isinstance(before_value, (int, float)) and isinstance(after_value, (int, float)):
            return after_value - before_value
        return None

    quality_before = before_metrics.get("qualityIndicators") or {}
    quality_after = after_metrics.get("qualityIndicators") or {}

    return {
        "candidatesDelta": delta("candidates"),
        "blockedRateDelta": _sub(
            quality_after.get("blockedRate"),
            quality_before.get("blockedRate"),
        ),
        "unresolvedRateDelta": _sub(
            quality_after.get("unresolvedRate"),
            quality_before.get("unresolvedRate"),
        ),
        "promotionReadyRateDelta": _sub(
            quality_after.get("promotionReadyRate"),
            quality_before.get("promotionReadyRate"),
        ),
        "compoundCandidateShareDelta": _sub(
            quality_after.get("compoundCandidateShare"),
            quality_before.get("compoundCandidateShare"),
        ),
        "before": {
            "baselineVersion": before.get("baselineVersion"),
            "matcherVersion": before.get("matcherVersion"),
            "candidates": before_metrics.get("candidates"),
            "qualityIndicators": quality_before,
        },
        "after": {
            "baselineVersion": after.get("baselineVersion"),
            "matcherVersion": after.get("matcherVersion"),
            "candidates": after_metrics.get("candidates"),
            "qualityIndicators": quality_after,
        },
    }


def _sub(a: Any, b: Any) -> float | None:
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return round(a - b, 4)
    return None
