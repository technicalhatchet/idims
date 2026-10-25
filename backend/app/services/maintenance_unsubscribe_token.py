"""Signed tokens for maintenance email unsubscribe (no login)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional
from uuid import UUID

from app.config import settings

_TOKEN_TTL_SECONDS = 365 * 24 * 3600
_PURPOSE = "maintenance_unsubscribe"


def _secret() -> bytes:
    raw = (settings.PORTAL_INVITE_SECRET or settings.SECRET_KEY or "change-me-in-production").encode()
    return raw


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def create_maintenance_unsubscribe_token(client_id: UUID) -> str:
    payload = {
        "purpose": _PURPOSE,
        "client_id": str(client_id),
        "exp": int(time.time()) + _TOKEN_TTL_SECONDS,
    }
    body = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(_secret(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64url_encode(sig)}"


def verify_maintenance_unsubscribe_token(token: str) -> Optional[UUID]:
    if not token or "." not in token:
        return None
    body, sig_part = token.rsplit(".", 1)
    expected = hmac.new(_secret(), body.encode(), hashlib.sha256).digest()
    try:
        provided = _b64url_decode(sig_part)
    except Exception:
        return None
    if not hmac.compare_digest(expected, provided):
        return None
    try:
        payload: Dict[str, Any] = json.loads(_b64url_decode(body))
    except Exception:
        return None
    if payload.get("purpose") != _PURPOSE:
        return None
    if int(payload.get("exp") or 0) < int(time.time()):
        return None
    try:
        return UUID(str(payload["client_id"]))
    except Exception:
        return None
