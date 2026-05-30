"""Upload receipts to Google Drive (optional) with local fallback."""

from __future__ import annotations

import io
import json
import logging
import re
from datetime import date
from pathlib import Path
from typing import Optional, Tuple

from app.config import settings

logger = logging.getLogger(__name__)

_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def _sanitize_filename_part(value: str, fallback: str = "file") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", (value or "").strip()).strip("-")
    return (cleaned or fallback)[:80]


def build_receipt_filename(
    order_number: str,
    category: str,
    vendor: str,
    expense_date: date,
    original_filename: str,
) -> str:
    ext = Path(original_filename or "receipt.jpg").suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".pdf", ".webp", ".heic"}:
        ext = ".jpg"
    return (
        f"{_sanitize_filename_part(order_number, 'WO')}_"
        f"{_sanitize_filename_part(category, 'misc')}_"
        f"{_sanitize_filename_part(vendor, 'vendor')}_"
        f"{expense_date.isoformat()}{ext}"
    )


def is_drive_configured() -> bool:
    return bool(settings.GOOGLE_DRIVE_ROOT_FOLDER_ID and _drive_credentials())


def drive_unavailable_reason() -> str:
    if not settings.GOOGLE_DRIVE_ROOT_FOLDER_ID:
        return "GOOGLE_DRIVE_ROOT_FOLDER_ID is not set"
    if not _drive_credentials():
        return "Google Drive credentials missing or invalid (check GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON)"
    return "Google Drive client could not be initialized"


def _drive_credentials():
    raw = settings.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
    if raw:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.error("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not valid JSON")
            return None
    path = settings.GOOGLE_DRIVE_CREDENTIALS_PATH
    if path and Path(path).is_file():
        try:
            return json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            logger.error("Failed to read Google Drive credentials file: %s", exc)
    return None


def _drive_service():
    creds_info = _drive_credentials()
    if not creds_info:
        return None
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        credentials = service_account.Credentials.from_service_account_info(
            creds_info, scopes=_DRIVE_SCOPES
        )
        return build("drive", "v3", credentials=credentials, cache_discovery=False)
    except Exception as exc:
        logger.error("Google Drive client init failed: %s", exc)
        return None


def _ensure_folder(service, parent_id: str, name: str) -> Optional[str]:
    safe_name = _sanitize_filename_part(name.replace("/", "-"), "folder")
    query = (
        f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' "
        f"and name='{safe_name}' and trashed=false"
    )
    result = service.files().list(q=query, fields="files(id,name)", pageSize=1).execute()
    files = result.get("files") or []
    if files:
        return files[0]["id"]
    created = (
        service.files()
        .create(
            body={"name": safe_name, "mimeType": "application/vnd.google-apps.folder", "parents": [parent_id]},
            fields="id",
        )
        .execute()
    )
    return created.get("id")


def upload_receipt_to_drive(
    *,
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    order_number: str,
    year: int,
) -> Optional[Tuple[str, str, str]]:
    """
    Returns (file_id, web_view_link, folder_id) or None if Drive unavailable.
    Folder layout: {root}/{year}/{order_number}/
    """
    if not is_drive_configured():
        return None

    service = _drive_service()
    if not service:
        return None

    root_id = settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
    year_folder = _ensure_folder(service, root_id, str(year))
    if not year_folder:
        return None
    wo_folder = _ensure_folder(service, year_folder, order_number)
    if not wo_folder:
        return None

    media = io.BytesIO(file_bytes)
    try:
        from googleapiclient.http import MediaIoBaseUpload

        media_upload = MediaIoBaseUpload(
            media, mimetype=mime_type or "application/octet-stream", resumable=True
        )
    except ImportError:
        media_upload = media

    created = (
        service.files()
        .create(
            body={"name": filename, "parents": [wo_folder]},
            media_body=media_upload,
            fields="id, webViewLink",
        )
        .execute()
    )
    file_id = created.get("id")
    link = created.get("webViewLink")
    if not file_id:
        return None
    return file_id, link, wo_folder


def save_receipt_locally(
    *,
    file_bytes: bytes,
    filename: str,
    order_number: str,
    year: int,
) -> str:
    base = Path(settings.LOCAL_STORAGE_PATH) / "receipts" / str(year) / _sanitize_filename_part(order_number, "wo")
    base.mkdir(parents=True, exist_ok=True)
    target = base / filename
    target.write_bytes(file_bytes)
    return str(target)
