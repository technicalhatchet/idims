"""Upload receipts to Google Drive (optional) with local fallback.

Personal Gmail: use OAuth refresh token (service accounts have no My Drive quota).
Google Workspace shared drives: service account JSON may work instead.
"""

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
_TOKEN_URI = "https://oauth2.googleapis.com/token"


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


def _oauth_configured() -> bool:
    return bool(
        settings.GOOGLE_DRIVE_OAUTH_CLIENT_ID
        and settings.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
        and settings.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN
    )


def _service_account_info():
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


def drive_storage_status() -> dict:
    """Non-secret diagnostic for admins — explains why Drive may be skipped."""
    oauth = _oauth_configured()
    sa = bool(_service_account_info())
    root = bool(settings.GOOGLE_DRIVE_ROOT_FOLDER_ID)

    if not root:
        return {
            "ready": False,
            "auth_mode": None,
            "root_folder_set": False,
            "oauth_configured": oauth,
            "service_account_configured": sa,
            "message": "Set GOOGLE_DRIVE_ROOT_FOLDER_ID to a folder in your personal Drive.",
        }

    if oauth:
        creds = _oauth_credentials()
        if creds:
            return {
                "ready": True,
                "auth_mode": "oauth",
                "root_folder_set": True,
                "oauth_configured": True,
                "service_account_configured": sa,
                "message": "Google Drive ready (OAuth). New receipts upload to your Drive folder.",
            }
        return {
            "ready": False,
            "auth_mode": "oauth",
            "root_folder_set": True,
            "oauth_configured": True,
            "service_account_configured": sa,
            "message": "OAuth env vars are set but token refresh failed. Regenerate GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN.",
        }

    if sa:
        return {
            "ready": False,
            "auth_mode": "service_account",
            "root_folder_set": True,
            "oauth_configured": False,
            "service_account_configured": True,
            "message": (
                "Service account cannot upload to personal Gmail (no storage quota). "
                "Remove GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON and set GOOGLE_DRIVE_OAUTH_* instead."
            ),
        }

    return {
        "ready": False,
        "auth_mode": None,
        "root_folder_set": True,
        "oauth_configured": False,
        "service_account_configured": False,
        "message": "No Drive credentials on server — receipts are stored on Railway disk only.",
    }


def log_drive_status_on_startup() -> None:
    status = drive_storage_status()
    level = logging.INFO if status["ready"] else logging.WARNING
    logger.log(level, "Google Drive receipts: %s", status["message"])


def is_drive_configured() -> bool:
    if not settings.GOOGLE_DRIVE_ROOT_FOLDER_ID:
        return False
    return _oauth_configured() or bool(_service_account_info())


def drive_unavailable_reason() -> str:
    if not settings.GOOGLE_DRIVE_ROOT_FOLDER_ID:
        return "GOOGLE_DRIVE_ROOT_FOLDER_ID is not set"
    if _oauth_configured():
        return "Google Drive OAuth credentials present but client init failed"
    if _service_account_info():
        return (
            "Service account configured — personal Gmail needs OAuth "
            "(GOOGLE_DRIVE_OAUTH_* env vars); service accounts only work with Workspace shared drives"
        )
    return "Set GOOGLE_DRIVE_OAUTH_* (personal Drive) or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON (Workspace shared drive)"


def _oauth_credentials():
    if not _oauth_configured():
        return None
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials

        creds = Credentials(
            token=None,
            refresh_token=settings.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
            token_uri=_TOKEN_URI,
            client_id=settings.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
            client_secret=settings.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
            scopes=_DRIVE_SCOPES,
        )
        creds.refresh(Request())
        return creds
    except Exception as exc:
        logger.error("Google Drive OAuth refresh failed: %s", exc)
        return None


def _service_account_credentials():
    creds_info = _service_account_info()
    if not creds_info:
        return None
    try:
        from google.oauth2 import service_account

        return service_account.Credentials.from_service_account_info(
            creds_info, scopes=_DRIVE_SCOPES
        )
    except Exception as exc:
        logger.error("Google Drive service account init failed: %s", exc)
        return None


def _drive_service():
    """Prefer OAuth (personal Drive quota); fall back to service account."""
    credentials = _oauth_credentials() or _service_account_credentials()
    if not credentials:
        return None
    try:
        from googleapiclient.discovery import build

        return build("drive", "v3", credentials=credentials, cache_discovery=False)
    except Exception as exc:
        logger.error("Google Drive client init failed: %s", exc)
        return None


def _ensure_folder(service, parent_id: str, name: str) -> Optional[str]:
    from googleapiclient.errors import HttpError

    safe_name = _sanitize_filename_part(name.replace("/", "-"), "folder")
    query = (
        f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' "
        f"and name='{safe_name}' and trashed=false"
    )
    try:
        result = service.files().list(q=query, fields="files(id,name)", pageSize=1).execute()
        files = result.get("files") or []
        if files:
            return files[0]["id"]
        created = (
            service.files()
            .create(
                body={
                    "name": safe_name,
                    "mimeType": "application/vnd.google-apps.folder",
                    "parents": [parent_id],
                },
                fields="id",
            )
            .execute()
        )
        return created.get("id")
    except HttpError as exc:
        logger.error("Google Drive folder create/list failed: %s", exc)
        return None


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

    try:
        from googleapiclient.errors import HttpError
        from googleapiclient.http import MediaIoBaseUpload

        media_upload = MediaIoBaseUpload(
            io.BytesIO(file_bytes),
            mimetype=mime_type or "application/octet-stream",
            resumable=True,
        )
        created = (
            service.files()
            .create(
                body={"name": filename, "parents": [wo_folder]},
                media_body=media_upload,
                fields="id, webViewLink",
            )
            .execute()
        )
    except HttpError as exc:
        logger.error(
            "Google Drive upload failed for %s: %s — personal Gmail requires OAuth, not service account",
            filename,
            exc,
        )
        return None
    except Exception as exc:
        logger.error("Google Drive upload failed for %s: %s", filename, exc)
        return None

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
