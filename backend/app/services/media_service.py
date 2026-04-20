from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime

from app.models.media import Media, MediaType
from app.schemas.media import MediaCreate, MediaUpdate
from app.core.exceptions import NotFoundException, ValidationException
from app.services.storage_service import StorageService

class MediaService:
    """Service for handling media operations"""

    @staticmethod
    async def create_media(
        db: Session,
        media_data: MediaCreate,
        uploaded_by: UUID
    ) -> Media:
        """Create a new media record"""
        # Save the file to storage
        file_path = await StorageService.save_file(
            media_data.file,
            media_data.media_type.value
        )

        # Create media record
        db_media = Media(
            filename=media_data.filename,
            file_type=media_data.file_type,
            file_size=media_data.file_size,
            media_type=media_data.media_type,
            reference_id=media_data.reference_id,
            description=media_data.description,
            file_path=file_path,
            uploaded_by=uploaded_by
        )

        db.add(db_media)
        db.commit()
        db.refresh(db_media)
        return db_media

    @staticmethod
    async def get_media(db: Session, media_id: UUID) -> Media:
        """Get a media record by ID"""
        media = db.query(Media).filter(Media.id == media_id).first()
        if not media:
            raise NotFoundException(f"Media with ID {media_id} not found")
        return media

    @staticmethod
    async def update_media(
        db: Session,
        media_id: UUID,
        media_data: MediaUpdate
    ) -> Media:
        """Update a media record"""
        media = await MediaService.get_media(db, media_id)
        
        # Update fields
        for field, value in media_data.dict(exclude_unset=True).items():
            setattr(media, field, value)
        
        media.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(media)
        return media

    @staticmethod
    async def delete_media(db: Session, media_id: UUID) -> bool:
        """Delete a media record and its file"""
        media = await MediaService.get_media(db, media_id)
        
        # Delete file from storage
        await StorageService.delete_file(media.file_path)
        
        # Delete database record
        db.delete(media)
        db.commit()
        return True

    @staticmethod
    async def get_media_by_reference(
        db: Session,
        media_type: MediaType,
        reference_id: UUID
    ) -> List[Media]:
        """Get all media records for a specific reference"""
        return db.query(Media).filter(
            Media.media_type == media_type,
            Media.reference_id == reference_id
        ).all()

    @staticmethod
    async def move_media(
        db: Session,
        media_id: UUID,
        new_media_type: MediaType,
        new_reference_id: UUID
    ) -> Media:
        """Move a media record to a different reference"""
        media = await MediaService.get_media(db, media_id)
        
        # Update media type and reference
        media.media_type = new_media_type
        media.reference_id = new_reference_id
        media.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(media)
        return media

    @staticmethod
    async def get_media_metadata(db: Session, media_id: UUID) -> Dict[str, Any]:
        """Get metadata about a media file"""
        media = await MediaService.get_media(db, media_id)
        
        return {
            "id": media.id,
            "filename": media.filename,
            "file_type": media.file_type,
            "file_size": media.file_size,
            "media_type": media.media_type,
            "reference_id": media.reference_id,
            "description": media.description,
            "created_at": media.created_at,
            "updated_at": media.updated_at,
            "uploaded_by": media.uploaded_by
        } 