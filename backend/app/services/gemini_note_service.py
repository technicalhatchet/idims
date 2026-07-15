"""Gemini API — rewrite structured diagnostic facts into technician + customer prose."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import settings
from app.schemas.diagnostics_ai import GenerateDiagnosticNotesRequest

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

# Models with free-tier quota for new AI Studio projects (as of 2026).
# gemini-2.0-flash often reports limit: 0 on FreeTier for new keys.
DEFAULT_MODEL_FALLBACKS: Tuple[str, ...] = (
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.0-flash-lite",
)

MAX_RETRIES_PER_MODEL = 3
RETRY_BASE_SECONDS = 1.5

SYSTEM_INSTRUCTION = """You rewrite appliance diagnostic field notes for a service company.

STRICT RULES:
- Use ONLY facts present in the input JSON. Do not invent tests, readings, parts, or failures.
- Do NOT add new diagnoses, repair recommendations, or parts suggestions beyond what the input states.
- Do NOT mention customer names, addresses, phone numbers, or other PII.
- Write in clear technician language for technicianNote; plain homeowner language for customerExplanation.
- customerExplanation must avoid jargon (ohms, continuity, etc.) unless unavoidable.

Return valid JSON only with exactly these keys:
{
  "rootCauseSummary": "1-3 sentences summarizing what the recorded evidence points to",
  "technicianNote": "multi-paragraph service note with sections: Complaint, Testing Performed, Findings, Diagnosis (from facts only)",
  "customerExplanation": "short friendly paragraph explaining what was found in plain English"
}
"""


def _model_candidates() -> List[str]:
  """Ordered unique model list: env override first, then known-good fallbacks."""
  candidates: List[str] = []
  for model in (settings.GEMINI_MODEL, *DEFAULT_MODEL_FALLBACKS):
    name = (model or "").strip()
    if name and name not in candidates:
      candidates.append(name)
  return candidates


def _parse_json_response(text: str) -> Dict[str, str]:
  cleaned = text.strip()
  if cleaned.startswith("```"):
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
  data = json.loads(cleaned)
  return {
    "rootCauseSummary": str(data.get("rootCauseSummary", "")).strip(),
    "technicianNote": str(data.get("technicianNote", "")).strip(),
    "customerExplanation": str(data.get("customerExplanation", "")).strip(),
  }


def _build_user_prompt(facts: GenerateDiagnosticNotesRequest) -> str:
  payload = facts.model_dump(by_alias=True)
  return (
    "Rewrite the following diagnostic facts into the three JSON fields described.\n\n"
    f"{json.dumps(payload, indent=2)}"
  )


def _extract_api_error(response: httpx.Response) -> Tuple[str, str]:
  try:
    error = response.json().get("error", {})
    status = str(error.get("status") or response.status_code)
    message = str(error.get("message") or response.text or "Unknown Gemini error")
    return status, message
  except Exception:
    return str(response.status_code), response.text[:500]


def _is_zero_quota_error(message: str) -> bool:
  lowered = message.lower()
  return "limit: 0" in lowered or "free_tier" in lowered and "quota exceeded" in lowered


def _retry_delay_seconds(response: httpx.Response, attempt: int) -> float:
  retry_after = response.headers.get("retry-after")
  if retry_after:
    try:
      return max(float(retry_after), RETRY_BASE_SECONDS)
    except ValueError:
      pass
  return RETRY_BASE_SECONDS * (2 ** attempt)


async def _call_gemini_model(
  client: httpx.AsyncClient,
  model: str,
  facts: GenerateDiagnosticNotesRequest,
) -> Dict[str, str]:
  url = f"{GEMINI_API_BASE}/models/{model}:generateContent"
  body = {
    "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
    "contents": [{"role": "user", "parts": [{"text": _build_user_prompt(facts)}]}],
    "generationConfig": {
      "temperature": 0.3,
      "responseMimeType": "application/json",
    },
  }
  headers = {"x-goog-api-key": settings.GEMINI_API_KEY}

  last_status = ""
  last_message = ""

  for attempt in range(MAX_RETRIES_PER_MODEL):
    response = await client.post(url, headers=headers, json=body)
    if response.status_code == 200:
      data = response.json()
      candidates = data.get("candidates") or []
      parts = (candidates[0].get("content") or {}).get("parts") or []
      text = parts[0].get("text") if parts else ""
      if not text:
        raise ValueError("Empty Gemini response")
      return _parse_json_response(text)

    last_status, last_message = _extract_api_error(response)

    if response.status_code == 404:
      logger.info("Gemini model unavailable: %s — %s", model, last_message[:160])
      break

    if response.status_code == 429 and _is_zero_quota_error(last_message):
      logger.warning(
        "Gemini model %s has no free-tier quota on this project (limit: 0); trying next model",
        model,
      )
      break

    if response.status_code in (429, 503) and attempt < MAX_RETRIES_PER_MODEL - 1:
      delay = _retry_delay_seconds(response, attempt)
      logger.warning(
        "Gemini %s transient %s (attempt %s/%s); retrying in %.1fs",
        model,
        response.status_code,
        attempt + 1,
        MAX_RETRIES_PER_MODEL,
        delay,
      )
      await asyncio.sleep(delay)
      continue

    logger.warning(
      "Gemini model %s failed (%s): %s",
      model,
      last_status,
      last_message[:300],
    )
    break

  raise RuntimeError(f"{model}: {last_status} — {last_message[:300]}")


def build_deterministic_fallback(facts: GenerateDiagnosticNotesRequest) -> Dict[str, str]:
  """Local fallback when Gemini is unavailable."""
  bullets = facts.deterministic_bullets or facts.evidence_lines or []
  confirmed = [
    entry.label for entry in facts.component_states if entry.state == "confirmed"
  ]
  ruled_out = [
    entry.label for entry in facts.component_states if entry.state == "eliminated"
  ]

  root = "Diagnostic testing recorded."
  if confirmed:
    root = f"Recorded evidence supports {', '.join(confirmed)} as the fault path."
  elif facts.confidence and facts.confidence.explanation:
    root = facts.confidence.explanation

  tech_lines = ["Complaint:"]
  if facts.complaint_chips:
    tech_lines.append(", ".join(facts.complaint_chips))
  elif facts.complaint_text:
    tech_lines.append(facts.complaint_text)
  else:
    tech_lines.append("See work order complaint.")

  tech_lines.append("")
  tech_lines.append("Testing performed:")
  for line in facts.measurements + facts.observations:
    tech_lines.append(f"- {line}")
  if not facts.measurements and not facts.observations:
    for line in bullets[:8]:
      tech_lines.append(f"- {line}")

  tech_lines.append("")
  tech_lines.append("Findings:")
  if confirmed:
    tech_lines.append(f"- Confirmed: {', '.join(confirmed)}")
  if ruled_out:
    tech_lines.append(f"- Ruled out: {', '.join(ruled_out)}")
  for line in facts.evidence_lines[:5]:
    tech_lines.append(f"- {line}")

  customer = "We completed diagnostic testing on your appliance."
  if confirmed:
    customer = (
      f"Our testing found an issue with the {confirmed[0].lower()}. "
      "Other checks we performed tested normally."
    )
  elif facts.complaint_chips:
    customer = (
      f"You reported {facts.complaint_chips[0].lower()}. "
      "We documented our diagnostic testing and findings for your service record."
    )

  return {
    "rootCauseSummary": root,
    "technicianNote": "\n".join(tech_lines).strip(),
    "customerExplanation": customer,
  }


async def generate_diagnostic_notes(
  facts: GenerateDiagnosticNotesRequest,
) -> Dict[str, Any]:
  if not settings.GEMINI_ENABLED or not settings.GEMINI_API_KEY:
    return {
      **build_deterministic_fallback(facts),
      "source": "deterministic",
      "model": None,
      "fallbackReason": "Gemini disabled or API key not configured",
    }

  errors: List[str] = []
  async with httpx.AsyncClient(timeout=45.0) as client:
    for model in _model_candidates():
      try:
        parsed = await _call_gemini_model(client, model, facts)
        if model != (settings.GEMINI_MODEL or "").strip():
          logger.info(
            "Gemini succeeded with fallback model %s (configured: %s)",
            model,
            settings.GEMINI_MODEL,
          )
        return {**parsed, "source": "gemini", "model": model, "fallbackReason": None}
      except Exception as exc:
        errors.append(str(exc))
        continue

  combined = "; ".join(errors)[:500] if errors else "All Gemini models failed"
  logger.warning("Gemini note generation failed, using deterministic fallback: %s", combined)
  return {
    **build_deterministic_fallback(facts),
    "source": "deterministic",
    "model": settings.GEMINI_MODEL or DEFAULT_MODEL_FALLBACKS[0],
    "fallbackReason": combined,
  }
