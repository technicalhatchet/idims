"""Portal customer photo uploads (Wave 1C)."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from PIL import Image

from app.services.google_drive_service import build_photo_filename, photo_extension_for_upload
from app.services.work_order_photos_service import (
    CUSTOMER_MEDIA_LIMIT_MESSAGE,
    MAX_CUSTOMER_FILE_BYTES,
    MAX_CUSTOMER_FILES_PER_BATCH,
    client_owns_customer_photo,
    count_active_customer_media,
    photo_bytes_for_response,
    remove_customer_portal_media,
    strip_image_exif,
    validate_customer_media,
)


def test_build_photo_filename_keeps_video_extensions():
    name = build_photo_filename("WO1", "customer", "clip.MOV", mime_type="video/quicktime")
    assert name.lower().endswith(".mov")
    name_mp4 = build_photo_filename("WO1", "customer", "vid.mp4", mime_type="video/mp4")
    assert name_mp4.lower().endswith(".mp4")


def test_build_photo_filename_uses_mime_when_no_extension():
    assert photo_extension_for_upload("upload", "video/mp4") == ".mp4"
    assert photo_extension_for_upload("upload", "video/quicktime") == ".mov"
    name = build_photo_filename("WO1", "customer", "upload", mime_type="video/quicktime")
    assert name.endswith(".mov")


def test_build_photo_filename_never_labels_video_as_jpg():
    name = build_photo_filename("WO1", "customer", "wrong.jpg", mime_type="video/mp4")
    assert name.lower().endswith(".mp4")
    assert not name.lower().endswith(".jpg")


def test_photo_bytes_for_response_thumbnail_smaller():
    from io import BytesIO

    from PIL import Image

    img = Image.new("RGB", (400, 200), color=(0, 128, 255))
    buf = BytesIO()
    img.save(buf, format="JPEG")
    full = buf.getvalue()
    thumb, mime = photo_bytes_for_response(full, "image/jpeg", thumbnail_max_px=80)
    assert mime == "image/jpeg"
    out = Image.open(BytesIO(thumb))
    assert max(out.size) <= 80


def test_rejects_oversize():
    with pytest.raises(ValueError, match="25 MB"):
        validate_customer_media(b"x" * (MAX_CUSTOMER_FILE_BYTES + 1), "image/jpeg")


def test_rejects_unknown_mime():
    with pytest.raises(ValueError, match="Unsupported"):
        validate_customer_media(b"abc", "application/pdf")


def test_strip_image_exif_applies_orientation_6():
    """EXIF orientation 6: stored landscape, displayed portrait after transpose."""
    img = Image.new("RGB", (200, 100), color=(255, 0, 0))
    buf = BytesIO()
    exif = img.getexif()
    exif[274] = 6  # Orientation
    img.save(buf, format="JPEG", exif=exif.tobytes())
    raw = buf.getvalue()

    out = strip_image_exif(raw, "image/jpeg")
    result = Image.open(BytesIO(out))
    assert result.size == (100, 200)
    assert not result.getexif()


def test_count_active_customer_media_excludes_removed():
    db = MagicMock()
    db.query.return_value.filter.return_value.filter.return_value.count.return_value = 2
    assert count_active_customer_media(db, uuid4()) == 2


def test_client_owns_customer_photo_by_login():
    login_id = uuid4()
    user_id = uuid4()
    row = SimpleNamespace(
        source="customer",
        removed_at=None,
        client_login_id=login_id,
        uploaded_by=user_id,
    )
    assert client_owns_customer_photo(row, client_user_id=user_id, client_login_id=login_id)
    assert not client_owns_customer_photo(row, client_user_id=user_id, client_login_id=uuid4())


def test_remove_customer_portal_media_sets_removed_at_and_trashes_drive():
    db = MagicMock()
    row = SimpleNamespace(
        source="customer",
        removed_at=None,
        storage_backend="drive",
        drive_file_id="drive-123",
        local_path=None,
    )
    with patch("app.services.work_order_photos_service.trash_drive_file", return_value=True) as trash:
        remove_customer_portal_media(db, row)
        trash.assert_called_once_with("drive-123")
    assert row.removed_at is not None
    db.add.assert_called_once_with(row)


@pytest.mark.asyncio
async def test_upload_portal_photos_uses_login_for_actions_and_admin_uploader():
    from app.routers.client_portal import upload_portal_work_order_photos

    client = SimpleNamespace(id=uuid4(), user_id=uuid4())
    admin_user = SimpleNamespace(id=uuid4())
    wo = SimpleNamespace(id=uuid4(), client_id=client.id)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = wo

    token_data = SimpleNamespace(sub="auth0|admin")

    class Upload:
        filename = "a.jpg"
        content_type = "image/jpeg"

        async def read(self):
            return b"fake-jpeg-bytes"

    with patch("app.routers.client_portal._resolve_portal_media_uploader_id", return_value=admin_user.id):
        with patch(
            "app.services.work_order_photos_service.count_active_customer_media",
            return_value=0,
        ):
            with patch(
                "app.services.work_order_photos_service.save_customer_portal_media",
                return_value=SimpleNamespace(id=uuid4()),
            ) as save:
                with patch(
                    "app.services.work_order_photos_service.photo_to_dict",
                    return_value={"id": "x"},
                ):
                    result = await upload_portal_work_order_photos(
                        work_order_id=str(wo.id),
                        background_tasks=MagicMock(),
                        files=[Upload()],
                        client=client,
                        login=None,
                        token_data=token_data,
                        db=db,
                        _write_guard=None,
                    )

    assert result["items"]
    save.assert_called_once()
    kwargs = save.call_args.kwargs
    assert kwargs["uploaded_by_user_id"] == admin_user.id
    assert kwargs["client_login_id"] is None


def test_customer_media_limit_message():
    assert "6 photos or videos" in CUSTOMER_MEDIA_LIMIT_MESSAGE
    assert MAX_CUSTOMER_FILES_PER_BATCH == 6
