"""Celery worker feature flags default off."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.worker_feature_flags_service import (
    default_worker_feature_flags,
    invalidate_worker_feature_flags_cache,
    validate_worker_feature_flags_value,
    worker_feature_enabled,
)


@pytest.fixture(autouse=True)
def _clear_worker_flag_cache():
    invalidate_worker_feature_flags_cache()
    yield
    invalidate_worker_feature_flags_cache()


def test_defaults_all_disabled():
    flags = default_worker_feature_flags()
    assert all(not row["enabled"] for row in flags.values())


def test_worker_flag_off_exits_quietly():
    db = MagicMock()
    with patch(
        "app.services.worker_feature_flags_service.get_worker_feature_flags_cached",
        return_value={"deploy_reminders": {"enabled": False}},
    ):
        assert worker_feature_enabled(db, "deploy_reminders") is False


def test_validate_rejects_unknown_flag():
    with pytest.raises(ValueError, match="Unknown worker feature flag"):
        validate_worker_feature_flags_value({"not_real": {"enabled": True}})


def test_push_task_returns_zero_when_flag_off():
    from app.background.tasks.push import process_deploy_reminders

    db = MagicMock()
    with patch("app.background.tasks.push.SessionLocal", return_value=db):
        with patch(
            "app.services.worker_feature_flags_service.worker_feature_enabled",
            return_value=False,
        ):
            assert process_deploy_reminders() == 0
