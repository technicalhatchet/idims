from typing import Optional, List
import os
import uuid
from datetime import datetime
from fastapi import UploadFile
import aiofiles
from app.config import settings

class StorageService:
    @staticmethod
    async def save_file(
        file: UploadFile,
        media_type: str,
        reference_id: Optional[uuid.UUID] = None
    ) -> str:
        """
        Save an uploaded file to the appropriate directory.
        """
        # Create directory if it doesn't exist
        upload_dir = os.path.join(settings.MEDIA_ROOT, media_type)
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        return file_path

    @staticmethod
    async def delete_file(file_path: str) -> bool:
        """
        Delete a file from storage.
        """
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
            return True
        except Exception as e:
            print(f"Error deleting file: {str(e)}")
            return False

    @staticmethod
    async def get_file_path(
        media_type: str,
        filename: str
    ) -> Optional[str]:
        """
        Get the full path for a file.
        """
        file_path = os.path.join(settings.MEDIA_ROOT, media_type, filename)
        return file_path if os.path.exists(file_path) else None

    @staticmethod
    async def list_files(
        media_type: str,
        reference_id: Optional[uuid.UUID] = None
    ) -> List[str]:
        """
        List files in a media directory.
        """
        directory = os.path.join(settings.MEDIA_ROOT, media_type)
        
        if not os.path.exists(directory):
            return []
        
        files = []
        for filename in os.listdir(directory):
            if reference_id and filename.startswith(str(reference_id)):
                files.append(filename)
            elif not reference_id:
                files.append(filename)
        
        return files

    @staticmethod
    async def move_file(
        source_path: str,
        destination_path: str
    ) -> bool:
        """
        Move a file from one location to another.
        """
        try:
            # Create destination directory if it doesn't exist
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
            
            # Move file
            os.rename(source_path, destination_path)
            return True
        except Exception as e:
            print(f"Error moving file: {str(e)}")
            return False

    @staticmethod
    async def get_file_size(file_path: str) -> Optional[int]:
        """
        Get the size of a file in bytes.
        """
        try:
            return os.path.getsize(file_path)
        except Exception:
            return None

    @staticmethod
    async def get_file_type(file_path: str) -> Optional[str]:
        """
        Get the MIME type of a file.
        """
        import mimetypes
        return mimetypes.guess_type(file_path)[0] 