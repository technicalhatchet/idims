"""Public feature flag resolution for the current caller."""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth import AuthHandler, get_auth_handler
from app.db.database import get_db
from app.services.feature_flags_service import (
    FeatureContext,
    admin_feature_flags_payload,
    feature_context_from_roles,
    list_enabled_features_for_context,
)

logger = logging.getLogger(__name__)

router = APIRouter()


async def _feature_context_from_request(
    request: Request,
    auth_handler: AuthHandler,
    db: Session,
) -> FeatureContext:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return FeatureContext()
    token = auth_header.split(" ", 1)[1].strip()
    try:
        token_data = await auth_handler.verify_token(token)
        roles = getattr(token_data, "roles", None) or []
        return feature_context_from_roles(roles)
    except Exception:
        logger.debug("features: could not resolve token roles", exc_info=True)
        return FeatureContext()


@router.get("")
async def get_enabled_features(
    request: Request,
    db: Session = Depends(get_db),
    auth_handler: AuthHandler = Depends(get_auth_handler),
):
    """Returns flag ids enabled for the current user (empty when unauthenticated)."""
    ctx = await _feature_context_from_request(request, auth_handler, db)
    features: List[str] = list_enabled_features_for_context(db, ctx)
    return {"features": features}


@router.get("/config")
async def get_feature_flags_admin_config(
    request: Request,
    db: Session = Depends(get_db),
    auth_handler: AuthHandler = Depends(get_auth_handler),
):
    """Full flag definitions + values (admin/manager only)."""
    ctx = await _feature_context_from_request(request, auth_handler, db)
    if not ctx.is_admin_or_preview:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return admin_feature_flags_payload(db)
