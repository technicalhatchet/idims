"""Work order photo Drive folder reuse and WO year."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.work_order_photos_service import (
    existing_work_order_drive_folder_id,
    work_order_photo_year,
)


def test_work_order_photo_year_uses_created_at():
    wo = SimpleNamespace(created_at=datetime(2025, 6, 1, tzinfo=timezone.utc))
    assert work_order_photo_year(wo) == 2025


def test_existing_drive_folder_id_from_prior_photo():
    db = MagicMock()
    prior = MagicMock()
    prior.drive_folder_id = "folder-abc"
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = prior
    folder = existing_work_order_drive_folder_id(db, uuid4())
    assert folder == "folder-abc"

