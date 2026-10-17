"""DB-backed portal claim links (single-use registration / email change)."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote
from uuid import UUID

from sqlalchemy.orm import Session

from app.frontend_site_urls import build_frontend_url
from app.models.client import Client
from app.models.client_portal_claim import ClientPortalClaim
from app.utils.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

PURPOSE_PORTAL_INVITE = "portal_invite"
PURPOSE_EMAIL_CHANGE = "email_change"  # reserved for phase 2e (not staff-created in 2b)
DEFAULT_TTL_DAYS = 7
MIN_TTL_DAYS = 1
MAX_TTL_DAYS = 30


def clamp_ttl_days(ttl_days: int) -> int:
    return max(MIN_TTL_DAYS, min(MAX_TTL_DAYS, int(ttl_days)))


class PortalClaimError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def hash_claim_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_claim_token() -> str:
    return secrets.token_urlsafe(32)


def build_claim_register_url(raw_token: str) -> str:
    return f"{build_frontend_url('/cxdashboard/register')}?claim={quote(raw_token, safe='')}"


def _staff_user_id(db: Session, auth0_sub: Optional[str]) -> Optional[UUID]:
    if not auth0_sub:
        return None
    from app.models.user import User

    row = db.query(User).filter(User.auth_id == auth0_sub).first()
    return row.id if row else None


def revoke_unused_portal_invite_claims(
    db: Session,
    client_id: UUID,
    *,
    except_claim_id: Optional[UUID] = None,
) -> int:
    """Revoke other active portal_invite claims for this client (single active invite)."""
    now = utcnow_naive()
    q = db.query(ClientPortalClaim).filter(
        ClientPortalClaim.client_id == client_id,
        ClientPortalClaim.purpose == PURPOSE_PORTAL_INVITE,
        ClientPortalClaim.used_at.is_(None),
        ClientPortalClaim.revoked_at.is_(None),
        ClientPortalClaim.expires_at > now,
    )
    if except_claim_id is not None:
        q = q.filter(ClientPortalClaim.id != except_claim_id)
    claims = q.all()
    for claim in claims:
        claim.revoked_at = now
    if claims:
        logger.info(
            "Revoked %s prior portal_invite claim(s) for client_id=%s",
            len(claims),
            client_id,
        )
    return len(claims)


def create_portal_claim(
    db: Session,
    client_id: UUID,
    *,
    purpose: str = PURPOSE_PORTAL_INVITE,
    created_by_auth0_sub: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ttl_days: int = DEFAULT_TTL_DAYS,
) -> Tuple[ClientPortalClaim, str]:
    ttl_days = clamp_ttl_days(ttl_days)
    if purpose == PURPOSE_PORTAL_INVITE:
        revoke_unused_portal_invite_claims(db, client_id)
    raw_token = generate_claim_token()
    now = utcnow_naive()
    claim = ClientPortalClaim(
        client_id=client_id,
        token_hash=hash_claim_token(raw_token),
        purpose=purpose,
        expires_at=now + timedelta(days=ttl_days),
        created_by=_staff_user_id(db, created_by_auth0_sub),
        claim_metadata=metadata,
    )
    db.add(claim)
    db.flush()
    logger.info("Created portal claim id=%s client_id=%s purpose=%s", claim.id, client_id, purpose)
    return claim, raw_token


def _load_claim_by_token(db: Session, raw_token: str) -> Optional[ClientPortalClaim]:
    if not raw_token or not raw_token.strip():
        return None
    token_hash = hash_claim_token(raw_token.strip())
    return db.query(ClientPortalClaim).filter(ClientPortalClaim.token_hash == token_hash).first()


def _assert_claim_usable(claim: ClientPortalClaim) -> None:
    now = utcnow_naive()
    if claim.revoked_at:
        raise PortalClaimError("revoked", "This link has been revoked.")
    if claim.used_at:
        raise PortalClaimError("used", "This link has already been used.")
    expires = claim.expires_at
    if expires and expires.tzinfo is not None:
        expires = expires.replace(tzinfo=None)
    if expires and now > expires:
        raise PortalClaimError("expired", "This invite link has expired. Please contact Atomic Repair for a new one.")


def client_preview_from_client(client: Client) -> Dict[str, Any]:
    return {
        "id": str(client.id),
        "first_name": client.first_name,
        "last_name": client.last_name,
        "company_name": client.company_name,
        "email": client.email,
    }


def validate_claim_for_register(db: Session, raw_token: str) -> Dict[str, Any]:
    claim = _load_claim_by_token(db, raw_token)
    if not claim:
        return {"valid": False, "message": "This invite link is invalid."}
    try:
        _assert_claim_usable(claim)
    except PortalClaimError as exc:
        return {"valid": False, "message": exc.message}
    client = db.query(Client).filter(Client.id == claim.client_id).first()
    if not client:
        return {"valid": False, "message": "This invite link is invalid."}
    return {
        "valid": True,
        "token_type": "claim",
        "purpose": claim.purpose,
        "client": client_preview_from_client(client),
    }


def resolve_client_for_link(
    db: Session,
    raw_token: str,
) -> Tuple[Client, ClientPortalClaim]:
    if not raw_token or not raw_token.strip():
        raise PortalClaimError("invalid", "claim token invalid")
    token_hash = hash_claim_token(raw_token.strip())
    claim = (
        db.query(ClientPortalClaim)
        .filter(ClientPortalClaim.token_hash == token_hash)
        .with_for_update()
        .first()
    )
    if not claim:
        raise PortalClaimError("invalid", "claim token invalid")
    _assert_claim_usable(claim)
    client = db.query(Client).filter(Client.id == claim.client_id).first()
    if not client:
        raise PortalClaimError("invalid", "client not found for claim")
    return client, claim


def mark_claim_used(db: Session, claim: ClientPortalClaim) -> None:
    if not claim.used_at:
        claim.used_at = utcnow_naive()
    logger.info("Consumed portal claim id=%s client_id=%s", claim.id, claim.client_id)


def looks_like_jwt_invite(token: str) -> bool:
    return token.count(".") == 2


def send_portal_invite_email(client: Client, invite_url: str) -> None:
    """Send Resend HTML invite (same template as legacy JWT invite)."""
    from fastapi import HTTPException
    import httpx

    from app.config import settings

    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;padding:2rem;border-radius:12px;">
      <img src="{settings.LOGO_URL}" alt="Atomic Repair" style="height:40px;margin-bottom:1.5rem;" />
      <h2 style="color:#fff;">You&apos;re invited to the Atomic Repair Client Portal</h2>
      <p style="color:#9ca3af;">Hi {client.first_name},</p>
      <p style="color:#9ca3af;">You can now access your service history, upcoming appointments, and invoices online.</p>
      <a href="{invite_url}" style="display:inline-block;background:#00D4FF;color:#0A0F1E;padding:0.875rem 2rem;border-radius:8px;font-weight:700;text-decoration:none;margin:1.5rem 0;">
        Create My Account
      </a>
      <p style="color:#6b7280;font-size:0.75rem;">This link expires in 7 days. If you didn&apos;t expect this email, you can ignore it.</p>
    </div>
    """

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": "Atomic Repair <service@atomicrepair419.com>",
            "to": client.email,
            "subject": "Your Atomic Repair Client Portal Invite",
            "html": html,
        },
        timeout=30.0,
    )
    if response.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to send invite email")
