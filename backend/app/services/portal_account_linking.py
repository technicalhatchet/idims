"""Portal account linking rules (Auth0-verified email + invite only)."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.client import Client

PLACEHOLDER_EMAIL_DOMAIN = "@noreply.atomicrepair419.com"

EMAIL_VERIFICATION_REQUIRED_MESSAGE = (
    "Check your email to verify your address, then sign in again to see your service history."
)

STAFF_PORTAL_ACCOUNT_FORBIDDEN = "Staff accounts can't create customer portal accounts."

STAFF_PORTAL_ROLES = frozenset({"admin", "manager", "technician"})


def token_has_staff_portal_role(roles: Optional[list]) -> bool:
    if not roles:
        return False
    return bool(STAFF_PORTAL_ROLES.intersection(roles))


def find_client_by_normalized_email(
    db: Session,
    email: Optional[str],
    *,
    for_update: bool = False,
) -> Optional[Client]:
    normalized = normalize_email(email)
    if not normalized:
        return None
    query = db.query(Client).filter(
        func.lower(func.trim(Client.email)) == normalized,
    )
    if for_update:
        query = query.with_for_update()
    return query.first()


def is_placeholder_client_email(email: Optional[str]) -> bool:
    if not email:
        return False
    return PLACEHOLDER_EMAIL_DOMAIN in str(email).lower()


def normalize_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    normalized = str(email).lower().strip()
    return normalized or None


def auth0_email_verified(profile: Dict[str, Any]) -> bool:
    value = profile.get("email_verified")
    if value is True:
        return True
    if isinstance(value, str) and value.lower() in ("true", "1", "yes"):
        return True
    return False


def resolve_verified_link_email_from_profile(profile: Dict[str, Any]) -> Tuple[Optional[str], bool]:
    """
    Returns (email, verified). Email is only returned when verified and not a placeholder domain.
    """
    email = normalize_email(profile.get("email"))
    if not email:
        return None, False
    if is_placeholder_client_email(email):
        return None, auth0_email_verified(profile)
    if not auth0_email_verified(profile):
        return email, False
    return email, True
