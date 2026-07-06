"""
Settings router for application-wide configuration and user preferences
"""

import copy
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.core.dependencies import get_admin_or_manager_user
from app.core.auth import AuthHandler, get_auth_handler
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


# ── User Preferences ──────────────────────────────────────────────────────────

class UIPreferences(BaseModel):
    """Schema for UI preferences"""
    railPosition: Optional[str] = None  # 'left' | 'right'

class UserPreferencesUpdate(BaseModel):
    """Schema for updating user preferences"""
    ui_preferences: Optional[UIPreferences] = None

class UserPreferencesResponse(BaseModel):
    """Schema for user preferences response"""
    ui_preferences: Optional[Dict[str, Any]] = None


@router.get("/user", response_model=UserPreferencesResponse)
async def get_user_settings(
    request: Request,
    auth_handler: AuthHandler = Depends(get_auth_handler),
    db: Session = Depends(get_db),
):
    """
    Get the current user's preferences.
    """
    auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    token = auth_header.replace('Bearer ', '')
    
    try:
        user = await auth_handler.get_current_user(token)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        # Always query fresh from current session
        user_auth_id = getattr(user, 'auth_id', None) or getattr(user, 'sub', None)
        db_user = db.query(User).filter(User.auth_id == user_auth_id).first()
        
        if not db_user:
            # Return empty preferences if user not in DB yet
            return UserPreferencesResponse(ui_preferences={})
        
        preferences = db_user.preferences or {}
        return UserPreferencesResponse(
            ui_preferences=preferences.get('ui_preferences', {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving user settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving user settings: {str(e)}"
        )


@router.put("/user", response_model=UserPreferencesResponse)
async def update_user_settings(
    update_data: UserPreferencesUpdate,
    request: Request,
    auth_handler: AuthHandler = Depends(get_auth_handler),
    db: Session = Depends(get_db),
):
    """
    Update the current user's preferences.
    """
    auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    token = auth_header.replace('Bearer ', '')
    
    try:
        user = await auth_handler.get_current_user(token)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        # Always query fresh from current session to avoid detached instance errors
        user_auth_id = getattr(user, 'auth_id', None) or getattr(user, 'sub', None)
        db_user = db.query(User).filter(User.auth_id == user_auth_id).first()
        
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Merge with existing preferences
        # IMPORTANT: Make a copy to ensure SQLAlchemy detects the change
        current_prefs = copy.deepcopy(db_user.preferences) if db_user.preferences else {}
        
        if update_data.ui_preferences:
            ui_prefs = current_prefs.get('ui_preferences', {})
            # Update only provided fields
            if update_data.ui_preferences.railPosition is not None:
                ui_prefs['railPosition'] = update_data.ui_preferences.railPosition
            current_prefs['ui_preferences'] = ui_prefs
        
        # Save to database - assign new dict so SQLAlchemy detects the change
        db_user.preferences = current_prefs
        db.commit()
        db.refresh(db_user)
        
        logger.info(f"Updated preferences for user {db_user.id}: {db_user.preferences}")
        
        return UserPreferencesResponse(
            ui_preferences=current_prefs.get('ui_preferences', {})
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user settings: {str(e)}"
        )

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

@router.post("", response_model=SettingResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
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


# ── Zone/Trip Charge Endpoints ───────────────────────────────────────────────

from app.services.zone_service import ZoneService


class ZoneLookupRequest(BaseModel):
    """Request schema for zone lookup"""
    zipCode: Optional[str] = None
    driveTimeMinutes: Optional[float] = None
    address: Optional[str] = None


class ZoneLookupResponse(BaseModel):
    """Response schema for zone lookup"""
    zoneKey: str
    zoneName: str
    tripCharge: Optional[float]
    method: str
    driveTimeMinutes: Optional[float] = None
    color: Optional[str] = None
    isCustom: bool = False


@router.get("/zones/config")
async def get_zone_config(
    db: Session = Depends(get_db),
):
    """
    Get the full zone configuration.
    """
    try:
        zone_service = ZoneService(db)
        return zone_service.get_all_zones()
    except Exception as e:
        logger.error(f"Error retrieving zone config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving zone config: {str(e)}"
        )


@router.post("/zones/lookup", response_model=ZoneLookupResponse)
async def lookup_zone(
    request: ZoneLookupRequest,
    db: Session = Depends(get_db),
):
    """
    Determine the service zone for a given location.
    
    Provide either:
    - zipCode: For explicit zip code mapping
    - driveTimeMinutes: For drive time-based lookup (if already calculated)
    - Both: Zip code is checked first, then drive time fallback
    """
    try:
        zone_service = ZoneService(db)
        result = zone_service.determine_zone(
            zip_code=request.zipCode,
            drive_time_minutes=request.driveTimeMinutes,
            address=request.address
        )
        return ZoneLookupResponse(**result)
    except Exception as e:
        logger.error(f"Error looking up zone: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error looking up zone: {str(e)}"
        )


# ── County Tax Endpoints ───────────────────────────────────────────────────────

from app.services.tax_service import TaxService


class TaxLookupRequest(BaseModel):
    address: Optional[str] = None
    zipCode: Optional[str] = None


class TaxLookupResponse(BaseModel):
    rate: float
    countyKey: str
    countyName: str
    zipCode: Optional[str] = None
    method: str


@router.get("/tax/config")
async def get_tax_config(
    db: Session = Depends(get_db),
):
    """Get county tax jurisdiction configuration."""
    try:
        tax_service = TaxService(db)
        return tax_service.get_all_jurisdictions()
    except Exception as e:
        logger.error(f"Error retrieving tax config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving tax config: {str(e)}"
        )


@router.get("/parts/config")
async def get_parts_config(
    db: Session = Depends(get_db),
):
    """Get parts tab configuration (vendors + lookup providers)."""
    try:
        from app.services.parts_settings_service import PartsSettingsService

        return PartsSettingsService(db).get_settings()
    except Exception as e:
        logger.error(f"Error retrieving parts config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving parts config: {str(e)}"
        )


@router.post("/parts/logo")
async def upload_parts_lookup_logo(
    file: UploadFile = File(...),
    provider_id: Optional[str] = Form(None),
    current_user: User = Depends(get_admin_or_manager_user),
):
    """Upload a logo image for a parts lookup provider (admin/manager)."""
    try:
        from app.services.parts_logo_service import save_parts_lookup_logo

        return await save_parts_lookup_logo(file, provider_id=provider_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading parts logo: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading parts logo: {str(e)}"
        )


@router.post("/tax/lookup", response_model=TaxLookupResponse)
async def lookup_tax_rate(
    request: TaxLookupRequest,
    db: Session = Depends(get_db),
):
    """Resolve sales tax rate for an address or zip code."""
    try:
        tax_service = TaxService(db)
        result = tax_service.resolve_tax_rate(
            address=request.address,
            zip_code=request.zipCode,
        )
        return TaxLookupResponse(**result)
    except Exception as e:
        logger.error(f"Error looking up tax rate: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error looking up tax rate: {str(e)}"
        )


# ── Portal self-scheduling config ────────────────────────────────────────────

from app.services.portal_scheduling_settings_service import (
    default_portal_scheduling,
    get_portal_scheduling_settings,
)


@router.get("/portal-scheduling/config")
async def get_portal_scheduling_config(
    db: Session = Depends(get_db),
):
    """
    Portal scheduling settings (defaults merged with DB).
    Used by settings UI and client portal scheduling flows.
    """
    try:
        return get_portal_scheduling_settings(db)
    except Exception as e:
        logger.error(f"Error retrieving portal scheduling config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving portal scheduling config: {str(e)}",
        )


@router.get("/portal-scheduling/defaults")
async def get_portal_scheduling_defaults():
    """Factory defaults for portal scheduling (no DB)."""
    return default_portal_scheduling()
