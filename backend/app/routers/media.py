from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Path as FastAPIPath, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
import os
import shutil
from pathlib import Path
from datetime import datetime

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.config import settings
from app.core.exceptions import NotFoundException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

# Ensure storage directories exist
STORAGE_DIR = Path(settings.LOCAL_STORAGE_PATH)
UPLOADS_DIR = STORAGE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/media/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    related_type: Optional[str] = Form(None, description="Type of related entity: work_order, client, invoice, etc."),
    related_id: Optional[str] = Form(None, description="ID of related entity"),
    description: Optional[str] = Form(None, description="Description of the file"),
    is_public: bool = Form(False, description="If true, file is publicly accessible"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a file to the system.
    All authenticated users can upload files.
    """
    try:
        # Generate a unique file identifier
        file_uuid = str(uuid.uuid4())
        
        # Get original filename and extension
        original_filename = file.filename
        file_extension = os.path.splitext(original_filename)[1].lower() if original_filename else ""
        
        # Determine storage directory based on related type
        if related_type:
            storage_path = UPLOADS_DIR / related_type
        else:
            storage_path = UPLOADS_DIR / "general"
        
        storage_path.mkdir(exist_ok=True)
        
        # Create final storage path with UUID to prevent filename collisions
        final_filename = f"{file_uuid}{file_extension}"
        file_path = storage_path / final_filename
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Create a database record for the file
        # In a real implementation, you would use a Media or File model
        file_record = {
            "id": file_uuid,
            "original_filename": original_filename,
            "file_path": str(file_path.relative_to(STORAGE_DIR)),
            "file_size": os.path.getsize(file_path),
            "content_type": file.content_type,
            "related_type": related_type,
            "related_id": related_id,
            "description": description,
            "is_public": is_public,
            "created_by": str(current_user.id),
            "created_at": datetime.utcnow().isoformat(),
            "download_url": f"/api/media/{file_uuid}",
        }
        
        # You would normally save this to the database
        # media = Media(**file_record)
        # db.add(media)
        # db.commit()
        # db.refresh(media)
        
        return file_record
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading file: {str(e)}"
        )
    finally:
        file.file.close()

@router.get("/media/{file_id}")
async def get_file(
    file_id: str = FastAPIPath(..., description="ID of the file to retrieve"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a file by ID.
    Permissions depend on file access settings and user role.
    """
    try:
        # In a real implementation, you would fetch the file record from the database
        # file_record = db.query(Media).filter(Media.id == file_id).first()
        
        # For now, we'll look for the file in the uploads directory
        for subdir in UPLOADS_DIR.glob("**/"):
            for ext in [".jpg", ".jpeg", ".png", ".pdf", ".docx", ".xlsx", ".txt"]:
                file_path = subdir / f"{file_id}{ext}"
                if file_path.exists():
                    return FileResponse(
                        path=file_path,
                        filename=os.path.basename(file_path),
                        media_type=None  # Let FastAPI guess the media type
                    )
        
        raise NotFoundException(f"File with ID {file_id} not found")
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving file: {str(e)}"
        )

@router.get("/media/entity/{entity_type}/{entity_id}")
async def list_entity_files(
    entity_type: str = FastAPIPath(..., description="Type of entity: work_order, client, invoice, etc."),
    entity_id: str = FastAPIPath(..., description="ID of the entity"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all files associated with a specific entity.
    """
    try:
        # In a real implementation, you would fetch files from the database
        # files = db.query(Media).filter(
        #     Media.related_type == entity_type,
        #     Media.related_id == entity_id
        # ).all()
        
        # For now, we'll return a placeholder response
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "files": []
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing files: {str(e)}"
        )

@router.delete("/media/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: str = FastAPIPath(..., description="ID of the file to delete"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a file.
    Only managers and admins can delete files.
    """
    try:
        # In a real implementation, you would fetch the file record from the database
        # file_record = db.query(Media).filter(Media.id == file_id).first()
        # if not file_record:
        #     raise NotFoundException(f"File with ID {file_id} not found")
        
        # Find and delete the file
        found = False
        for subdir in UPLOADS_DIR.glob("**/"):
            for ext in [".jpg", ".jpeg", ".png", ".pdf", ".docx", ".xlsx", ".txt"]:
                file_path = subdir / f"{file_id}{ext}"
                if file_path.exists():
                    os.remove(file_path)
                    found = True
                    break
            if found:
                break
        
        if not found:
            raise NotFoundException(f"File with ID {file_id} not found")
        
        # Delete the database record
        # db.delete(file_record)
        # db.commit()
        
        return None
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting file: {str(e)}"
        )