"""Gemini classification for LoGiT field observations."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List

import httpx
from pydantic import ValidationError

from app.config import settings
from app.schemas.logit import LogitClassification, LogitType
from app.services.gemini_note_service import DEFAULT_MODEL_FALLBACKS, GEMINI_API_BASE

logger = logging.getLogger(__name__)

CLASSIFICATION_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
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
            "enum": ["once", "occasional", "frequent", "every_time", "unknown", "not_applicable"],
        },
        "title": {"type": "string"},
        "description": {"type": "string"},
        "impact": {"type": "string"},
        "suggested_fix": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": [
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

TYPE_LABELS = {
    "problem": "Problem — something isn't working",
    "idea": "Idea — something should change",
    "blocker": "Blocker — can't complete the task",
    "positive": "Good Stuff — they nailed it",
}

SYSTEM_INSTRUCTION = """You organize short field observations for software/product feedback capture.

The user has ALREADY selected the observation type. Do NOT change or guess the type.

RULES:
- Use ONLY information present in the user's transcript. Do not invent facts, frequency, or impact.
- Use frequency "unknown" when not stated.
- Use frequency "not_applicable" when frequency does not apply.
- Use frequency "every_time" when the user indicates it happens every time or always.
- Use severity "not_applicable" for ideas and positive feedback when priority does not apply.
- For problems and blockers, infer severity only when clearly implied; otherwise use minor.
- Clean up rambling language in title/description/impact/suggested_fix while preserving meaning.
- Do not copy profanity into polished fields.
- suggested_fix may be empty string when none is implied.
- confidence is 0.0–1.0 reflecting how certain the organization is.

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


def _build_user_prompt(
    project_name: str,
    project_context: str,
    observation_type: LogitType,
    transcript: str,
) -> str:
    type_label = TYPE_LABELS.get(observation_type, observation_type)
    return (
        f"Project: {project_name}\n\n"
        f"Project context:\n{project_context or '(none)'}\n\n"
        f"Selected observation type (fixed — do not change): {type_label}\n\n"
        f"User observation (verbatim — do not rewrite this block, only use it as source):\n"
        f'"""{transcript}"""\n\n'
        "Organize this observation for the active project and selected type."
    )


def _validate_classification(
    data: Dict[str, Any],
    observation_type: LogitType,
) -> LogitClassification:
    confidence = data.get("confidence", 0.5)
    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))
    if observation_type in ("idea", "positive") and data.get("severity") not in (
        "not_applicable",
        None,
        "",
    ):
        pass
    elif observation_type in ("idea", "positive"):
        data["severity"] = "not_applicable"
    payload = {**data, "confidence": confidence, "type": observation_type}
    return LogitClassification.model_validate(payload)


async def _call_gemini_model(
    client: httpx.AsyncClient,
    model: str,
    project_name: str,
    project_context: str,
    observation_type: LogitType,
    transcript: str,
) -> LogitClassification:
    url = f"{GEMINI_API_BASE}/models/{model}:generateContent"
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": [
            {
                "role": "user",
                "parts": [{
                    "text": _build_user_prompt(
                        project_name,
                        project_context,
                        observation_type,
                        transcript,
                    ),
                }],
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
    return _validate_classification(parsed, observation_type)


async def classify_logit_observation(
    project_name: str,
    project_context: str,
    transcript: str,
    observation_type: LogitType,
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
                    observation_type,
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
