"""DB-authoritative user roles with best-effort Auth0 mirror."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, List, Optional, Set, Tuple
from urllib.parse import quote

import requests
from sqlalchemy.orm import Session

from app.core.auth import auth0_mgmt_api_url, get_auth_handler
from app.models.user import User

logger = logging.getLogger(__name__)

CLIENT_ROLE_ID = "rol_okGmH3pkFUu0YXWi"
DIYER_ROLE_ID = "rol_efrbzOWFRtk0sJYy"
TECHNICIAN_ROLE_ID = "rol_KIVgWHYL1p8smVsc"

# Auth0 RBAC ids we manage (never DELETE ids outside this set).
KNOWN_ROLE_NAME_TO_ID = {
    "client": CLIENT_ROLE_ID,
    "diyer": DIYER_ROLE_ID,
    "technician": TECHNICIAN_ROLE_ID,
}
KNOWN_ROLE_IDS = set(KNOWN_ROLE_NAME_TO_ID.values())
ID_TO_ROLE_NAME = {v: k for k, v in KNOWN_ROLE_NAME_TO_ID.items()}


def normalize_role_names(raw: Any) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        items = [raw]
    elif isinstance(raw, (list, tuple, set)):
        items = list(raw)
    else:
        return []
    out: List[str] = []
    for item in items:
        if item is None:
            continue
        s = str(item).strip().lower()
        if s:
            out.append(s)
    return sorted(set(out))


def load_user_roles_for_token(db: Session, token_data: Any) -> List[str]:
    """Resolve roles from DB, creating/seeding the user row like get_current_user."""
    auth_handler = get_auth_handler()
    user = auth_handler.ensure_db_user_from_token(db, token_data)
    return list(user.roles or [])


def count_admin_users(db: Session, *, exclude_user_id: Optional[Any] = None) -> int:
    total = 0
    for user in db.query(User).all():
        if exclude_user_id is not None and user.id == exclude_user_id:
            continue
        if "admin" in normalize_role_names(user.roles):
            total += 1
    return total


def _mirror_auth0_after_db_commit(auth_id: str, roles: List[str]) -> Optional[str]:
    """Patch app_metadata.roles and sync known RBAC role ids. Returns error text or None."""
    if not auth_id:
        return "missing auth_id for Auth0 mirror"

    roles = normalize_role_names(roles)
    try:
        auth_handler = get_auth_handler()
        management_token = auth_handler.get_client_credentials_token()
        encoded = quote(auth_id, safe="")
        headers = {
            "Authorization": f"Bearer {management_token}",
            "Content-Type": "application/json",
        }

        patch_resp = requests.patch(
            auth0_mgmt_api_url(f"/users/{encoded}"),
            headers=headers,
            json={"app_metadata": {"roles": roles}},
            timeout=15,
        )
        if not patch_resp.ok:
            return f"app_metadata PATCH {patch_resp.status_code}: {patch_resp.text[:300]}"

        roles_url = auth0_mgmt_api_url(f"/users/{encoded}/roles")
        get_resp = requests.get(roles_url, headers=headers, timeout=15)
        if not get_resp.ok:
            return f"GET roles {get_resp.status_code}: {get_resp.text[:300]}"

        current_ids: Set[str] = set()
        for item in get_resp.json() or []:
            if isinstance(item, dict) and item.get("id"):
                current_ids.add(str(item["id"]))

        desired_ids = {
            KNOWN_ROLE_NAME_TO_ID[name]
            for name in roles
            if name in KNOWN_ROLE_NAME_TO_ID
        }
        managed_current = current_ids & KNOWN_ROLE_IDS

        to_add = desired_ids - managed_current
        to_remove = managed_current - desired_ids

        if to_add:
            post_resp = requests.post(
                roles_url,
                headers=headers,
                json={"roles": sorted(to_add)},
                timeout=15,
            )
            if post_resp.status_code not in (200, 201, 204):
                return f"POST roles {post_resp.status_code}: {post_resp.text[:300]}"

        if to_remove:
            delete_resp = requests.delete(
                roles_url,
                headers=headers,
                json={"roles": sorted(to_remove)},
                timeout=15,
            )
            if delete_resp.status_code not in (200, 204):
                return f"DELETE roles {delete_resp.status_code}: {delete_resp.text[:300]}"

        return None
    except requests.RequestException as exc:
        logger.warning("[RoleService] Auth0 mirror failed for %s: %s", auth_id, exc)
        return str(exc)


def mirror_user_roles(user: User) -> Optional[str]:
    """Mirror users.roles to Auth0. Call only after the DB transaction has committed."""
    if not user.auth_id:
        return None
    roles = normalize_role_names(user.roles)
    err = _mirror_auth0_after_db_commit(user.auth_id, roles)
    if err:
        logger.warning(
            "[RoleService] Auth0 mirror for user=%s: %s",
            getattr(user, "email", user.id),
            err,
        )
    return err


def set_user_roles(
    db: Session,
    user: User,
    roles: List[str],
    *,
    commit: bool = True,
    mirror_auth0: bool = True,
) -> Tuple[User, Optional[str]]:
    """Replace users.roles; mirror Auth0 only after a successful DB commit."""
    normalized = normalize_role_names(roles)
    if not normalized:
        normalized = ["client"]
    user.roles = normalized
    user.updated_at = datetime.utcnow()
    db.flush()
    auth0_error = None
    if commit:
        db.commit()
        db.refresh(user)
        if mirror_auth0 and user.auth_id:
            auth0_error = _mirror_auth0_after_db_commit(user.auth_id, normalized)
            if auth0_error:
                logger.warning(
                    "[RoleService] Auth0 mirror after set_user_roles user=%s: %s",
                    user.email,
                    auth0_error,
                )
    return user, auth0_error


def add_user_roles(
    db: Session,
    user: User,
    roles: List[str],
    *,
    commit: bool = True,
    mirror_auth0: bool = True,
) -> Tuple[User, Optional[str]]:
    existing = normalize_role_names(user.roles)
    merged = normalize_role_names(existing + list(roles))
    return set_user_roles(db, user, merged, commit=commit, mirror_auth0=mirror_auth0)


def remove_user_roles(
    db: Session,
    user: User,
    roles: List[str],
    *,
    commit: bool = True,
    mirror_auth0: bool = True,
) -> Tuple[User, Optional[str]]:
    remove = set(normalize_role_names(roles))
    remaining = [r for r in normalize_role_names(user.roles) if r not in remove]
    if not remaining:
        remaining = ["client"]
    return set_user_roles(db, user, remaining, commit=commit, mirror_auth0=mirror_auth0)


def fetch_auth0_role_snapshot(auth_id: str) -> Tuple[List[str], List[str], Optional[str]]:
    """Read-only: (rbac names, app_metadata.roles, error)."""
    if not auth_id:
        return [], [], "missing auth_id"
    try:
        auth_handler = get_auth_handler()
        mgmt_token = auth_handler.get_client_credentials_token()
        encoded = quote(auth_id, safe="")
        headers = {"Authorization": f"Bearer {mgmt_token}"}
        rbac: List[str] = []
        meta: List[str] = []

        roles_resp = requests.get(
            auth0_mgmt_api_url(f"/users/{encoded}/roles"),
            headers=headers,
            timeout=15,
        )
        if not roles_resp.ok:
            return [], [], f"GET roles {roles_resp.status_code}: {roles_resp.text[:300]}"
        for role in roles_resp.json() or []:
            if isinstance(role, dict) and role.get("name"):
                rbac.append(str(role["name"]))

        user_resp = requests.get(
            auth0_mgmt_api_url(f"/users/{encoded}"),
            headers=headers,
            timeout=15,
        )
        if not user_resp.ok:
            return normalize_role_names(rbac), [], f"GET user {user_resp.status_code}: {user_resp.text[:300]}"
        profile = user_resp.json() or {}
        app_metadata = profile.get("app_metadata") or {}
        if isinstance(app_metadata, dict):
            meta = normalize_role_names(app_metadata.get("roles"))
        return normalize_role_names(rbac), meta, None
    except requests.RequestException as exc:
        return [], [], str(exc)
