"""Open portal sign-up (self_signup clients + finish-profile gate)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.client import Client
from app.services.portal_account_linking import (
    find_client_by_normalized_email,
    is_placeholder_client_email,
    normalize_email,
    resolve_verified_link_email_from_profile,
)
from app.services.portal_login_service import (
    get_active_login_for_sub,
    get_revoked_login_for_sub_client,
    has_active_login_anywhere,
    list_active_logins,
)
from app.utils.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

SOURCE_SELF_SIGNUP = "self_signup"
DEFAULT_FIRST_NAME = "New"
DEFAULT_LAST_NAME = "Customer"


class PortalSignupError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def names_from_auth0_profile(profile: Dict[str, Any]) -> Tuple[str, str]:
    meta = profile.get("user_metadata") or {}
    first = (
        (profile.get("given_name") or meta.get("first_name") or profile.get("name") or "")
        .strip()
    )
    last = (profile.get("family_name") or meta.get("last_name") or "").strip()
    if first and not last and " " in first:
        parts = first.split(None, 1)
        first, last = parts[0], parts[1] if len(parts) > 1 else ""
    if not first:
        first = DEFAULT_FIRST_NAME
    if not last:
        last = DEFAULT_LAST_NAME
    return first[:100], last[:100]


def portal_signup_needs_profile(client: Client) -> bool:
    if getattr(client, "portal_profile_completed_at", None):
        return False
    return (getattr(client, "source", None) or "") == SOURCE_SELF_SIGNUP


def _client_has_other_active_portal_logins(db: Session, client: Client, auth0_user_id: str) -> bool:
    for login in list_active_logins(db, client.id):
        if login.auth0_user_id != auth0_user_id:
            return True
    return False


def create_self_signup_client(
    db: Session,
    *,
    auth0_user_id: str,
    profile: Dict[str, Any],
) -> Client:
    """
    Create a clients row for a verified-email Auth0 user with no existing match.
    Caller must commit. Does not assign Auth0 client role or create client_logins row.
    """
    link_email, email_verified = resolve_verified_link_email_from_profile(profile)
    if not link_email or not email_verified:
        raise PortalSignupError(
            "email_unverified",
            "Verify your email address before creating a portal account.",
        )

    active = get_active_login_for_sub(db, auth0_user_id)
    if active:
        client = db.query(Client).filter(Client.id == active.client_id).first()
        if client:
            return client

    locked = find_client_by_normalized_email(db, link_email, for_update=True)
    if locked:
        if is_placeholder_client_email(locked.email):
            pass
        elif _client_has_other_active_portal_logins(db, locked, auth0_user_id):
            raise PortalSignupError(
                "email_linked_other",
                "This email is already linked to a different login.",
            )
        elif get_revoked_login_for_sub_client(db, auth0_user_id, locked.id):
            # Revoked on this household — allow a fresh self_signup client (new empty account).
            pass
        elif list_active_logins(db, locked.id):
            raise PortalSignupError(
                "email_exists",
                "An account with this email already exists. Sign in with your invite link or contact Atomic Repair.",
            )
        else:
            raise PortalSignupError(
                "email_exists",
                "An account with this email already exists. Sign in with your invite link or contact Atomic Repair.",
            )

    first_name, last_name = names_from_auth0_profile(profile)
    now = utcnow_naive()
    client = Client(
        email=normalize_email(link_email),
        first_name=first_name,
        last_name=last_name,
        source=SOURCE_SELF_SIGNUP,
        status="active",
        portal_profile_completed_at=None,
        created_at=now,
        updated_at=now,
    )
    try:
        db.add(client)
        db.flush()
    except IntegrityError:
        db.rollback()
        if has_active_login_anywhere(db, auth0_user_id):
            active = get_active_login_for_sub(db, auth0_user_id)
            if active:
                existing = db.query(Client).filter(Client.id == active.client_id).first()
                if existing:
                    return existing
        raise PortalSignupError(
            "create_conflict",
            "Could not create portal account. Please try again.",
        )
    logger.info("Created self_signup client id=%s auth0=%s", client.id, auth0_user_id)
    return client


def apply_portal_profile_completion(
    db: Session,
    client: Client,
    *,
    first_name: str,
    last_name: str,
    mobile: str,
    phone: Optional[str] = None,
    sms_consent: bool = False,
) -> None:
    from app.utils.us_phone import normalize_phone_field

    client.first_name = first_name.strip()
    client.last_name = last_name.strip()
    client.mobile = mobile
    client.phone = phone
    client.sms_consent = bool(sms_consent)
    if sms_consent:
        client.sms_consent_at = utcnow_naive()
        client.sms_consent_source = "portal_signup"
    client.portal_profile_completed_at = utcnow_naive()
    client.updated_at = utcnow_naive()
