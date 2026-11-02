"""Portal access via client_logins (phase 2g)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, List, Literal, Optional, Tuple
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_login_property_access import ClientLoginPropertyAccess
from app.models.client_login import (
    ADDED_VIA_EMAIL_MATCH,
    ADDED_VIA_INVITE,
    ADDED_VIA_MIGRATED,
    ADDED_VIA_SELF_SIGNUP,
    ClientLogin,
)
from app.models.client_portal_claim import ClientPortalClaim
from app.models.property import Property
from app.models.user import User as DBUser
from app.services.portal_account_linking import normalize_email
from app.services.portal_preview_guard import is_admin_preview
from app.utils.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

PORTAL_ACCESS_REVOKED_MESSAGE = (
    "Portal access to this account was removed. Contact Atomic Repair if you need a new invite."
)


class PortalLoginError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


PortalRole = Literal["owner", "tenant"]


@dataclass
class PortalScope:
    client: Client
    login: Optional[ClientLogin]
    role: PortalRole
    property_ids: Optional[List[UUID]]
    is_admin_preview: bool

    @property
    def is_tenant(self) -> bool:
        return self.role == "tenant" and not self.is_admin_preview

    @property
    def is_owner(self) -> bool:
        return not self.is_tenant


def _portal_feature_ctx(token_data: Any):
    from app.services.feature_flags_service import feature_context_from_roles

    return feature_context_from_roles(getattr(token_data, "roles", None))


def _tenant_property_ids_for_login(db: Session, login: ClientLogin) -> List[UUID]:
    rows = (
        db.query(ClientLoginPropertyAccess.property_id)
        .filter(ClientLoginPropertyAccess.client_login_id == login.id)
        .all()
    )
    return [row[0] for row in rows if row[0]]


def get_portal_scope(
    db: Session,
    token_data: Any,
    *,
    admin_client_id: Optional[UUID] = None,
) -> PortalScope:
    """Resolve portal client + tenant property scope (Wave 3)."""
    roles = getattr(token_data, "roles", []) or []
    is_admin = "admin" in roles
    is_client = "client" in roles
    admin_preview = is_admin_preview(roles, str(admin_client_id) if admin_client_id else None)

    if admin_preview and admin_client_id:
        client = db.query(Client).filter(Client.id == admin_client_id).first()
        if not client or client.merged_into_client_id is not None:
            raise PortalLoginError("not_linked", "Client not found")
        return PortalScope(
            client=client,
            login=None,
            role="owner",
            property_ids=None,
            is_admin_preview=True,
        )

    if is_admin and not admin_client_id:
        raise PortalLoginError(
            "admin_no_client",
            "Admin must specify admin_client_id to preview portal",
        )

    if is_client:
        auth0_user_id = token_data.sub
        login = get_active_login_for_sub(db, auth0_user_id)
        if not login:
            revoked = (
                db.query(ClientLogin)
                .filter(
                    ClientLogin.auth0_user_id == auth0_user_id,
                    ClientLogin.revoked_at.isnot(None),
                )
                .first()
            )
            if revoked:
                raise PortalLoginError("revoked", PORTAL_ACCESS_REVOKED_MESSAGE)
            raise PortalLoginError(
                "not_linked",
                "No client record found for this account.",
            )

        client = db.query(Client).filter(Client.id == login.client_id).first()
        if not client or client.merged_into_client_id is not None:
            raise PortalLoginError(
                "not_linked",
                "No client record found for this account.",
            )

        from app.services.feature_flags_service import feature_enabled

        ctx = _portal_feature_ctx(token_data)
        if not feature_enabled(db, "tenant_access", ctx):
            return PortalScope(
                client=client,
                login=login,
                role="owner",
                property_ids=None,
                is_admin_preview=False,
            )

        role_raw = (getattr(login, "role", None) or "owner").strip().lower()
        role: PortalRole = "tenant" if role_raw == "tenant" else "owner"
        if role == "tenant":
            property_ids = _tenant_property_ids_for_login(db, login)
        else:
            property_ids = None

        return PortalScope(
            client=client,
            login=login,
            role=role,
            property_ids=property_ids,
            is_admin_preview=False,
        )

    raise PortalLoginError("forbidden", "Client portal access required")


def _naive_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def get_active_login_for_sub(db: Session, auth0_sub: str) -> Optional[ClientLogin]:
    if not auth0_sub:
        return None
    return (
        db.query(ClientLogin)
        .filter(
            ClientLogin.auth0_user_id == auth0_sub,
            ClientLogin.revoked_at.is_(None),
        )
        .first()
    )


def get_login_for_sub(db: Session, auth0_sub: str) -> Optional[ClientLogin]:
    """Most recent login row for sub (active or revoked)."""
    if not auth0_sub:
        return None
    return (
        db.query(ClientLogin)
        .filter(ClientLogin.auth0_user_id == auth0_sub)
        .order_by(ClientLogin.created_at.desc())
        .first()
    )


def get_revoked_login_for_sub_client(
    db: Session,
    auth0_sub: str,
    client_id: UUID,
) -> Optional[ClientLogin]:
    return (
        db.query(ClientLogin)
        .filter(
            ClientLogin.auth0_user_id == auth0_sub,
            ClientLogin.client_id == client_id,
            ClientLogin.revoked_at.isnot(None),
        )
        .order_by(ClientLogin.revoked_at.desc())
        .first()
    )


def has_active_login_anywhere(db: Session, auth0_sub: str) -> bool:
    return get_active_login_for_sub(db, auth0_sub) is not None


def list_active_logins(db: Session, client_id: UUID) -> List[ClientLogin]:
    return (
        db.query(ClientLogin)
        .filter(
            ClientLogin.client_id == client_id,
            ClientLogin.revoked_at.is_(None),
        )
        .order_by(ClientLogin.created_at.asc())
        .all()
    )


def active_login_user_ids(db: Session, client_id: UUID) -> List[UUID]:
    rows = (
        db.query(ClientLogin.user_id)
        .filter(
            ClientLogin.client_id == client_id,
            ClientLogin.revoked_at.is_(None),
            ClientLogin.user_id.isnot(None),
        )
        .all()
    )
    return [row[0] for row in rows if row[0]]


def resolve_portal_client(
    db: Session,
    auth0_sub: str,
) -> Client:
    login = get_active_login_for_sub(db, auth0_sub)
    if not login:
        revoked = (
            db.query(ClientLogin)
            .filter(
                ClientLogin.auth0_user_id == auth0_sub,
                ClientLogin.revoked_at.isnot(None),
            )
            .first()
        )
        if revoked:
            raise PortalLoginError("revoked", PORTAL_ACCESS_REVOKED_MESSAGE)
        raise PortalLoginError("not_linked", "No client record found for this account.")

    client = db.query(Client).filter(Client.id == login.client_id).first()
    if not client or client.merged_into_client_id is not None:
        raise PortalLoginError("not_linked", "No client record found for this account.")
    return client


def _claim_restores_revoked_access(
    revoked_login: ClientLogin,
    claim: Optional[ClientPortalClaim],
) -> bool:
    if not claim or not revoked_login or not revoked_login.revoked_at:
        return False
    claim_created = _naive_dt(claim.created_at)
    revoked_at = _naive_dt(revoked_login.revoked_at)
    if not claim_created or not revoked_at:
        return False
    return claim_created > revoked_at


def assert_can_link_to_client(
    db: Session,
    auth0_sub: str,
    client_id: UUID,
    *,
    link_method: str,
    claim: Optional[ClientPortalClaim] = None,
) -> None:
    """Block email_match / stale claims after revoke; allow post-revoke invites."""
    active = get_active_login_for_sub(db, auth0_sub)
    if active and active.client_id == client_id:
        return
    if active and active.client_id != client_id:
        raise PortalLoginError(
            "other_client",
            "This login is already linked to another client account.",
        )

    revoked = get_revoked_login_for_sub_client(db, auth0_sub, client_id)
    if not revoked:
        return

    if link_method in ("email_verified", "email_match"):
        raise PortalLoginError("revoked", PORTAL_ACCESS_REVOKED_MESSAGE)

    if link_method in ("claim_token", "invite_token"):
        if not _claim_restores_revoked_access(revoked, claim):
            raise PortalLoginError("revoked", PORTAL_ACCESS_REVOKED_MESSAGE)
        return

    if link_method == "self_signup":
        return

    raise PortalLoginError("revoked", PORTAL_ACCESS_REVOKED_MESSAGE)


def ensure_client_login(
    db: Session,
    *,
    client: Client,
    auth0_sub: str,
    added_via: str,
    display_name: Optional[str] = None,
    invited_email: Optional[str] = None,
    invited_phone: Optional[str] = None,
    claim: Optional[ClientPortalClaim] = None,
    link_method: str,
) -> Tuple[ClientLogin, bool]:
    """
    Create or return active login. Returns (login, created).
    Does not write clients.auth0_user_id.
    """
    assert_can_link_to_client(
        db,
        auth0_sub,
        client.id,
        link_method=link_method,
        claim=claim,
    )

    existing = get_active_login_for_sub(db, auth0_sub)
    if existing:
        if existing.client_id != client.id:
            raise PortalLoginError(
                "other_client",
                "This login is already linked to another client account.",
            )
        if claim:
            apply_portal_login_scope_from_claim(db, existing, claim)
        return existing, False

    revoked = get_revoked_login_for_sub_client(db, auth0_sub, client.id)
    if revoked:
        if _claim_restores_revoked_access(revoked, claim):
            revoked.revoked_at = None
            if display_name and str(display_name).strip():
                revoked.display_name = str(display_name).strip()
            if invited_email:
                revoked.invited_email = normalize_email(invited_email)
            if invited_phone:
                revoked.invited_phone = str(invited_phone).strip() or None
            revoked.added_via = added_via
            if claim:
                apply_portal_login_scope_from_claim(db, revoked, claim)
            db.flush()
            logger.info(
                "Reactivated client_login id=%s client_id=%s sub=%s",
                revoked.id,
                client.id,
                auth0_sub,
            )
            return revoked, False
        raise PortalLoginError("revoked", PORTAL_ACCESS_REVOKED_MESSAGE)

    login = ClientLogin(
        client_id=client.id,
        auth0_user_id=auth0_sub,
        added_via=added_via,
        display_name=(display_name or "").strip() or None,
        invited_email=normalize_email(invited_email) if invited_email else None,
        invited_phone=(invited_phone or "").strip() or None,
    )
    db.add(login)
    db.flush()
    if claim:
        apply_portal_login_scope_from_claim(db, login, claim)
    logger.info(
        "Created client_login id=%s client_id=%s sub=%s via=%s",
        login.id,
        client.id,
        auth0_sub,
        added_via,
    )
    return login, True


def added_via_for_link_method(link_method: Optional[str]) -> str:
    if link_method in ("claim_token", "invite_token"):
        return ADDED_VIA_INVITE
    if link_method in ("email_verified", "email_match"):
        return ADDED_VIA_EMAIL_MATCH
    if link_method == "self_signup":
        return ADDED_VIA_SELF_SIGNUP
    return ADDED_VIA_MIGRATED


def person_fields_from_claim(claim: Optional[ClientPortalClaim]) -> dict:
    if not claim:
        return {}
    return {
        "display_name": getattr(claim, "display_name", None),
        "invited_email": getattr(claim, "invited_email", None),
        "invited_phone": getattr(claim, "invited_phone", None),
    }


def _tenant_scope_from_claim_metadata(
    claim: Optional[ClientPortalClaim],
) -> Tuple[PortalRole, Optional[UUID]]:
    if not claim:
        return "owner", None
    meta = getattr(claim, "claim_metadata", None) or {}
    if not isinstance(meta, dict):
        return "owner", None
    role_raw = str(meta.get("role") or "owner").strip().lower()
    if role_raw != "tenant":
        return "owner", None
    raw_pid = meta.get("property_id")
    if not raw_pid:
        return "tenant", None
    try:
        return "tenant", UUID(str(raw_pid))
    except (ValueError, TypeError):
        return "tenant", None


def apply_portal_login_scope_from_claim(
    db: Session,
    login: ClientLogin,
    claim: Optional[ClientPortalClaim],
) -> None:
    """Apply owner/tenant role + property access row from invite metadata."""
    role, property_id = _tenant_scope_from_claim_metadata(claim)
    login.role = role
    db.query(ClientLoginPropertyAccess).filter(
        ClientLoginPropertyAccess.client_login_id == login.id
    ).delete(synchronize_session=False)
    if role == "tenant" and property_id:
        prop = (
            db.query(Property)
            .filter(Property.id == property_id, Property.client_id == login.client_id)
            .first()
        )
        if prop:
            db.add(
                ClientLoginPropertyAccess(
                    client_login_id=login.id,
                    property_id=property_id,
                )
            )
    db.flush()


def find_open_claim_by_invited_email(
    db: Session,
    email: str,
) -> Optional[ClientPortalClaim]:
    normalized = normalize_email(email)
    if not normalized:
        return None
    now = utcnow_naive()
    return (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.purpose == "portal_invite",
            ClientPortalClaim.used_at.is_(None),
            ClientPortalClaim.revoked_at.is_(None),
            ClientPortalClaim.expires_at > now,
            func.lower(func.trim(ClientPortalClaim.invited_email)) == normalized,
        )
        .order_by(ClientPortalClaim.created_at.desc())
        .first()
    )


def revoke_client_login(
    db: Session,
    login_id: UUID,
) -> ClientLogin:
    login = db.query(ClientLogin).filter(ClientLogin.id == login_id).with_for_update().first()
    if not login:
        raise PortalLoginError("not_found", "Portal login not found.")
    if login.revoked_at:
        return login
    login.revoked_at = utcnow_naive()
    db.flush()
    logger.info("Revoked client_login id=%s sub=%s", login.id, login.auth0_user_id)
    return login


def count_active_logins(db: Session, client_id: UUID) -> int:
    return (
        db.query(ClientLogin)
        .filter(
            ClientLogin.client_id == client_id,
            ClientLogin.revoked_at.is_(None),
        )
        .count()
    )


def has_real_portal_login(db: Session, client: Client) -> bool:
    return count_active_logins(db, client.id) > 0


def remove_auth0_client_role_if_orphaned(auth0_sub: str) -> Optional[str]:
    """Remove Auth0 client role when sub has no active logins. Returns error detail or None."""
    from urllib.parse import quote

    import requests

    from app.core.auth import get_auth_handler
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        if has_active_login_anywhere(db, auth0_sub):
            return None
    finally:
        db.close()

    client_role_id = "rol_okGmH3pkFUu0YXWi"
    try:
        auth_handler = get_auth_handler()
        management_token = auth_handler.get_client_credentials_token()
        encoded_user_id = quote(auth0_sub, safe="")
        roles_url = auth_handler.mgmt_api_url(f"/users/{encoded_user_id}/roles")
        headers = {"Authorization": f"Bearer {management_token}"}
        response = requests.delete(
            roles_url,
            headers=headers,
            json={"roles": [client_role_id]},
            timeout=15,
        )
        if not response.ok:
            return f"Auth0 DELETE roles {response.status_code}: {response.text[:300]}"
        logger.info("Removed Auth0 client role for orphaned sub %s", auth0_sub)
        return None
    except Exception as exc:
        logger.exception("Auth0 role removal failed for %s", auth0_sub)
        return str(exc)


def sync_login_user_id(db: Session, login: ClientLogin, user: DBUser) -> None:
    if login.user_id != user.id:
        login.user_id = user.id
        db.flush()


def portal_member_display_names(db: Session, client_id: UUID) -> List[str]:
    names: List[str] = []
    for login in list_active_logins(db, client_id):
        if login.display_name and login.display_name.strip():
            names.append(login.display_name.strip())
            continue
        if login.user_id:
            user = db.query(DBUser).filter(DBUser.id == login.user_id).first()
            if user and (user.first_name or user.last_name):
                names.append(f"{user.first_name or ''} {user.last_name or ''}".strip())
                continue
    return names
