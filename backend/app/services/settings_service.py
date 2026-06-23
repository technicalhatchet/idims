"""
Settings service for managing application configuration
"""

import logging
import json
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, Optional
from datetime import datetime
from uuid import UUID

from app.services.cache_service import cache_service
from app.schemas.settings import (
    SettingCreate,
    ShopHours,
    NotificationPreferences,
    validate_accent_color,
    validate_diagnostic_behavior,
    validate_invoice_terms,
)

logger = logging.getLogger(__name__)

SETTINGS_CACHE_KEY = "app:settings:all"
SETTINGS_CACHE_TTL = 3600  # 1 hour

class SettingsService:
    """Service for managing application settings with caching"""
    
    @staticmethod
    async def get_all_settings(db: Session) -> Dict[str, Any]:
        """
        Get all settings as a dict.
        Results are cached in Redis for performance.
        """
        # Try cache first
        cached = await cache_service.get(SETTINGS_CACHE_KEY)
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                logger.warning("Failed to decode cached settings, fetching from DB")
        
        # Fetch from database
        query = text("SELECT key, value FROM settings")
        result = db.execute(query).fetchall()
        
        settings = {}
        for row in result:
            key = row[0]
            value = row[1]  # Already a Python object from JSONB
            settings[key] = value
        
        # Cache for next time
        try:
            await cache_service.set(
                SETTINGS_CACHE_KEY,
                json.dumps(settings),
                ex=SETTINGS_CACHE_TTL
            )
        except Exception as e:
            logger.warning(f"Failed to cache settings: {e}")
        
        return settings
    
    @staticmethod
    async def get_setting(db: Session, key: str) -> Optional[Dict[str, Any]]:
        """Get a single setting by key"""
        query = text("SELECT key, value, description, updated_at, updated_by FROM settings WHERE key = :key")
        result = db.execute(query, {"key": key}).fetchone()
        
        if not result:
            return None
        
        return {
            "key": result[0],
            "value": result[1],
            "description": result[2],
            "updated_at": result[3],
            "updated_by": result[4],
        }
    
    @staticmethod
    async def create_setting(
        db: Session, 
        setting_data: SettingCreate, 
        user_id: UUID
    ) -> Dict[str, Any]:
        """
        Create a new setting.
        Validates value based on key type.
        """
        # Validate value based on key
        SettingsService._validate_setting_value(setting_data.key, setting_data.value)
        
        # Check if key already exists
        existing = await SettingsService.get_setting(db, setting_data.key)
        if existing:
            raise ValueError(f"Setting '{setting_data.key}' already exists")
        
        # Insert into database
        # Use CAST instead of :: to avoid SQLAlchemy parameter parsing issues
        query = text("""
            INSERT INTO settings (key, value, description, updated_by)
            VALUES (:key, CAST(:value AS jsonb), :description, :user_id)
            RETURNING key, value, description, updated_at, updated_by
        """)
        
        result = db.execute(query, {
            "key": setting_data.key,
            "value": json.dumps(setting_data.value),
            "description": setting_data.description,
            "user_id": str(user_id),
        }).fetchone()
        
        db.commit()
        
        # Invalidate cache
        await SettingsService.invalidate_cache()
        
        return {
            "key": result[0],
            "value": result[1],
            "description": result[2],
            "updated_at": result[3],
            "updated_by": result[4],
        }
    
    @staticmethod
    async def update_setting(
        db: Session, 
        key: str, 
        value: Any, 
        user_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Update an existing setting.
        Validates value and invalidates cache.
        """
        # Check if setting exists
        existing = await SettingsService.get_setting(db, key)
        if not existing:
            return None
        
        # Validate value based on key
        SettingsService._validate_setting_value(key, value)
        
        # Update in database
        # Use CAST instead of :: to avoid SQLAlchemy parameter parsing issues
        query = text("""
            UPDATE settings
            SET value = CAST(:value AS jsonb), updated_at = NOW(), updated_by = :user_id
            WHERE key = :key
            RETURNING key, value, description, updated_at, updated_by
        """)
        
        result = db.execute(query, {
            "key": key,
            "value": json.dumps(value),
            "user_id": str(user_id),
        }).fetchone()
        
        db.commit()
        
        # Invalidate cache
        await SettingsService.invalidate_cache()
        
        return {
            "key": result[0],
            "value": result[1],
            "description": result[2],
            "updated_at": result[3],
            "updated_by": result[4],
        }
    
    @staticmethod
    async def delete_setting(db: Session, key: str) -> bool:
        """
        Delete a setting.
        Returns True if deleted, False if not found.
        """
        query = text("DELETE FROM settings WHERE key = :key RETURNING key")
        result = db.execute(query, {"key": key}).fetchone()
        
        if not result:
            return False
        
        db.commit()
        
        # Invalidate cache
        await SettingsService.invalidate_cache()
        
        return True
    
    @staticmethod
    async def invalidate_cache():
        """Invalidate the settings cache"""
        try:
            await cache_service.delete(SETTINGS_CACHE_KEY)
            logger.info("Settings cache invalidated")
        except Exception as e:
            logger.warning(f"Failed to invalidate settings cache: {e}")
    
    @staticmethod
    def _validate_setting_value(key: str, value: Any):
        """
        Validate setting value based on key type.
        Raises ValueError if validation fails.
        """
        try:
            if key == "shop_hours":
                ShopHours(**value)
            elif key == "accent_color":
                validate_accent_color(value)
            elif key == "diagnostic_fee_behavior":
                validate_diagnostic_behavior(value)
            elif key == "invoice_terms":
                validate_invoice_terms(value)
            elif key == "notification_preferences":
                NotificationPreferences(**value)
            elif key == "travel_buffer_minutes":
                if not isinstance(value, (int, float)) or value < 0:
                    raise ValueError("travel_buffer_minutes must be a non-negative number")
            elif key == "tax_rate":
                if not isinstance(value, (int, float)) or value < 0 or value > 1:
                    raise ValueError("tax_rate must be between 0 and 1")
            elif key == "service_area_enabled":
                if not isinstance(value, bool):
                    raise ValueError("service_area_enabled must be a boolean")    
            elif key == "service_radius_miles":
                if not isinstance(value, (int, float)) or value <= 0:
                    raise ValueError("service_radius_miles must be a positive number")
            elif key == "shop_address":
                if not isinstance(value, dict) or 'address' not in value:
                    raise ValueError("shop_address must be an object with 'address' field")    
            elif key == "parts_markup_percentage":
                if not isinstance(value, (int, float)) or value < 0:
                    raise ValueError("parts_markup_percentage must be a non-negative number")
            elif key == "default_warranty_days":
                if not isinstance(value, int) or value < 0:
                    raise ValueError("default_warranty_days must be a non-negative integer")
            elif key == "extended_hours_enabled":
                if not isinstance(value, bool):
                    raise ValueError("extended_hours_enabled must be a boolean")
            # Add more validations as needed
        except Exception as e:
            raise ValueError(f"Invalid value for setting '{key}': {str(e)}")
