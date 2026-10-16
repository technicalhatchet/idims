"""Portal account linking rules (Auth0-verified email + invite only)."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

PLACEHOLDER_EMAIL_DOMAIN = "@noreply.atomicrepair419.com"

EMAIL_VERIFICATION_REQUIRED_MESSAGE = (
    "Check your email to verify your address, then sign in again to see your service history."
)


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
