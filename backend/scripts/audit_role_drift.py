"""
Read-only audit: compare users.roles (DB) to Auth0 for every user with auth_id.

Fetches Auth0 Management API:
  - RBAC role names (GET /users/{id}/roles)
  - app_metadata.roles on the user profile (GET /users/{id})

Reports rows where DB roles differ from Auth0 RBAC names and/or app_metadata.roles
(normalized: lowercase, sorted unique lists).

Usage (from backend/, with DATABASE_URL and Auth0 mgmt env configured):
  python scripts/audit_role_drift.py

Optional:
  --limit N          Only scan first N users (ordered by email)
  --csv PATH         Write mismatches to CSV
  --include-match    Print every user, not only mismatches
  --sleep-ms MS      Pause between Auth0 calls (default 700) to ease rate limits
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import quote

import requests
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import importlib
import pkgutil

import app.models  # noqa: F401 — register mappers

for _mod in pkgutil.iter_modules(app.models.__path__):
    try:
        importlib.import_module(f"app.models.{_mod.name}")
    except Exception:
        continue

from app.core.auth import auth0_mgmt_api_url, get_auth_handler
from app.db.database import SessionLocal
from app.models.user import User


def _normalize_roles(raw: Any) -> List[str]:
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


def _mgmt_get(url: str, headers: dict, *, timeout: float = 15.0) -> requests.Response:
    for attempt in range(2):
        resp = requests.get(url, headers=headers, timeout=timeout)
        if resp.status_code == 429 and attempt == 0:
            time.sleep(2.0)
            continue
        return resp
    return resp


def _fetch_auth0_snapshot(
    auth_id: str,
    mgmt_token: str,
    *,
    timeout: float = 15.0,
    sleep_ms: int = 0,
) -> Tuple[List[str], List[str], Optional[str]]:
    """
    Returns (rbac_role_names, app_metadata_roles, error_detail).
    """
    encoded = quote(auth_id, safe="")
    headers = {"Authorization": f"Bearer {mgmt_token}"}
    rbac_names: List[str] = []
    meta_roles: List[str] = []

    try:
        roles_resp = _mgmt_get(
            auth0_mgmt_api_url(f"/users/{encoded}/roles"),
            headers,
            timeout=timeout,
        )
        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000.0)
        if not roles_resp.ok:
            return [], [], f"GET roles {roles_resp.status_code}: {roles_resp.text[:300]}"
        for role in roles_resp.json() or []:
            name = role.get("name") if isinstance(role, dict) else None
            if name:
                rbac_names.append(str(name))
    except requests.RequestException as exc:
        return [], [], f"GET roles failed: {exc}"

    try:
        user_resp = _mgmt_get(
            auth0_mgmt_api_url(f"/users/{encoded}"),
            headers,
            timeout=timeout,
        )
        if not user_resp.ok:
            return _normalize_roles(rbac_names), [], f"GET user {user_resp.status_code}: {user_resp.text[:300]}"
        profile = user_resp.json() or {}
        app_metadata = profile.get("app_metadata") or {}
        if isinstance(app_metadata, dict):
            meta_roles = _normalize_roles(app_metadata.get("roles"))
    except requests.RequestException as exc:
        return _normalize_roles(rbac_names), [], f"GET user failed: {exc}"

    return _normalize_roles(rbac_names), _normalize_roles(meta_roles), None


def _mismatch_kinds(
    db_roles: List[str],
    rbac_roles: List[str],
    meta_roles: List[str],
) -> List[str]:
    kinds: List[str] = []
    if db_roles != rbac_roles:
        kinds.append("db_vs_rbac")
    if db_roles != meta_roles:
        kinds.append("db_vs_app_metadata")
    if rbac_roles != meta_roles:
        kinds.append("rbac_vs_app_metadata")
    return kinds


def audit_users(
    db: Session,
    *,
    limit: Optional[int] = None,
    sleep_ms: int = 50,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    auth_handler = get_auth_handler()
    mgmt_token = auth_handler.get_client_credentials_token()

    query = (
        db.query(User)
        .filter(User.auth_id.isnot(None), User.auth_id != "")
        .order_by(User.email)
    )
    if limit:
        query = query.limit(limit)

    rows: List[Dict[str, Any]] = []
    stats = {
        "scanned": 0,
        "auth0_errors": 0,
        "mismatch_users": 0,
        "match_users": 0,
    }

    for user in query.all():
        stats["scanned"] += 1
        db_roles = _normalize_roles(user.roles)
        rbac_roles, meta_roles, err = _fetch_auth0_snapshot(
            user.auth_id, mgmt_token, sleep_ms=sleep_ms
        )
        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000.0)

        kinds = _mismatch_kinds(db_roles, rbac_roles, meta_roles)
        if err:
            stats["auth0_errors"] += 1
            row = {
                "email": user.email,
                "auth_id": user.auth_id,
                "user_id": str(user.id),
                "db_roles": ",".join(db_roles),
                "auth0_rbac_roles": ",".join(rbac_roles),
                "auth0_app_metadata_roles": ",".join(meta_roles),
                "mismatch": "auth0_error",
                "error": err or "",
                "detail": err or "",
            }
            rows.append(row)
            continue

        if kinds:
            stats["mismatch_users"] += 1
        else:
            stats["match_users"] += 1

        if kinds or err:
            rows.append(
                {
                    "email": user.email,
                    "auth_id": user.auth_id,
                    "user_id": str(user.id),
                    "db_roles": ",".join(db_roles),
                    "auth0_rbac_roles": ",".join(rbac_roles),
                    "auth0_app_metadata_roles": ",".join(meta_roles),
                    "mismatch": "|".join(kinds) if kinds else "",
                    "error": "",
                    "detail": "",
                }
            )

    return rows, stats


def audit_users_with_matches(
    db: Session,
    *,
    limit: Optional[int] = None,
    sleep_ms: int = 50,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """Same as audit_users but includes aligned rows in output."""
    auth_handler = get_auth_handler()
    mgmt_token = auth_handler.get_client_credentials_token()

    query = (
        db.query(User)
        .filter(User.auth_id.isnot(None), User.auth_id != "")
        .order_by(User.email)
    )
    if limit:
        query = query.limit(limit)

    rows: List[Dict[str, Any]] = []
    stats = {
        "scanned": 0,
        "auth0_errors": 0,
        "mismatch_users": 0,
        "match_users": 0,
    }

    for user in query.all():
        stats["scanned"] += 1
        db_roles = _normalize_roles(user.roles)
        rbac_roles, meta_roles, err = _fetch_auth0_snapshot(
            user.auth_id, mgmt_token, sleep_ms=sleep_ms
        )
        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000.0)

        kinds = _mismatch_kinds(db_roles, rbac_roles, meta_roles)
        if err:
            stats["auth0_errors"] += 1
        elif kinds:
            stats["mismatch_users"] += 1
        else:
            stats["match_users"] += 1

        rows.append(
            {
                "email": user.email,
                "auth_id": user.auth_id,
                "user_id": str(user.id),
                "db_roles": ",".join(db_roles),
                "auth0_rbac_roles": ",".join(rbac_roles),
                "auth0_app_metadata_roles": ",".join(meta_roles),
                "mismatch": "auth0_error" if err else ("|".join(kinds) if kinds else "ok"),
                "error": err or "",
                "detail": err or "",
            }
        )

    return rows, stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--csv", default=None, help="Write results to CSV")
    parser.add_argument(
        "--include-match",
        action="store_true",
        help="Include users with no drift (mismatch column = ok)",
    )
    parser.add_argument("--sleep-ms", type=int, default=700)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.include_match:
            findings, stats = audit_users_with_matches(
                db, limit=args.limit, sleep_ms=args.sleep_ms
            )
        else:
            findings, stats = audit_users(db, limit=args.limit, sleep_ms=args.sleep_ms)
    finally:
        db.close()

    fieldnames = [
        "email",
        "auth_id",
        "user_id",
        "db_roles",
        "auth0_rbac_roles",
        "auth0_app_metadata_roles",
        "mismatch",
        "error",
        "detail",
    ]

    print(
        f"Scanned {stats['scanned']} users — "
        f"match {stats['match_users']}, "
        f"mismatch {stats['mismatch_users']}, "
        f"auth0_errors {stats['auth0_errors']}"
    )

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(findings)
        print(f"Wrote {len(findings)} row(s) to {args.csv}")
    else:
        for row in findings:
            print(
                f"{row['email']}\t{row['mismatch']}\t"
                f"db=[{row['db_roles']}] rbac=[{row['auth0_rbac_roles']}] "
                f"meta=[{row['auth0_app_metadata_roles']}]"
                + (f" ERR {row.get('error') or row.get('detail')}" if row.get("error") or row.get("detail") else "")
            )


if __name__ == "__main__":
    main()
