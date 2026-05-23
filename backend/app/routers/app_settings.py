"""
Settings router for application-wide configuration
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.db.database import get_db
from app.core.dependencies import get_admin_or_manager_user
from app.models.user import User
from app.services.settings_service import SettingsService
from app.schemas.settings import (
    SettingResponse,
    SettingCreate,
    SettingUpdate,
    SettingsListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("", response_model=SettingsListResponse)
@router.get("/", response_model=SettingsListResponse, include_in_schema=False)
async def get_all_settings(
    db: Session = Depends(get_db),
):
    """
    Get all application settings.
    Public endpoint - settings are cached and used throughout the app.
    Sensitive settings should never be stored here.
    """
    try:
        settings = await SettingsService.get_all_settings(db)
        return SettingsListResponse(settings=settings)
    except Exception as e:
        logger.error(f"Error retrieving settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving settings: {str(e)}"
        )

@router.get("/{key}", response_model=SettingResponse)
async def get_setting(
    key: str,
    db: Session = Depends(get_db),
):
    """
    Get a specific setting by key.
    """
    try:
        setting = await SettingsService.get_setting(db, key)
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting '{key}' not found"
            )
        return setting
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving setting '{key}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving setting: {str(e)}"
        )

@router.post("/", response_model=SettingResponse, status_code=status.HTTP_201_CREATED)
async def create_setting(
    setting_data: SettingCreate,
    current_user: User = Depends(get_admin_or_manager_user),
    db: Session = Depends(get_db),
):
    """
    Create a new setting.
    Only admins and managers can create settings.
    """
    try:
        setting = await SettingsService.create_setting(
            db, 
            setting_data, 
            current_user.id
        )
        return setting
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating setting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating setting: {str(e)}"
        )

@router.patch("/{key}", response_model=SettingResponse)
async def update_setting(
    key: str,
    setting_update: SettingUpdate,
    current_user: User = Depends(get_admin_or_manager_user),
    db: Session = Depends(get_db),
):
    """
    Update an existing setting.
    Only admins and managers can update settings.
    Invalidates cache on update.
    """
    try:
        setting = await SettingsService.update_setting(
            db, 
            key, 
            setting_update.value, 
            current_user.id
        )
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting '{key}' not found"
            )
        return setting
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating setting '{key}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating setting: {str(e)}"
        )

@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setting(
    key: str,
    current_user: User = Depends(get_admin_or_manager_user),
    db: Session = Depends(get_db),
):
    """
    Delete a setting.
    Only admins and managers can delete settings.
    Use with caution - this will affect application behavior.
    """
    try:
        deleted = await SettingsService.delete_setting(db, key)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting '{key}' not found"
            )
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting setting '{key}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting setting: {str(e)}"
        )

@router.post("/cache/invalidate", status_code=status.HTTP_204_NO_CONTENT)
async def invalidate_settings_cache(
    current_user: User = Depends(get_admin_or_manager_user),
):
    """
    Manually invalidate the settings cache.
    Useful for troubleshooting or after bulk updates.
    """
    try:
        await SettingsService.invalidate_cache()
        logger.info(f"Settings cache invalidated by user {current_user.id}")
        return None
    except Exception as e:
        logger.error(f"Error invalidating settings cache: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error invalidating cache: {str(e)}"
        )
