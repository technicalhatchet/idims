"""Tenant portal access invites and listing (Wave 3)."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_login import ClientLogin
from app.models.client_login_property_access import ClientLoginPropertyAccess
from app.models.client_portal_claim import ClientPortalClaim
from app.models.property import Property
from app.services.portal_claim_service import create_portal_claim, send_portal_invite_email
from app.services.portal_member_invite_service import (
    PortalMemberInviteError,
    login_display_name,
    serialize_pending_invite,
)

logger = logging.getLogger(__name__)


def serialize_tenant_login(db: Session, login: ClientLogin) -> Dict[str, Any]:
    return {
        "id": str(login.id),
        "display_name": login_display_name(db, login),
        "email": login.invited_email,
        "phone": login.invited_phone,
        "role": login.role or "owner",
        "created_at": login.created_at.isoformat() if login.created_at else None,
    }


def list_property_tenant_access(
    db: Session,
    *,
    client: Client,
    property_id: UUID,
) -> Dict[str, Any]:
    prop = (
        db.query(Property)
        .filter(Property.id == property_id, Property.client_id == client.id)
        .first()
    )
    if not prop:
        raise PortalMemberInviteError("not_found", "Property not found.", status_code=404)

    tenant_logins = (
        db.query(ClientLogin)
        .join(
            ClientLoginPropertyAccess,
            ClientLogin.id == ClientLoginPropertyAccess.client_login_id,
        )
        .filter(
            ClientLogin.client_id == client.id,
            ClientLogin.revoked_at.is_(None),
            ClientLogin.role == "tenant",
            ClientLoginPropertyAccess.property_id == property_id,
        )
        .all()
    )

    from app.utils.datetime_utils import utcnow_naive

    now = utcnow_naive()
    pending_claims = (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.client_id == client.id,
            ClientPortalClaim.purpose == "portal_invite",
            ClientPortalClaim.used_at.is_(None),
            ClientPortalClaim.revoked_at.is_(None),
            ClientPortalClaim.expires_at > now,
        )
        .all()
    )
    pending = []
    for claim in pending_claims:
        meta = claim.claim_metadata or {}
        if str(meta.get("role") or "") != "tenant":
            continue
        if str(meta.get("property_id") or "") != str(property_id):
            continue
        pending.append(serialize_pending_invite(claim))

    return {
        "property_id": str(prop.id),
        "tenant_name": prop.tenant_name,
        "tenant_email": prop.tenant_email,
        "tenant_phone": prop.tenant_phone,
        "active_tenants": [serialize_tenant_login(db, row) for row in tenant_logins],
        "pending_invites": pending,
    }


async def create_property_tenant_invite(
    db: Session,
    *,
    client: Client,
    property_id: UUID,
    invited_email: str,
    invited_phone: Optional[str],
    display_name: Optional[str],
    actor: Any,
) -> Dict[str, Any]:
    prop = (
        db.query(Property)
        .filter(Property.id == property_id, Property.client_id == client.id)
        .first()
    )
    if not prop:
        raise PortalMemberInviteError("not_found", "Property not found.", status_code=404)

    email = (invited_email or prop.tenant_email or "").strip()
    if not email:
        raise PortalMemberInviteError(
            "email_required",
            "Tenant email is required to send an invite.",
        )
    phone = (invited_phone or prop.tenant_phone or "").strip() or None
    name = (display_name or prop.tenant_name or "").strip() or None

    metadata = {
        "role": "tenant",
        "property_id": str(property_id),
        **(actor.claim_metadata or {}),
    }
    claim, raw_token = create_portal_claim(
        db,
        client.id,
        metadata=metadata,
        invited_email=email,
        invited_phone=phone,
        display_name=name,
        invited_by_login_id=actor.invited_by_login_id,
        created_by_auth0_sub=actor.created_by_auth0_sub,
    )
    await send_portal_invite_email(db, claim=claim, raw_token=raw_token, client=client)
    db.flush()
    return serialize_pending_invite(claim)
