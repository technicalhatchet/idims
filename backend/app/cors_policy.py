"""CORS allowlist for the FastAPI API (browser clients on multiple Vercel/custom domains)."""

from __future__ import annotations

import os
import re
from typing import Dict, List, Optional

from fastapi import Request

from app.config import settings

# Solomon / IDIMS / local dev — extend via FRONTEND_URL and CORS_EXTRA_ORIGINS.
CORS_ALLOWED_ORIGINS: List[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    f"https://{settings.AUTH0_DOMAIN}" if settings.AUTH0_DOMAIN else "",
    "https://v0-idims.vercel.app",
    "https://dma-eight.vercel.app",
    "https://atomicrepair419.com",
    "https://www.atomicrepair419.com",
    "https://solodiag.com",
    "https://www.solodiag.com",
]

CORS_ALLOWED_ORIGINS = [o for o in CORS_ALLOWED_ORIGINS if o]

_frontend_origin = (settings.FRONTEND_URL or "").strip().rstrip("/")
if _frontend_origin and _frontend_origin not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(_frontend_origin)

_extra_origins = os.getenv("CORS_EXTRA_ORIGINS", "")
for _part in _extra_origins.split(","):
    _origin = _part.strip().rstrip("/")
    if _origin and _origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(_origin)

CORS_ORIGIN_REGEX = r"https://.*\.vercel\.app"
_VERCEL_ORIGIN_RE = re.compile(r"^https://([a-z0-9-]+\.)*vercel\.app$", re.I)


def origin_is_allowed(origin: Optional[str]) -> bool:
    if not origin:
        return False
    normalized = origin.strip().rstrip("/")
    if normalized in CORS_ALLOWED_ORIGINS:
        return True
    return _VERCEL_ORIGIN_RE.match(normalized) is not None


def cors_headers_for_request(request: Request) -> Dict[str, str]:
    origin = request.headers.get("Origin")
    if origin_is_allowed(origin):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}
