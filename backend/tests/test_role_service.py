"""DB-authoritative roles and Auth0 mirror."""

from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import MagicMock, patch

import pytest

from app.services.role_service import (
    add_user_roles,
    mirror_user_roles,
    remove_user_roles,
    set_user_roles,
)


def test_set_user_roles_persists_db_when_auth0_raises():
    user = SimpleNamespace(
        id=uuid4(),
        auth_id="auth0|role-test",
        email="role-test@example.com",
        roles=["client"],
        updated_at=None,
    )
    db = MagicMock()
    with patch("app.services.role_service._mirror_auth0_after_db_commit", return_value="Auth0 down"):
        updated, err = set_user_roles(db, user, ["admin"], commit=True)
    assert err == "Auth0 down"
    assert updated.roles == ["admin"]
    db.commit.assert_called_once()


def test_add_user_roles_merges_client_with_admin():
    user = SimpleNamespace(
        id=uuid4(),
        auth_id="auth0|merge",
        roles=["admin"],
        updated_at=None,
    )
    db = MagicMock()
    with patch("app.services.role_service._mirror_auth0_after_db_commit", return_value=None):
        updated, _ = add_user_roles(db, user, ["client"])
    assert updated.roles == ["admin", "client"]


def test_remove_user_roles_drops_client_keeps_admin():
    user = SimpleNamespace(
        id=uuid4(),
        auth_id="auth0|orphan",
        roles=["admin", "client"],
        updated_at=None,
    )
    db = MagicMock()
    with patch("app.services.role_service._mirror_auth0_after_db_commit", return_value=None):
        updated, _ = remove_user_roles(db, user, ["client"])
    assert updated.roles == ["admin"]


def test_set_user_roles_commit_false_skips_auth0_mirror():
    user = SimpleNamespace(
        id=uuid4(),
        auth_id="auth0|no-mirror-yet",
        email="pending@example.com",
        roles=["client"],
        updated_at=None,
    )
    db = MagicMock()
    with patch("app.services.role_service._mirror_auth0_after_db_commit") as mock_mirror:
        updated, err = set_user_roles(db, user, ["admin"], commit=False)
    mock_mirror.assert_not_called()
    assert err is None
    assert updated.roles == ["admin"]
    db.commit.assert_not_called()
    db.flush.assert_called_once()


def test_mirror_user_roles_calls_auth0_after_commit():
    user = SimpleNamespace(
        id=uuid4(),
        auth_id="auth0|mirror-me",
        email="mirror@example.com",
        roles=["technician"],
    )
    with patch(
        "app.services.role_service._mirror_auth0_after_db_commit",
        return_value=None,
    ) as mock_mirror:
        err = mirror_user_roles(user)
    mock_mirror.assert_called_once_with("auth0|mirror-me", ["technician"])
    assert err is None
