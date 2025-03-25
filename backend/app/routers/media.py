from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Path as FastAPIPath, status, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
import os
import shutil
from pathlib import Path
from datetime import datetime

from app.db.database import get_db
from app.core.auth import get_auth_handler, User
from app.config import settings
from app.core.exceptions import NotFoundException, ValidationException, ConflictException
from app.models.media import Media, MediaType
from app.schemas.media import (
    MediaCreate, MediaUpdate, MediaResponse,
    MediaListResponse, MediaUploadResponse
)
from app.services.media_service import MediaService

router = APIRouter()

# Ensure storage directories exist
STORAGE_DIR = Path(settings.LOCAL_STORAGE_PATH)
UPLOADS_DIR = STORAGE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

async def get_current_user_dependency():
    """Lazy-loaded dependency for current user"""
    auth_handler = get_auth_handler()
    return await auth_handler.get_current_user()

async def get_manager_or_admin_dependency():
    """Lazy-loaded dependency for manager or admin"""
    auth_handler = get_auth_handler()
    return await auth_handler.verify_manager_or_admin()

@router.get("/media", response_model=MediaListResponse)
async def list_media(
    media_type: Optional[MediaType] = Query(None, description="Filter by media type"),
    reference_id: Optional[uuid.UUID] = Query(None, description="Filter by reference ID"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    List media files with filtering and pagination.
    """
    skip = (page - 1) * limit
    
    try:
        result = await MediaService.get_media_list(
            db=db,
            media_type=media_type,
            reference_id=reference_id,
            skip=skip,
            limit=limit
        )
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving media: {str(e)}"
        )

@router.post("/media", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
async def create_media(
    file: UploadFile = File(...),
    media_type: MediaType = Form(...),
    reference_id: Optional[uuid.UUID] = Form(None),
    description: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Upload a new media file.
    """
    try:
        # Create media data
        media_data = MediaCreate(
            file=file,
            filename=file.filename,
            file_type=file.content_type,
            file_size=0,  # Will be set by service
            media_type=media_type,
            reference_id=reference_id,
            description=description
        )
        
        return await MediaService.create_media(db, media_data, current_user.id)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating media: {str(e)}"
        )

@router.get("/media/{media_id}", response_model=MediaResponse)
async def get_media(
    media_id: uuid.UUID = FastAPIPath(..., description="The ID of the media to retrieve"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a specific media file by ID.
    """
    try:
        return await MediaService.get_media(db, media_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving media: {str(e)}"
        )

@router.put("/media/{media_id}", response_model=MediaResponse)
async def update_media(
    media_id: uuid.UUID = FastAPIPath(..., description="The ID of the media to update"),
    media_data: MediaUpdate = Body(...),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Update a media file's metadata.
    """
    try:
        return await MediaService.update_media(db, media_id, media_data)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating media: {str(e)}"
        )

@router.delete("/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    media_id: uuid.UUID = FastAPIPath(..., description="The ID of the media to delete"),
    current_user: User = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Delete a media file.
    Only managers and admins can delete media.
    """
    try:
        await MediaService.delete_media(db, media_id)
        return None
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting media: {str(e)}"
        )

@router.get("/media/{media_id}/download")
async def download_media(
    media_id: uuid.UUID = FastAPIPath(..., description="The ID of the media to download"),
    current_user: User = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Download a media file.
    """
    try:
        media = await MediaService.get_media(db, media_id)
        file_path = await StorageService.get_file_path(media.file_path)
        
        if not file_path:
            raise NotFoundException(f"File not found for media {media_id}")
        
        return FileResponse(
            path=file_path,
            filename=media.filename,
            media_type=media.file_type
        )
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error downloading media: {str(e)}"
        )