"""Feature flag service and route guards."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services.feature_flags_service import (
    FeatureContext,
    default_feature_flags,
    feature_enabled,
    invalidate_feature_flags_cache,
    require_feature,
    validate_feature_flags_value,
)


@pytest.fixture(autouse=True)
def _clear_feature_cache():
    invalidate_feature_flags_cache()
    yield
    invalidate_feature_flags_cache()


def test_defaults_all_enabled():
    flags = default_feature_flags()
    assert flags["estimate_approval"]["enabled"] is True
    assert flags["self_signup"]["admin_only"] is False


def test_validate_rejects_unknown_flag():
    with pytest.raises(ValueError, match="Unknown feature flag"):
        validate_feature_flags_value({"not_a_flag": {"enabled": True}})


def test_feature_disabled_blocks():
    db = MagicMock()
    with patch(
        "app.services.feature_flags_service.get_feature_flags_cached",
        return_value={"review_requests": {"enabled": False, "admin_only": False}},
    ):
        assert feature_enabled(db, "review_requests", FeatureContext()) is False


def test_admin_only_hides_from_customer():
    db = MagicMock()
    with patch(
        "app.services.feature_flags_service.get_feature_flags_cached",
        return_value={"estimate_approval": {"enabled": True, "admin_only": True}},
    ):
        assert feature_enabled(db, "estimate_approval", FeatureContext(roles=["client"])) is False
        assert feature_enabled(
            db, "estimate_approval", FeatureContext(roles=["admin"])
        ) is True


def test_require_feature_raises_404():
    db = MagicMock()
    with patch(
        "app.services.feature_flags_service.get_feature_flags_cached",
        return_value={"household_invites": {"enabled": False, "admin_only": False}},
    ):
        with pytest.raises(HTTPException) as exc:
            require_feature(db, "household_invites", FeatureContext())
        assert exc.value.status_code == 404
