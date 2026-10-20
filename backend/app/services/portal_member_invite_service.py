"""Customer-initiated portal invites and self-leave (phase 2g add-on)."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_login import ClientLogin
from app.models.client_portal_claim import ClientPortalClaim
from app.models.user import User as DBUser
from app.services.portal_account_linking import normalize_email
from app.services.portal_claim_service import PURPOSE_PORTAL_INVITE
from app.services.portal_login_service import get_active_login_for_sub
from app.services.portal_preview_guard import is_admin_preview
from app.utils.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

CUSTOMER_INVITES_PER_24H = 5
RATE_LIMIT_MESSAGE = (
    "You can send up to 5 invites per day for this account. "
    "Try again tomorrow or call Atomic Repair for help."
)


class PortalInviteActor:
    """Who initiated a portal household invite (customer login or admin preview)."""

    def __init__(
        self,
        *,
        invited_by_login_id: Optional[UUID],
        login: Optional[ClientLogin],
        claim_metadata: Dict[str, Any],
        notify_admins_on_invite: bool,
        created_by_auth0_sub: Optional[str],
    ):
        self.invited_by_login_id = invited_by_login_id
        self.login = login
        self.claim_metadata = claim_metadata
        self.notify_admins_on_invite = notify_admins_on_invite
        self.created_by_auth0_sub = created_by_auth0_sub


def resolve_portal_invite_actor(
    db: Session,
    *,
    token_sub: str,
    token_roles: Optional[List[str]],
    admin_client_id: Optional[str],
    client: Client,
) -> PortalInviteActor:
    """
    Customer sessions attribute invites to client_login; admin preview uses staff metadata only.
    """
    roles = token_roles or []
    if is_admin_preview(roles, admin_client_id):
        user = db.query(DBUser).filter(DBUser.auth_id == token_sub).first()
        staff_name = user.full_name if user else token_sub
        staff_id = str(user.id) if user else None
        return PortalInviteActor(
            invited_by_login_id=None,
            login=None,
            claim_metadata={
                "invited_by": "staff_preview",
                "invited_by_staff": {
                    "user_id": staff_id,
                    "name": staff_name,
                    "auth0_sub": token_sub,
                },
            },
            notify_admins_on_invite=False,
            created_by_auth0_sub=token_sub,
        )

    login = get_active_login_for_sub(db, token_sub)
    if not login or login.client_id != client.id:
        raise PortalMemberInviteError(
            "login_required",
            "Active portal login required.",
            status_code=403,
        )
    return PortalInviteActor(
        invited_by_login_id=login.id,
        login=login,
        claim_metadata={"invited_by": "customer"},
        notify_admins_on_invite=True,
        created_by_auth0_sub=None,
    )


class PortalMemberInviteError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def login_display_name(db: Session, login: ClientLogin) -> str:
    if login.display_name and login.display_name.strip():
        return login.display_name.strip()
    if login.user_id:
        user = db.query(DBUser).filter(DBUser.id == login.user_id).first()
        if user:
            name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            if name:
                return name
            if user.email:
                return user.email
    if login.invited_email:
        return login.invited_email
    return "A household member"


def client_display_label(client: Client) -> str:
    name = f"{client.first_name or ''} {client.last_name or ''}".strip()
    if name:
        return name
    if client.company_name:
        return client.company_name
    if client.email:
        return client.email
    return "this account"


def list_pending_portal_invites(db: Session, client_id: UUID) -> List[ClientPortalClaim]:
    now = utcnow_naive()
    return (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.client_id == client_id,
            ClientPortalClaim.purpose == PURPOSE_PORTAL_INVITE,
            ClientPortalClaim.used_at.is_(None),
            ClientPortalClaim.revoked_at.is_(None),
            ClientPortalClaim.expires_at > now,
        )
        .order_by(ClientPortalClaim.created_at.desc())
        .all()
    )


def serialize_pending_invite(claim: ClientPortalClaim) -> Dict[str, Any]:
    return {
        "id": str(claim.id),
        "display_name": claim.display_name,
        "invited_email": claim.invited_email,
        "expires_at": claim.expires_at.isoformat() if claim.expires_at else None,
        "created_at": claim.created_at.isoformat() if claim.created_at else None,
        "invited_by_customer": claim.invited_by_login_id is not None,
    }


def count_customer_invites_last_24h(db: Session, client_id: UUID) -> int:
    since = utcnow_naive() - timedelta(hours=24)
    return (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.client_id == client_id,
            ClientPortalClaim.purpose == PURPOSE_PORTAL_INVITE,
            ClientPortalClaim.invited_by_login_id.isnot(None),
            ClientPortalClaim.created_at >= since,
        )
        .count()
    )


def email_has_active_login_on_client(
    db: Session,
    client_id: UUID,
    email: str,
) -> bool:
    normalized = normalize_email(email)
    if not normalized:
        return False
    logins = (
        db.query(ClientLogin)
        .filter(
            ClientLogin.client_id == client_id,
            ClientLogin.revoked_at.is_(None),
        )
        .all()
    )
    for login in logins:
        if login.invited_email and normalize_email(login.invited_email) == normalized:
            return True
        if login.user_id:
            user = db.query(DBUser).filter(DBUser.id == login.user_id).first()
            if user and user.email and normalize_email(user.email) == normalized:
                return True
    return False


def assert_can_create_customer_invite(
    db: Session,
    client_id: UUID,
    email: str,
) -> str:
    normalized = normalize_email(email)
    if not normalized:
        raise PortalMemberInviteError("email_required", "A valid email address is required.")
    if count_customer_invites_last_24h(db, client_id) >= CUSTOMER_INVITES_PER_24H:
        raise PortalMemberInviteError(
            "rate_limit",
            RATE_LIMIT_MESSAGE,
            status_code=429,
        )
    if email_has_active_login_on_client(db, client_id, normalized):
        raise PortalMemberInviteError(
            "already_member",
            "That email already has access to this account.",
        )
    return normalized


def get_pending_invite_for_client(
    db: Session,
    client_id: UUID,
    claim_id: UUID,
) -> Optional[ClientPortalClaim]:
    now = utcnow_naive()
    return (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.id == claim_id,
            ClientPortalClaim.client_id == client_id,
            ClientPortalClaim.purpose == PURPOSE_PORTAL_INVITE,
            ClientPortalClaim.used_at.is_(None),
            ClientPortalClaim.revoked_at.is_(None),
            ClientPortalClaim.expires_at > now,
        )
        .first()
    )


async def notify_admins_portal_access_event(
    db: Session,
    *,
    message: str,
    client_id: UUID,
    event: str,
) -> None:
    from app.services.notification_service import NotificationService

    admins = db.query(DBUser).filter(DBUser.is_active.is_(True)).all()
    admin_ids = [u.id for u in admins if u.is_admin]
    for user_id in admin_ids:
        try:
            await NotificationService.create_notification(
                db,
                {
                    "user_id": user_id,
                    "title": "Portal access update",
                    "message": message,
                    "type": "in_app",
                    "reference_id": client_id,
                    "related_type": "client",
                    "meta_data": {"event": event, "client_id": str(client_id)},
                },
            )
        except Exception:
            logger.exception(
                "Failed admin notification user_id=%s event=%s client_id=%s",
                user_id,
                event,
                client_id,
            )
