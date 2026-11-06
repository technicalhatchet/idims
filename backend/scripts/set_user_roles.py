"""
Set users.roles in the DB and mirror Auth0 (app_metadata + known RBAC ids).

Usage (from backend/):
  python scripts/set_user_roles.py --email you@example.com --roles admin,technician
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import importlib
import pkgutil

import app.models  # noqa: F401

for _mod in pkgutil.iter_modules(app.models.__path__):
    try:
        importlib.import_module(f"app.models.{_mod.name}")
    except Exception:
        continue

from app.db.database import SessionLocal
from app.models.user import User
from app.services.role_service import (
    fetch_auth0_role_snapshot,
    normalize_role_names,
    set_user_roles,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument(
        "--roles",
        required=True,
        help="Comma-separated role names, e.g. admin,technician",
    )
    args = parser.parse_args()

    roles = normalize_role_names(args.roles.split(","))
    if not roles:
        print("No roles parsed from --roles")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if not user:
            print(f"No user with email {args.email}")
            sys.exit(1)

        before_db = normalize_role_names(user.roles)
        before_rbac, before_meta, before_err = fetch_auth0_role_snapshot(user.auth_id or "")
        print("Before:")
        print(f"  DB roles:           {before_db}")
        print(f"  Auth0 RBAC:         {before_rbac}" + (f"  ERR {before_err}" if before_err else ""))
        print(f"  Auth0 app_metadata: {before_meta}")

        user, auth0_error = set_user_roles(db, user, roles)
        after_db = normalize_role_names(user.roles)
        after_rbac, after_meta, after_err = fetch_auth0_role_snapshot(user.auth_id or "")

        print("After:")
        print(f"  DB roles:           {after_db}")
        print(f"  Auth0 RBAC:         {after_rbac}" + (f"  ERR {after_err}" if after_err else ""))
        print(f"  Auth0 app_metadata: {after_meta}")
        if auth0_error:
            print(f"  Mirror warning:     {auth0_error}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
