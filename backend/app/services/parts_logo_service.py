"""Store and serve parts lookup provider logos."""
from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile, status

PARTS_LOGOS_DIR = Path("static") / "parts-logos"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
}
MAX_LOGO_BYTES = 2 * 1024 * 1024


def _sanitize_provider_id(provider_id: Optional[str]) -> str:
    if not provider_id:
        return ""
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", provider_id.strip())
    return cleaned[:40]


def ensure_parts_logos_dir() -> Path:
    PARTS_LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    return PARTS_LOGOS_DIR


async def save_parts_lookup_logo(
    file: UploadFile,
    *,
    provider_id: Optional[str] = None,
) -> dict:
    """Save an uploaded logo and return its public static path."""
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo file is required",
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logo must be one of: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo must be an image file (PNG, JPG, WebP, or SVG)",
        )

    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo file is empty",
        )
    if len(data) > MAX_LOGO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo must be 2 MB or smaller",
        )

    prefix = _sanitize_provider_id(provider_id) or "provider"
    filename = f"{prefix}_{uuid.uuid4().hex[:10]}{ext}"
    dest_dir = ensure_parts_logos_dir()
    dest_path = dest_dir / filename
    dest_path.write_bytes(data)

    logo_path = f"/static/parts-logos/{filename}"
    return {
        "logoPath": logo_path,
        "filename": filename,
    }
