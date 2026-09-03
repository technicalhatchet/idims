"""Assemble and render LoGiT project observation report PDFs."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.logit import LogitEntry, LogitProject
from app.services.gemini_logit_report_service import synthesize_logit_report_narrative
from app.services.logit_pdf_data import (
    PRIORITY_KEYS,
    TYPE_KEYS,
    TYPE_LABELS,
    build_logit_report_dict,
    normalize_observation,
)
from pdf.logit_template_v2 import build_logit_pdf_v2

logger = logging.getLogger(__name__)

PdfVariant = str


def _slugify_filename(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", (value or "logit-report").strip().lower()).strip("-")
    return slug[:60] or "logit-report"


def _entry_to_dict(entry: LogitEntry) -> dict:
    return {
        "id": str(entry.id),
        "type": entry.type,
        "category": entry.category,
        "severity": entry.severity,
        "frequency": entry.frequency,
        "title": entry.title,
        "description": entry.description,
        "impact": entry.impact,
        "suggested_fix": entry.suggested_fix,
        "original_transcript": entry.original_transcript,
        "created_at": entry.created_at,
    }


def _severity_rank(value: str) -> int:
    order = {"critical": 0, "major": 1, "moderate": 2, "minor": 3, "not_applicable": 4}
    return order.get((value or "").lower(), 5)


def _build_fallback_narrative(project_name: str, observations: List[dict]) -> Dict[str, Any]:
    total = len(observations)
    by_type = {key: sum(1 for o in observations if o.get("type") == key) for key in TYPE_KEYS}
    by_priority = {key: sum(1 for o in observations if o.get("priority") == key) for key in PRIORITY_KEYS}

    top_themes: List[str] = []
    for key in TYPE_KEYS:
        if by_type[key]:
            top_themes.append(f"{by_type[key]} {TYPE_LABELS[key].lower()}")
    theme_text = ", ".join(top_themes) if top_themes else "mixed feedback"

    executive_summary = (
        f"LoGiT captured {total} logged observation{'s' if total != 1 else ''} for {project_name}. "
        f"The report includes {theme_text}. "
        "Review the matrix and observation log for supporting detail."
    )

    sorted_obs = sorted(observations, key=lambda o: _severity_rank(o.get("priority", "moderate")))
    key_findings: List[dict] = []
    used_types = set()
    for obs in sorted_obs:
        obs_type = obs.get("type", "problem")
        if obs_type in used_types:
            continue
        priority = obs.get("priority", "moderate")
        if obs_type == "positive":
            priority = "positive"
        key_findings.append({
            "type": obs_type,
            "priority": priority,
            "title": obs.get("title") or "Observation theme",
            "summary": (obs.get("description") or obs.get("impact") or "")[:220],
        })
        used_types.add(obs_type)
        if len(key_findings) >= 4:
            break

    talking_points: List[dict] = []
    for obs in sorted_obs[:4]:
        priority = obs.get("priority", "moderate")
        if priority not in PRIORITY_KEYS:
            priority = "moderate"
        talking_points.append({
            "priority": priority,
            "title": obs.get("title") or "Follow up on field feedback",
            "body": (obs.get("impact") or obs.get("description") or "")[:220],
        })

    return {
        "executive_summary": executive_summary,
        "key_findings": key_findings,
        "talking_points": talking_points,
        "source": "computed",
    }


async def generate_logit_project_report_pdf(
    db: Session,
    project_id: UUID,
    user_id: UUID,
    *,
    variant: PdfVariant = "light",
    include_original_transcripts: bool = False,
) -> Tuple[bytes, str]:
    """Build PDF bytes and a suggested download filename for a LoGiT project."""
    project = (
        db.query(LogitProject)
        .filter(LogitProject.id == project_id, LogitProject.user_id == user_id)
        .first()
    )
    if not project:
        raise ValueError("Project not found")

    entries = (
        db.query(LogitEntry)
        .filter(
            LogitEntry.project_id == project_id,
            LogitEntry.user_id == user_id,
            LogitEntry.status == "logged",
        )
        .order_by(LogitEntry.created_at.asc())
        .all()
    )
    if not entries:
        raise ValueError("No logged observations to export")

    observations = [normalize_observation(_entry_to_dict(entry)) for entry in entries]
    period_start = entries[0].created_at
    period_end = entries[-1].created_at
    generated_at = datetime.utcnow()

    narrative: Dict[str, Any]
    try:
        narrative = await synthesize_logit_report_narrative(
            project.name,
            project.context or "",
            observations,
        )
    except Exception as exc:
        logger.warning("LoGiT report narrative fallback after Gemini failure: %s", exc)
        narrative = _build_fallback_narrative(project.name, observations)

    report = build_logit_report_dict(
        project={
            "name": project.name,
            "context": project.context,
            "icon": project.icon,
        },
        observations=observations,
        executive_summary=narrative.get("executive_summary", ""),
        key_findings=narrative.get("key_findings") or [],
        talking_points=narrative.get("talking_points") or [],
        report_title="Field Observation Report",
        period_start=period_start,
        period_end=period_end,
        generated_at=generated_at,
        include_original_transcripts=include_original_transcripts,
    )

    pdf_bytes = build_logit_pdf_v2(
        report,
        variant=variant,
        include_original_transcripts=include_original_transcripts,
    )
    filename = f"logit-report-{_slugify_filename(project.name)}.pdf"
    return pdf_bytes, filename
