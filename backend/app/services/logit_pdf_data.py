"""
Normalize LoGiT project data into a report dictionary for ``build_logit_pdf_v2``.

This module does not render PDFs and does not call Gemini.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence

PRIORITY_KEYS = ("critical", "major", "moderate", "minor")
TYPE_KEYS = ("problem", "idea", "blocker", "positive")

CATEGORY_LABELS: Dict[str, str] = {
    "scheduling": "Scheduling",
    "job_details": "Job Details",
    "diagnostics": "Diagnostics",
    "parts": "Parts",
    "documentation": "Documentation",
    "photos": "Photos",
    "customer": "Customer",
    "performance": "Performance",
    "ui_ux": "UI / UX",
    "other": "Other",
}

FREQUENCY_LABELS: Dict[str, str] = {
    "once": "Once",
    "occasional": "Occasional",
    "frequent": "Frequent",
    "every_time": "Every time",
    "unknown": "Unknown",
    "not_applicable": "N/A",
}

PRIORITY_LABELS: Dict[str, str] = {
    "critical": "Critical",
    "major": "Major",
    "moderate": "Moderate",
    "minor": "Minor",
}

TYPE_LABELS: Dict[str, str] = {
    "problem": "Problem",
    "idea": "Idea",
    "blocker": "Blocker",
    "positive": "Good Stuff",
}


def _norm(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _pct(count: int, total: int) -> int:
    if total <= 0:
        return 0
    return int(round((count / total) * 100))


def _priority_key(obs: dict) -> str:
    key = _norm(obs.get("priority") or obs.get("severity"), "moderate").lower()
    return key if key in PRIORITY_KEYS else "moderate"


def _type_key(obs: dict) -> str:
    key = _norm(obs.get("type"), "problem").lower()
    if key == "good_stuff":
        return "positive"
    return key if key in TYPE_KEYS else "problem"


def compute_priority_summary(observations: Sequence[dict]) -> Dict[str, int]:
    counts = Counter(_priority_key(o) for o in observations)
    return {k: counts.get(k, 0) for k in PRIORITY_KEYS}


def compute_type_summary(observations: Sequence[dict]) -> Dict[str, int]:
    counts = Counter(_type_key(o) for o in observations)
    return {k: counts.get(k, 0) for k in TYPE_KEYS}


def compute_matrix(observations: Sequence[dict]) -> Dict[str, Dict[str, int]]:
    matrix: Dict[str, Dict[str, int]] = {
        priority: {obs_type: 0 for obs_type in TYPE_KEYS} for priority in PRIORITY_KEYS
    }
    for obs in observations:
        matrix[_priority_key(obs)][_type_key(obs)] += 1
    return matrix


def compute_category_breakdown(observations: Sequence[dict]) -> List[Dict[str, Any]]:
    counts = Counter(_norm(o.get("category"), "other").lower() for o in observations)
    total = len(observations) or 1
    rows: List[Dict[str, Any]] = []
    for key, count in counts.most_common():
        label = CATEGORY_LABELS.get(key, key.replace("_", " ").title())
        rows.append(
            {
                "key": key,
                "label": label,
                "count": count,
                "percent": _pct(count, len(observations)),
            }
        )
    return rows


def normalize_observation(raw: dict) -> dict:
    """Map API / DB entry fields into the PDF observation contract."""
    return {
        "id": _norm(raw.get("id")),
        "type": _type_key(raw),
        "priority": _priority_key(raw),
        "category": _norm(raw.get("category"), "other").lower(),
        "frequency": _norm(raw.get("frequency"), "unknown").lower(),
        "title": _norm(raw.get("title") or raw.get("ai_title"), "Untitled observation"),
        "description": _norm(raw.get("description") or raw.get("ai_description")),
        "impact": _norm(raw.get("impact") or raw.get("ai_impact")),
        "suggested_fix": _norm(raw.get("suggested_fix") or raw.get("ai_suggested_fix")),
        "original_transcript": _norm(raw.get("original_transcript") or raw.get("original_note")),
        "created_at": raw.get("created_at"),
    }


def build_logit_report_dict(
    *,
    project: dict,
    observations: Iterable[dict],
    executive_summary: str,
    key_findings: Optional[List[dict]] = None,
    talking_points: Optional[List[dict]] = None,
    report_title: str = "Field Observation Report",
    period_start: Optional[datetime | str] = None,
    period_end: Optional[datetime | str] = None,
    generated_at: Optional[datetime | str] = None,
    include_original_transcripts: bool = False,
) -> dict:
    """Assemble a normalized report dictionary for the PDF renderer."""
    normalized = [normalize_observation(o) for o in observations]
    priority_summary = compute_priority_summary(normalized)
    type_summary = compute_type_summary(normalized)
    matrix = compute_matrix(normalized)

    return {
        "project": {
            "name": _norm(project.get("name"), "LoGiT Project"),
            "context": _norm(project.get("context")),
            "icon": _norm(project.get("icon")),
        },
        "report": {
            "title": report_title,
            "period_start": period_start,
            "period_end": period_end,
            "generated_at": generated_at or datetime.now(),
        },
        "totals": {"observations": len(normalized)},
        "priority_summary": priority_summary,
        "type_summary": type_summary,
        "matrix": matrix,
        "category_breakdown": compute_category_breakdown(normalized),
        "executive_summary": _norm(executive_summary),
        "key_findings": key_findings or [],
        "talking_points": talking_points or [],
        "observations": normalized,
        "options": {
            "include_original_transcripts": include_original_transcripts,
        },
    }


def enrich_summary_percentages(report: dict) -> dict:
    """Attach percentage fields used by the PDF template."""
    total = report.get("totals", {}).get("observations", 0) or 0
    priority_summary = report.get("priority_summary") or {}
    type_summary = report.get("type_summary") or {}
    report["priority_summary_pct"] = {k: _pct(priority_summary.get(k, 0), total) for k in PRIORITY_KEYS}
    report["type_summary_pct"] = {k: _pct(type_summary.get(k, 0), total) for k in TYPE_KEYS}
    return report
