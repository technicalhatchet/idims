from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.feature_flags_service import default_feature_flags
from app.services.maintenance_service import (
    DUE_SOON_DAYS,
    add_months,
    client_email_allowed_this_month,
    is_actionable_due,
)
from app.services.maintenance_unsubscribe_token import (
    create_maintenance_unsubscribe_token,
    verify_maintenance_unsubscribe_token,
)
from app.services.worker_feature_flags_service import default_worker_feature_flags


def test_add_months_end_of_month():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)


def test_maintenance_reminders_flag_defaults():
    flags = default_feature_flags()
    assert flags["maintenance_reminders"]["enabled"] is True
    assert flags["maintenance_reminders"]["admin_only"] is True


def test_worker_maintenance_email_flag_defaults_off():
    flags = default_worker_feature_flags()
    assert flags["maintenance_reminder_emails"]["enabled"] is False


def test_unsubscribe_token_roundtrip():
    client_id = uuid4()
    token = create_maintenance_unsubscribe_token(client_id)
    assert verify_maintenance_unsubscribe_token(token) == client_id
    assert verify_maintenance_unsubscribe_token(token + "x") is None


def test_client_email_allowed_once_per_month():
    client = SimpleNamespace(last_maintenance_email_at=datetime(2026, 3, 15, 12, 0, 0))
    assert client_email_allowed_this_month(client, datetime(2026, 3, 20)) is False
    assert client_email_allowed_this_month(client, datetime(2026, 4, 1)) is True
    client.last_maintenance_email_at = None
    assert client_email_allowed_this_month(client) is True


def test_materialize_anchor_never_overdue_on_day_one():
    today = date.today()
    next_due = add_months(today, 12)
    assert next_due > today


def test_due_soon_window_constant():
    assert DUE_SOON_DAYS == 14


def test_snoozed_task_not_actionable():
    today = date.today()
    row = SimpleNamespace(
        next_due_at=today - timedelta(days=1),
        snoozed_until=today + timedelta(days=20),
        disabled_at=None,
        definition=SimpleNamespace(interval_months=3, enabled=True),
    )
    assert is_actionable_due(row, today) is False


@patch("app.services.maintenance_reminder_email_service.automatic_outreach_allowed", return_value=False)
def test_email_skipped_in_test_mode(_mock):
    from app.services.maintenance_reminder_email_service import send_maintenance_summary_for_client

    db = MagicMock()
    client_id = uuid4()
    client = SimpleNamespace(
        id=client_id,
        email="a@example.com",
        maintenance_emails_opt_out=False,
        first_name="A",
        last_name="B",
    )
    db.query.return_value.filter.return_value.first.return_value = client
    import asyncio

    assert asyncio.run(send_maintenance_summary_for_client(db, client_id)) is False
