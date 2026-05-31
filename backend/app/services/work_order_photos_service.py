"""Work order field photos (Notes tab)."""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.work_order import WorkOrder, WorkOrderPhoto
from app.services.google_drive_service import (
    build_photo_filename,
    download_drive_file_bytes,
    drive_unavailable_reason,
    save_photo_locally,
    upload_photo_to_drive,
)

logger = logging.getLogger(__name__)

MODEL_SN_TAG_LABEL = "Model SN tag"


def list_photos(db: Session, work_order_id: UUID) -> List[WorkOrderPhoto]:
    return (
        db.query(WorkOrderPhoto)
        .options(joinedload(WorkOrderPhoto.uploader))
        .filter(WorkOrderPhoto.work_order_id == work_order_id)
        .order_by(WorkOrderPhoto.created_at.desc())
        .all()
    )


def get_photo(db: Session, photo_id: UUID) -> WorkOrderPhoto:
    row = db.query(WorkOrderPhoto).filter(WorkOrderPhoto.id == photo_id).first()
    if not row:
        raise ValueError("Photo not found")
    return row


def photo_to_dict(row: WorkOrderPhoto) -> dict:
    user_name = None
    if row.uploader:
        user_name = f"{row.uploader.first_name or ''} {row.uploader.last_name or ''}".strip() or row.uploader.email
    return {
        "id": row.id,
        "work_order_id": row.work_order_id,
        "description": row.description,
        "is_model_sn_tag": row.is_model_sn_tag,
        "filename": row.filename,
        "mime_type": row.mime_type,
        "file_size": row.file_size,
        "storage_backend": row.storage_backend,
        "drive_web_view_link": row.drive_web_view_link,
        "uploaded_by": row.uploaded_by,
        "user_name": user_name,
        "created_at": row.created_at,
    }


def read_photo_bytes(row: WorkOrderPhoto) -> tuple[bytes, str]:
    mime = row.mime_type or "image/jpeg"

    if row.storage_backend == "drive" and row.drive_file_id:
        content = download_drive_file_bytes(row.drive_file_id)
        if not content:
            raise ValueError(drive_unavailable_reason() or "Could not download photo from Google Drive")
        return content, mime

    if not row.local_path:
        raise ValueError("Photo file path not found")

    path = Path(row.local_path)
    if not path.is_file():
        raise ValueError("Photo file not found on server")

    return path.read_bytes(), mime


def save_photo(
    db: Session,
    *,
    work_order_id: UUID,
    user_id: UUID,
    file_bytes: bytes,
    original_filename: str,
    mime_type: str,
    description: Optional[str] = None,
    is_model_sn_tag: bool = False,
) -> WorkOrderPhoto:
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise ValueError("Work order not found")

    if is_model_sn_tag:
        description = MODEL_SN_TAG_LABEL

    order_number = wo.order_number or str(work_order_id)[:8]
    filename = build_photo_filename(
        order_number,
        description or "",
        original_filename,
        is_model_sn_tag=is_model_sn_tag,
    )
    year = date.today().year

    drive_result = upload_photo_to_drive(
        file_bytes=file_bytes,
        filename=filename,
        mime_type=mime_type,
        order_number=order_number,
        year=year,
    )

    if drive_result:
        file_id, link, folder_id = drive_result
        logger.info("Photo %s uploaded to Google Drive for WO %s", filename, order_number)
        row = WorkOrderPhoto(
            work_order_id=work_order_id,
            description=description,
            is_model_sn_tag=is_model_sn_tag,
            filename=filename,
            mime_type=mime_type,
            file_size=len(file_bytes),
            storage_backend="drive",
            drive_file_id=file_id,
            drive_web_view_link=link,
            drive_folder_id=folder_id,
            uploaded_by=user_id,
        )
    else:
        local_path = save_photo_locally(
            file_bytes=file_bytes,
            filename=filename,
            order_number=order_number,
            year=year,
        )
        logger.info(
            "Photo %s stored locally for WO %s at %s (%s)",
            filename,
            order_number,
            local_path,
            drive_unavailable_reason(),
        )
        row = WorkOrderPhoto(
            work_order_id=work_order_id,
            description=description,
            is_model_sn_tag=is_model_sn_tag,
            filename=filename,
            mime_type=mime_type,
            file_size=len(file_bytes),
            storage_backend="local",
            local_path=local_path,
            uploaded_by=user_id,
        )

    db.add(row)
    db.commit()
    db.refresh(row)
    return (
        db.query(WorkOrderPhoto)
        .options(joinedload(WorkOrderPhoto.uploader))
        .filter(WorkOrderPhoto.id == row.id)
        .first()
    )
