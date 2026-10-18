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


def create_self_signup_client(
    db: Session,
    *,
    auth0_user_id: str,
    profile: Dict[str, Any],
) -> Client:
    """
    Create a clients row for a verified-email Auth0 user with no existing match.
    Caller must commit. Does not assign Auth0 client role.
    """
    link_email, email_verified = resolve_verified_link_email_from_profile(profile)
    if not link_email or not email_verified:
        raise PortalSignupError(
            "email_unverified",
            "Verify your email address before creating a portal account.",
        )

    existing_auth0 = (
        db.query(Client).filter(Client.auth0_user_id == auth0_user_id).with_for_update().first()
    )
    if existing_auth0:
        return existing_auth0

    locked = find_client_by_normalized_email(db, link_email, for_update=True)
    if locked:
        if is_placeholder_client_email(locked.email):
            pass
        elif locked.auth0_user_id and locked.auth0_user_id != auth0_user_id:
            raise PortalSignupError(
                "email_linked_other",
                "This email is already linked to a different login.",
            )
        elif locked.auth0_user_id == auth0_user_id:
            return locked
        else:
            raise PortalSignupError(
                "email_exists",
                "An account with this email already exists. Sign in with your invite link or contact Atomic Repair.",
            )

    first_name, last_name = names_from_auth0_profile(profile)
    now = utcnow_naive()
    client = Client(
        auth0_user_id=auth0_user_id,
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
        existing = (
            db.query(Client)
            .filter(Client.auth0_user_id == auth0_user_id)
            .first()
        )
        if existing:
            logger.info(
                "self_signup race: reusing client id=%s auth0=%s",
                existing.id,
                auth0_user_id,
            )
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
    mobile: Optional[str],
    phone: Optional[str],
    sms_consent: bool,
) -> None:
    from app.services.client_contact import set_sms_consent

    client.first_name = first_name
    client.last_name = last_name
    client.mobile = mobile
    if phone is not None:
        client.phone = phone
    set_sms_consent(
        client,
        consent=sms_consent,
        source="portal_self_signup",
        at=datetime.utcnow(),
    )
    client.portal_profile_completed_at = utcnow_naive()
    client.updated_at = utcnow_naive()
