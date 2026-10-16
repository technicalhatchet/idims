"""Admin portal preview: locked writes unless short-lived unlock JWT is presented."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import HTTPException, Request

from app.config import get_portal_invite_secret

logger = logging.getLogger(__name__)

PREVIEW_UNLOCK_HEADER = "X-Portal-Preview-Unlock"
PREVIEW_LOCKED_DETAIL = "Preview is locked"
PREVIEW_PAYMENT_FORBIDDEN_DETAIL = "Payments are not available in admin preview"
PREVIEW_UNLOCK_TTL_MINUTES = 15
PREVIEW_UNLOCK_AUDIENCE = "portal_preview_unlock"


def _preview_unlock_secret() -> str:
    secret = get_portal_invite_secret()
    if not secret:
        raise HTTPException(status_code=500, detail="Preview unlock is not configured on the server")
    return secret


def create_preview_unlock_token(admin_sub: str, client_id: uuid.UUID) -> str:
    now = datetime.utcnow()
    payload = {
        "aud": PREVIEW_UNLOCK_AUDIENCE,
        "sub": admin_sub,
        "client_id": str(client_id),
        "iat": now,
        "exp": now + timedelta(minutes=PREVIEW_UNLOCK_TTL_MINUTES),
    }
    return jwt.encode(payload, _preview_unlock_secret(), algorithm="HS256")


def verify_preview_unlock_token(
    token: Optional[str],
    admin_sub: str,
    client_id: uuid.UUID,
) -> bool:
    if not token or not admin_sub:
        return False
    try:
        payload = jwt.decode(
            token,
            _preview_unlock_secret(),
            algorithms=["HS256"],
            audience=PREVIEW_UNLOCK_AUDIENCE,
        )
    except jwt.PyJWTError:
        return False
    if payload.get("sub") != admin_sub:
        return False
    if str(payload.get("client_id")) != str(client_id):
        return False
    return True


def is_admin_preview(token_roles: Optional[list], admin_client_id: Optional[str]) -> bool:
    roles = token_roles or []
    return "admin" in roles and bool(admin_client_id)


def assert_portal_write_allowed(
    *,
    request: Request,
    token_roles: Optional[list],
    admin_sub: Optional[str],
    admin_client_id: Optional[str],
    client_id: uuid.UUID,
    route: str,
    block_payment: bool = False,
) -> None:
    """Raise 403 if an admin preview write is not allowed."""
    if not is_admin_preview(token_roles, admin_client_id):
        return

    if block_payment:
        raise HTTPException(status_code=403, detail=PREVIEW_PAYMENT_FORBIDDEN_DETAIL)

    unlock_header = request.headers.get(PREVIEW_UNLOCK_HEADER)
    if not verify_preview_unlock_token(unlock_header, admin_sub or "", client_id):
        raise HTTPException(status_code=403, detail=PREVIEW_LOCKED_DETAIL)

    logger.info(
        "[PREVIEW_EDIT] admin_sub=%s client_id=%s route=%s time=%s",
        admin_sub,
        client_id,
        route,
        datetime.utcnow().isoformat() + "Z",
    )
