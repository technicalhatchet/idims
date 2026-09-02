"""Gemini classification for LoGiT field observations."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

import httpx
from pydantic import ValidationError

from app.config import settings
from app.schemas.logit import LogitClassification
from app.services.gemini_note_service import DEFAULT_MODEL_FALLBACKS, GEMINI_API_BASE

logger = logging.getLogger(__name__)

CLASSIFICATION_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": ["problem", "idea", "blocker", "positive"]},
        "category": {
            "type": "string",
            "enum": [
                "scheduling",
                "job_details",
                "diagnostics",
                "parts",
                "documentation",
                "photos",
                "customer",
                "performance",
                "ui_ux",
                "other",
            ],
        },
        "severity": {
            "type": "string",
            "enum": ["minor", "moderate", "major", "critical", "not_applicable"],
        },
        "frequency": {
            "type": "string",
            "enum": ["once", "occasional", "frequent", "unknown"],
        },
        "title": {"type": "string"},
        "description": {"type": "string"},
        "impact": {"type": "string"},
        "suggested_fix": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": [
        "type",
        "category",
        "severity",
        "frequency",
        "title",
        "description",
        "impact",
        "suggested_fix",
        "confidence",
    ],
}

SYSTEM_INSTRUCTION = """You classify short field observations for software/product feedback capture.

RULES:
- Use ONLY information present in the user's transcript. Do not invent facts, frequency, or impact.
- Use frequency "unknown" when not stated.
- Use severity "not_applicable" for ideas/positive feedback when severity does not apply.
- Clean up rambling language in title/description/impact/suggested_fix while preserving meaning.
- Do not copy profanity into polished fields.
- suggested_fix may be empty string when none is implied.
- confidence is 0.0–1.0 reflecting how certain the classification is.

Return JSON matching the provided schema exactly."""


def _model_candidates() -> List[str]:
    candidates: List[str] = []
    for model in (settings.GEMINI_MODEL, *DEFAULT_MODEL_FALLBACKS):
        name = (model or "").strip()
        if name and name not in candidates:
            candidates.append(name)
    return candidates


def _parse_json_response(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def _build_user_prompt(project_name: str, project_context: str, transcript: str) -> str:
    return (
        f"Project: {project_name}\n\n"
        f"Project context:\n{project_context or '(none)'}\n\n"
        f"User observation (verbatim — do not rewrite this block, only use it as source):\n"
        f'"""{transcript}"""\n\n'
        "Classify this observation for the active project."
    )


def _validate_classification(data: Dict[str, Any]) -> LogitClassification:
    confidence = data.get("confidence", 0.5)
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))
    data = {**data, "confidence": confidence}
    return LogitClassification.model_validate(data)


async def _call_gemini_model(
    client: httpx.AsyncClient,
    model: str,
    project_name: str,
    project_context: str,
    transcript: str,
) -> LogitClassification:
    url = f"{GEMINI_API_BASE}/models/{model}:generateContent"
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": [
            {
                "role": "user",
                "parts": [{"text": _build_user_prompt(project_name, project_context, transcript)}],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseSchema": CLASSIFICATION_SCHEMA,
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
    return _validate_classification(parsed)


async def classify_logit_observation(
    project_name: str,
    project_context: str,
    transcript: str,
) -> Dict[str, Any]:
    if not settings.GEMINI_ENABLED or not settings.GEMINI_API_KEY:
        raise RuntimeError("Gemini is not configured")

    errors: List[str] = []
    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in _model_candidates():
            try:
                classification = await _call_gemini_model(
                    client,
                    model,
                    project_name,
                    project_context,
                    transcript,
                )
                return {
                    "classification": classification,
                    "model": model,
                    "source": "gemini",
                }
            except ValidationError as exc:
                errors.append(f"{model}: validation — {exc}")
            except Exception as exc:
                errors.append(f"{model}: {exc}")
                continue

    combined = "; ".join(errors)[:500] if errors else "All Gemini models failed"
    raise RuntimeError(combined)
