from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.config import settings
from app.core.exceptions import NotFoundException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/mobile/sync")
async def sync_data(
    last_sync: Optional[datetime] = Query(None, description="Timestamp of last successful sync"),
    entities: Optional[List[str]] = Query(None, description="Entity types to sync"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sync mobile app data.
    Returns data that has changed since the last sync.
    """
    # In a real app, you would fetch changed data based on last_sync timestamp
    
    # Default entities to sync if not specified
    if not entities:
        if current_user.role == "technician":
            entities = ["work_orders", "clients", "inventory"]
        elif current_user.role == "client":
            entities = ["work_orders", "invoices", "payments"]
        else:
            entities = ["work_orders", "clients", "invoices", "payments", "inventory"]
    
    # Build response with synchronized data
    sync_data = {
        "sync_timestamp": datetime.utcnow().isoformat(),
        "entities": {}
    }
    
    # Add data for each requested entity
    # In a real app, this would fetch from database based on last_sync
    
    if "work_orders" in entities:
        sync_data["entities"]["work_orders"] = {
            "updated": [],
            "deleted": []
        }
    
    if "clients" in entities:
        sync_data["entities"]["clients"] = {
            "updated": [],
            "deleted": []
        }
        
    if "invoices" in entities:
        sync_data["entities"]["invoices"] = {
            "updated": [],
            "deleted": []
        }
    
    if "payments" in entities:
        sync_data["entities"]["payments"] = {
            "updated": [],
            "deleted": []
        }
    
    if "inventory" in entities:
        sync_data["entities"]["inventory"] = {
            "updated": [],
            "deleted": []
        }
    
    return sync_data

@router.post("/mobile/register-device")
async def register_device(
    device_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Register a mobile device for push notifications.
    """
    # Validate required fields
    required_fields = ["device_id", "device_type", "push_token"]
    for field in required_fields:
        if field not in device_data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing required field: {field}"
            )
    
    # In a real app, you would save this to the database
    # Example device data structure:
    # {
    #     "device_id": "unique-device-id",
    #     "device_type": "ios" or "android",
    #     "push_token": "firebase-fcm-token-or-apns-token",
    #     "app_version": "1.0.0",
    #     "os_version": "iOS 14.5"
    # }
    
    return {
        "success": True,
        "message": "Device registered successfully"
    }

@router.delete("/mobile/unregister-device/{device_id}")
async def unregister_device(
    device_id: str = Path(..., description="Unique device identifier"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unregister a mobile device to stop push notifications.
    """
    # In a real app, you would remove this from the database
    
    return {
        "success": True,
        "message": "Device unregistered successfully"
    }

@router.get("/mobile/config")
async def get_mobile_config(
    app_version: str = Query(..., description="Current app version"),
    platform: str = Query(..., description="Device platform (ios, android)"),
    current_user: User = Depends(auth_handler.get_current_user),
):
    """
    Get mobile app configuration.
    Includes feature flags, API endpoints, and other settings.
    """
    # Check if app_version requires an update
    # In a real app, you would check against minimum required versions
    requires_update = False
    
    # Basic configuration
    config = {
        "requires_update": requires_update,
        "update_url": f"https://store.example.com/{platform}" if requires_update else None,
        "force_update": False,
        "api_base_url": "https://api.example.com",
        "media_base_url": "https://media.example.com",
        "features": {
            "chat": settings.FEATURE_CHAT_ENABLED,
            "reports": settings.FEATURE_REPORTS_ENABLED,
            "mobile_sync": settings.FEATURE_MOBILE_SYNC_ENABLED
        },
        "sync_interval": 300,  # seconds
        "cache_ttl": 86400,    # seconds
        "support_contact": {
            "email": "support@example.com",
            "phone": "+1-555-123-4567"
        }
    }
    
    # Add role-specific configuration
    if current_user.role == "technician":
        config["technician_features"] = {
            "offline_mode": True,
            "signature_capture": True,
            "photo_upload": True,
            "navigation": True
        }
    elif current_user.role == "client":
        config["client_features"] = {
            "payment_methods": True,
            "document_download": True,
            "quote_approval": True
        }
    
    return config

@router.post("/mobile/report-issue")
async def report_issue(
    issue_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Report an issue from the mobile app.
    """
    # In a real app, you would save this to the database
    # and possibly create a support ticket
    
    # Log issue details
    logger_data = {
        "user_id": str(current_user.id),
        "timestamp": datetime.utcnow().isoformat(),
        "device_info": issue_data.get("device_info", {}),
        "issue_type": issue_data.get("issue_type", "general"),
        "description": issue_data.get("description", "")
    }
    
    # Create a support ticket or notification
    # (implementation would depend on your support system)
    
    return {
        "success": True,
        "ticket_id": str(uuid.uuid4()),
        "message": "Issue reported successfully"
    }