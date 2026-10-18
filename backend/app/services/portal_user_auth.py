"""Shared portal user identity helpers (no auth/db imports — avoids cycles)."""

from typing import Any, Optional

STAFF_ROLES = frozenset({"admin", "manager", "technician"})


def is_placeholder_client_auth_id(auth_id: Optional[str]) -> bool:
    return bool(auth_id and str(auth_id).startswith("client|"))


def user_has_staff_role(user: Any) -> bool:
    roles = getattr(user, "roles", None) or []
    if isinstance(roles, str):
        roles = [roles]
    normalized = {str(r).lower() for r in roles if r}
    return bool(normalized & STAFF_ROLES)
