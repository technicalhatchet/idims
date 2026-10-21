"""Auth0 login identify-user role hints (verified email + Management API only)."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote

import requests
from sqlalchemy.orm import Session

from app.core.auth import auth0_mgmt_api_url, get_auth_handler
from app.services.portal_account_linking import (
    auth0_email_verified,
    resolve_verified_link_email_from_profile,
)

STAFF_ROLE_ASSIGNABLE = frozenset({"technician"})


def fetch_auth0_user_profile(auth0_user_id: str) -> Dict[str, Any]:
    """Load Auth0 user profile via Management API."""
    auth_handler = get_auth_handler()
    management_token = auth_handler.get_client_credentials_token()
    encoded_user_id = quote(auth0_user_id, safe="")
    response = requests.get(
        auth0_mgmt_api_url(f"/users/{encoded_user_id}"),
        headers={"Authorization": f"Bearer {management_token}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def resolve_identify_role_hint(
    db: Session,
    auth0_user_id: str,
    profile: Dict[str, Any],
) -> Tuple[Optional[str], Optional[str], bool]:
    """
    Returns (role, record_id, email_verified).

    Role hints use Auth0-verified email only. Client may be returned as a routing hint;
    Auth0 RBAC client role assignment happens only in POST /portal/link-account.
    """
    from app.models.client import Client
    from app.models.technician import Technician
    from app.models.user import User

    verified = auth0_email_verified(profile)
    link_email, email_ok = resolve_verified_link_email_from_profile(profile)
    if not verified or not email_ok or not link_email:
        return None, None, verified

    user = db.query(User).filter(User.auth_id == auth0_user_id).first()
    if not user:
        user = db.query(User).filter(User.email == link_email).first()
    if user:
        roles = [str(r).lower() for r in (user.roles or []) if r]
        for staff_role in ("admin", "manager", "technician"):
            if staff_role in roles:
                return staff_role, str(user.id), True

    technician = db.query(Technician).filter(Technician.email == link_email).first()
    if technician:
        return "technician", str(technician.id), True

    client = db.query(Client).filter(Client.email == link_email).first()
    if client:
        return "client", str(client.id), True

    return None, None, True


def role_assignable_from_callback(role: Optional[str]) -> bool:
    """Roles the Next.js Auth0 callback may assign via Management API."""
    if not role:
        return False
    return role.lower() in STAFF_ROLE_ASSIGNABLE
