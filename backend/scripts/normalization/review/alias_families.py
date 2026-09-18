from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, REVIEW_DIR
from ..pipeline import load_manifest
from .ledger import load_ledger, update_candidate_status
from .review_package import load_review_package, materialize_review_package


def load_alias_families_from_gap_report(
    report_path: Path | None = None,
) -> list[dict[str, Any]]:
    path = report_path or (CALIBRATION_DIR / "canonical_gap_report_v1_washer.json")
    if not path.is_file():
        raise FileNotFoundError(f"Gap report not found: {path}")
    report = json.loads(path.read_text(encoding="utf-8"))
    return report.get("buckets", {}).get("canonical_alias") or []


def _washer_manual_ids() -> list[str]:
    return [
        entry["manualId"]
        for entry in load_manifest().get("manuals", [])
        if entry.get("templateId") == "washer"
    ]


def collect_alias_family_candidates(
    canonical_id: str,
    manual_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    manual_ids = manual_ids or _washer_manual_ids()
    matches: list[dict[str, Any]] = []

    for manual_id in manual_ids:
        review_path = REVIEW_DIR / f"{manual_id}_review.json"
        if not review_path.is_file():
            continue
        package = json.loads(review_path.read_text(encoding="utf-8"))
        for record in package.get("records", []):
            if record.get("candidateType") != "canonicalMapping":
                continue
            if record.get("mapsTo") != canonical_id:
                continue
            matches.append(
                {
                    "manualId": manual_id,
                    "candidateId": record.get("candidateId"),
                    "sourceTerm": record.get("what"),
                    "canonicalId": record.get("mapsTo"),
                    "approvalLevel": record.get("approvalLevel"),
                    "status": record.get("status"),
                    "confidence": record.get("confidence"),
                    "mappingType": (record.get("why") or {}).get("mappingType"),
                },
            )
    return matches


def summarize_alias_family(canonical_id: str, candidates: list[dict[str, Any]]) -> dict[str, Any]:
    source_terms = sorted({str(c.get("sourceTerm") or "") for c in candidates if c.get("sourceTerm")})
    return {
        "canonicalId": canonical_id,
        "candidateCount": len(candidates),
        "manualCount": len({c.get("manualId") for c in candidates}),
        "sourceTerms": source_terms,
        "byStatus": _count_by(candidates, "status"),
        "byApprovalLevel": _count_by(candidates, "approvalLevel"),
    }


def _count_by(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        value = str(row.get(key) or "unknown")
        counts[value] = counts.get(value, 0) + 1
    return counts


def approve_alias_family(
    canonical_id: str,
    *,
    reviewer: str = "alias-family",
    reason: str = "CG-5.4 alias family approval",
    include_levels: tuple[str, ...] = ("easy", "normal"),
    dry_run: bool = False,
) -> dict[str, Any]:
    candidates = collect_alias_family_candidates(canonical_id)
    approved: list[str] = []
    skipped: list[dict[str, str]] = []

    for candidate in candidates:
        cid = candidate.get("candidateId")
        if not cid:
            continue
        status = candidate.get("status")
        level = candidate.get("approvalLevel")
        if status in {"approved", "promoted"}:
            skipped.append({"candidateId": cid, "reason": "already approved"})
            continue
        if status == "rejected":
            skipped.append({"candidateId": cid, "reason": "rejected"})
            continue
        if level not in include_levels:
            skipped.append({"candidateId": cid, "reason": f"level={level}"})
            continue

        if not dry_run:
            update_candidate_status(
                cid,
                "approved",
                reviewer=reviewer,
                reason=reason,
                manual_id=candidate.get("manualId"),
            )
        approved.append(cid)

    if not dry_run:
        for manual_id in {c.get("manualId") for c in candidates if c.get("manualId")}:
            materialize_review_package(manual_id, load_ledger())

    summary = summarize_alias_family(canonical_id, candidates)
    return {
        "canonicalId": canonical_id,
        "approvedCandidateIds": approved,
        "skipped": skipped,
        "summary": summary,
        "dryRun": dry_run,
    }


def approve_all_alias_families_from_gap(
    *,
    report_path: Path | None = None,
    reviewer: str = "alias-family",
    dry_run: bool = False,
) -> dict[str, Any]:
    families = load_alias_families_from_gap_report(report_path)
    results = []
    for family in families:
        canonical_id = family.get("canonicalId")
        if not canonical_id:
            continue
        results.append(
            approve_alias_family(
                canonical_id,
                reviewer=reviewer,
                dry_run=dry_run,
            ),
        )

    total_approved = sum(len(r.get("approvedCandidateIds") or []) for r in results)
    return {
        "familyCount": len(results),
        "totalApproved": total_approved,
        "families": results,
        "dryRun": dry_run,
    }
