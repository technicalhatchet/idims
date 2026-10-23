"""Wave 1 (and future) feature toggles stored in settings.feature_flags."""

from __future__ import annotations

import copy
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SETTING_KEY = "feature_flags"
CACHE_TTL_SECONDS = 30

FEATURE_DISABLED_DETAIL = "This feature is not available."
SELF_SIGNUP_DISABLED_DETAIL = "Contact Atomic Repair to set up your account."

# Registry: flag id -> one-line description (admin UI + docs).
FEATURE_FLAG_DEFINITIONS: Dict[str, str] = {
    "estimate_approval": "Portal approve/decline estimate (signature) and staff decision alerts",
    "review_requests": "Google review request emails and portal notifications after pay",
    "customer_media_uploads": "Customer photo upload on portal work orders",
    "appliance_exports": "Portal appliance CSV/PDF exports",
    "household_invites": "Customer-initiated household portal invites (settings)",
    "self_signup": "Open portal sign-up for new households (no invite)",
}

ALL_FEATURE_FLAG_IDS: Set[str] = set(FEATURE_FLAG_DEFINITIONS.keys())

_cache_flags: Optional[Dict[str, Dict[str, Any]]] = None
_cache_at: float = 0.0


@dataclass
class FeatureContext:
    roles: List[str] = field(default_factory=list)

    @property
    def is_admin_or_preview(self) -> bool:
        normalized = {str(r).lower() for r in self.roles}
        return bool(normalized & {"admin", "manager"})


def invalidate_feature_flags_cache() -> None:
    global _cache_flags, _cache_at
    _cache_flags = None
    _cache_at = 0.0


def default_feature_flags() -> Dict[str, Dict[str, Any]]:
    return {
        flag_id: {"enabled": True, "admin_only": False}
        for flag_id in FEATURE_FLAG_DEFINITIONS
    }


def _deep_merge(base: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(base)
    for key, value in (patch or {}).items():
        if key not in ALL_FEATURE_FLAG_IDS:
            continue
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = {**out[key], **value}
        else:
            out[key] = value
    return out


def get_feature_flags(db: Session) -> Dict[str, Dict[str, Any]]:
    defaults = default_feature_flags()
    row = db.execute(
        text("SELECT value FROM settings WHERE key = :key"),
        {"key": SETTING_KEY},
    ).fetchone()
    if not row or not row[0]:
        return defaults
    value = row[0]
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = {}
    if not isinstance(value, dict):
        return defaults
    return _deep_merge(defaults, value)


def get_feature_flags_cached(db: Session) -> Dict[str, Dict[str, Any]]:
    global _cache_flags, _cache_at
    now = time.monotonic()
    if _cache_flags is not None and (now - _cache_at) < CACHE_TTL_SECONDS:
        return _cache_flags
    _cache_flags = get_feature_flags(db)
    _cache_at = now
    return _cache_flags


def feature_context_from_roles(roles: Any) -> FeatureContext:
    if not roles:
        return FeatureContext()
    if isinstance(roles, (list, tuple, set)):
        return FeatureContext(roles=[str(r) for r in roles])
    return FeatureContext(roles=[str(roles)])


def feature_enabled(
    db: Session,
    flag: str,
    ctx: Optional[FeatureContext] = None,
) -> bool:
    if flag not in ALL_FEATURE_FLAG_IDS:
        return False
    cfg = get_feature_flags_cached(db).get(flag) or {}
    if not cfg.get("enabled", True):
        return False
    if cfg.get("admin_only") and not (ctx and ctx.is_admin_or_preview):
        return False
    return True


def list_enabled_features_for_context(
    db: Session,
    ctx: Optional[FeatureContext],
) -> List[str]:
    enabled: List[str] = []
    for flag_id in FEATURE_FLAG_DEFINITIONS:
        if feature_enabled(db, flag_id, ctx):
            enabled.append(flag_id)
    return sorted(enabled)


def admin_feature_flags_payload(db: Session) -> Dict[str, Any]:
    flags = get_feature_flags(db)
    return {
        "flags": {
            flag_id: {
                "enabled": bool(flags.get(flag_id, {}).get("enabled", True)),
                "admin_only": bool(flags.get(flag_id, {}).get("admin_only", False)),
                "description": FEATURE_FLAG_DEFINITIONS[flag_id],
            }
            for flag_id in FEATURE_FLAG_DEFINITIONS
        }
    }


def validate_feature_flags_value(value: Any) -> None:
    if not isinstance(value, dict):
        raise ValueError("feature_flags must be an object")
    for key, entry in value.items():
        if key not in ALL_FEATURE_FLAG_IDS:
            raise ValueError(f"Unknown feature flag: {key}")
        if not isinstance(entry, dict):
            raise ValueError(f"feature_flags.{key} must be an object")
        if "enabled" in entry and not isinstance(entry["enabled"], bool):
            raise ValueError(f"feature_flags.{key}.enabled must be boolean")
        if "admin_only" in entry and not isinstance(entry["admin_only"], bool):
            raise ValueError(f"feature_flags.{key}.admin_only must be boolean")


def require_feature(
    db: Session,
    flag: str,
    ctx: Optional[FeatureContext] = None,
    *,
    status_code: int = 404,
    detail: str = FEATURE_DISABLED_DETAIL,
) -> None:
    if not feature_enabled(db, flag, ctx):
        raise HTTPException(status_code=status_code, detail=detail)
