"""Gemini synthesis for LoGiT field observation report narratives."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Sequence

import httpx

from app.config import settings
from app.services.gemini_logit_service import TYPE_LABELS, _model_candidates, _parse_json_response
from app.services.gemini_note_service import GEMINI_API_BASE
from app.services.logit_pdf_data import PRIORITY_LABELS, CATEGORY_LABELS

logger = logging.getLogger(__name__)

REPORT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "executive_summary": {"type": "string"},
        "key_findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["problem", "idea", "blocker", "positive"],
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["critical", "major", "moderate", "minor", "positive"],
                    },
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                },
                "required": ["type", "priority", "title", "summary"],
            },
        },
        "talking_points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "priority": {
                        "type": "string",
                        "enum": ["critical", "major", "moderate", "minor"],
                    },
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["priority", "title", "body"],
            },
        },
    },
    "required": ["executive_summary", "key_findings", "talking_points"],
}

SYSTEM_INSTRUCTION = """You write executive summaries for field observation reports.

RULES:
- Use ONLY patterns supported by the observations provided. Do not invent incidents or metrics.
- Write for a product/engineering leadership audience: clear, professional, no profanity.
- executive_summary: 2–4 sentences covering volume, dominant themes, and overall tone.
- key_findings: exactly 4 items when possible — one per type (problem, blocker, idea, positive).
  Use priority "positive" for Good Stuff findings. Summarize themes, not single anecdotes.
- talking_points: 3–5 concise bullets for a stakeholder meeting (title + one sentence body).
- Map severity critical/major/moderate/minor to talking point priority.
- Keep titles short; summaries and bodies should be one or two sentences each.

Return JSON matching the schema exactly."""


def _observation_lines(observations: Sequence[dict], limit: int = 60) -> str:
    lines: List[str] = []
    for obs in observations[:limit]:
        obs_type = obs.get("type", "problem")
        priority = obs.get("priority") or obs.get("severity") or "moderate"
        category = CATEGORY_LABELS.get(obs.get("category", ""), obs.get("category", "other"))
        title = obs.get("title") or "Untitled"
        description = (obs.get("description") or "")[:280]
        lines.append(
            f"- [{TYPE_LABELS.get(obs_type, obs_type)} | {PRIORITY_LABELS.get(priority, priority)} | {category}] "
            f"{title}: {description}"
        )
    if len(observations) > limit:
        lines.append(f"... and {len(observations) - limit} more observations omitted from prompt.")
    return "\n".join(lines)


def _build_user_prompt(project_name: str, project_context: str, observations: Sequence[dict]) -> str:
    return (
        f"Project: {project_name}\n\n"
        f"Project context:\n{project_context or '(none)'}\n\n"
        f"Logged observations ({len(observations)} total):\n"
        f"{_observation_lines(observations)}\n\n"
        "Synthesize the executive summary, key findings, and suggested talking points."
    )


def _sanitize_narrative(data: Dict[str, Any]) -> Dict[str, Any]:
    key_findings = data.get("key_findings") or []
    talking_points = data.get("talking_points") or []
    return {
        "executive_summary": str(data.get("executive_summary", "")).strip(),
        "key_findings": key_findings[:4],
        "talking_points": talking_points[:5],
    }


async def _call_gemini_model(
    client: httpx.AsyncClient,
    model: str,
    project_name: str,
    project_context: str,
    observations: Sequence[dict],
) -> Dict[str, Any]:
    url = f"{GEMINI_API_BASE}/models/{model}:generateContent"
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": [
            {
                "role": "user",
                "parts": [{
                    "text": _build_user_prompt(project_name, project_context, observations),
                }],
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json",
            "responseSchema": REPORT_SCHEMA,
        },
    }
    headers = {"x-goog-api-key": settings.GEMINI_API_KEY}
    response = await client.post(url, headers=headers, json=body)
    if response.status_code != 200:
        raise RuntimeError(f"Gemini HTTP {response.status_code}")

    payload = response.json()
    candidates = payload.get("candidates") or []
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = parts[0].get("text") if parts else ""
    if not text:
        raise ValueError("Empty Gemini response")

    parsed = _parse_json_response(text)
    return _sanitize_narrative(parsed)


async def synthesize_logit_report_narrative(
    project_name: str,
    project_context: str,
    observations: Sequence[dict],
) -> Dict[str, Any]:
    if not settings.GEMINI_ENABLED or not settings.GEMINI_API_KEY:
        raise RuntimeError("Gemini is not configured")

    errors: List[str] = []
    async with httpx.AsyncClient(timeout=90.0) as client:
        for model in _model_candidates():
            try:
                narrative = await _call_gemini_model(
                    client,
                    model,
                    project_name,
                    project_context,
                    observations,
                )
                return {**narrative, "model": model, "source": "gemini"}
            except Exception as exc:
                errors.append(f"{model}: {exc}")
                continue

    combined = "; ".join(errors)[:500] if errors else "All Gemini models failed"
    raise RuntimeError(combined)
