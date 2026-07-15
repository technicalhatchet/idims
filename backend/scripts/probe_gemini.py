"""One-off Gemini connectivity probe (does not print API key)."""
from __future__ import annotations

import asyncio
import json

import httpx

from app.config import settings


async def list_models(client: httpx.AsyncClient) -> None:
    r = await client.get(
        "https://generativelanguage.googleapis.com/v1beta/models",
        headers={"x-goog-api-key": settings.GEMINI_API_KEY},
    )
    print("list_models status=", r.status_code)
    if r.status_code != 200:
        print(_error_summary(r))
        return
    names = [
        m.get("name", "")
        for m in r.json().get("models", [])
        if "generateContent" in (m.get("supportedGenerationMethods") or [])
    ]
    flash = [n for n in names if "flash" in n.lower()][:10]
    print("flash_models:", flash)


def _error_summary(response: httpx.Response) -> str:
    try:
        err = response.json().get("error", {})
        return json.dumps(
            {
                "status": err.get("status"),
                "message": (err.get("message") or "")[:400],
                "details": err.get("details", [])[:2],
            },
            indent=2,
        )
    except Exception:
        return response.text[:400]


async def probe_model(client: httpx.AsyncClient, model: str) -> None:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": 'Reply with JSON only: {"ok": true}'}],
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "maxOutputTokens": 32},
    }
    r = await client.post(
        url,
        headers={"x-goog-api-key": settings.GEMINI_API_KEY},
        json=body,
    )
    print(f"--- {model} status={r.status_code}")
    if r.status_code == 200:
        text = (
            r.json()
            .get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        print("ok_text:", text[:120])
    else:
        print(_error_summary(r))


async def main() -> None:
    key = settings.GEMINI_API_KEY
    print("enabled:", settings.GEMINI_ENABLED)
    print("model:", settings.GEMINI_MODEL)
    print("key_len:", len(key))
    print("key_prefix:", key[:4] if key else "(empty)")

    async with httpx.AsyncClient(timeout=30.0) as client:
        await list_models(client)
        for model in (
            "gemini-2.0-flash",
            "gemini-2.0-flash-001",
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash-lite-001",
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
        ):
            await probe_model(client, model)


if __name__ == "__main__":
    asyncio.run(main())
