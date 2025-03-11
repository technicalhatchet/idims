from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.user import User
from app.models.settings import Settings, SystemLog
from app.core.exceptions import NotFoundException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/admin/users")
async def list_users(
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[str] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    List all users with filtering and pagination.
    Only admins can access this endpoint.
    """
    skip = (page - 1) * limit
    
    # Build query
    query = db.query(User)
    
    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(search_term)) |
            (User.last_name.ilike(search_term)) |
            (User.email.ilike(search_term))
        )
    
    if role:
        query = query.filter(User.role == role)
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "users": users,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.get("/admin/users/{user_id}")
async def get_user(
    user_id: uuid.UUID = Path(..., description="ID of the user to retrieve"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a user.
    Only admins can access this endpoint.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found")
    
    # Get additional user information
    # In a real app, you would fetch related records
    
    return user

@router.put("/admin/users/{user_id}")
async def update_user(
    user_id: uuid.UUID = Path(..., description="ID of the user to update"),
    user_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Update a user's information.
    Only admins can access this endpoint.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found")
    
    # Prevent modifying admin status if it's the last admin
    if user.role == "admin" and user_data.get("role") != "admin":
        admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot change role of the last admin user"
            )
    
    # Update user fields
    for key, value in user_data.items():
        if hasattr(user, key) and key not in ["id", "created_at"]:
            setattr(user, key, value)
    
    user.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    return user

@router.post("/admin/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: uuid.UUID = Path(..., description="ID of the user"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Reset a user's password.
    Only admins can access this endpoint.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found")
    
    # Generate random password
    # In a real app, you would hash this password and send it to the user securely
    import random
    import string
    
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
    
    # In a real app, you would hash the password before storing
    # user.hashed_password = hash_password(temp_password)
    
    db.commit()
    
    # In a real app, you would send an email to the user with the temporary password
    
    return {
        "success": True,
        "message": "Password reset successful",
        "temp_password": temp_password  # Only for demonstration - in a real app, don't return passwords
    }

@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID = Path(..., description="ID of the user to delete"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a user.
    Only admins can access this endpoint.
    """
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You cannot delete your own account"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID {user_id} not found")
    
    # Prevent deleting the last admin
    if user.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot delete the last admin user"
            )
    
    # In a real app, you might perform a soft delete instead of hard delete
    user.is_active = False
    db.commit()
    
    return {"success": True, "message": "User deactivated successfully"}

@router.get("/admin/system-logs")
async def get_system_logs(
    log_type: Optional[str] = Query(None, description="Filter by log type"),
    severity: Optional[str] = Query(None, description="Filter by severity (info, warning, error, critical)"),
    start_date: Optional[datetime] = Query(None, description="Filter from this date"),
    end_date: Optional[datetime] = Query(None, description="Filter until this date"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of logs to return"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get system logs with filtering.
    Only admins can access this endpoint.
    """
    query = db.query(SystemLog)
    
    # Apply filters
    if log_type:
        query = query.filter(SystemLog.event_type == log_type)
    
    if severity:
        query = query.filter(SystemLog.severity == severity)
    
    if start_date:
        query = query.filter(SystemLog.timestamp >= start_date)
    
    if end_date:
        query = query.filter(SystemLog.timestamp <= end_date)
    
    # Get logs ordered by timestamp (newest first)
    logs = query.order_by(SystemLog.timestamp.desc()).limit(limit).all()
    
    return {"logs": logs}

@router.get("/admin/settings")
async def get_settings(
    keys: Optional[List[str]] = Query(None, description="Specific settings keys to retrieve"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Get application settings.
    Only admins can access this endpoint.
    """
    query = db.query(Settings)
    
    if keys:
        query = query.filter(Settings.key.in_(keys))
    
    settings_list = query.all()
    
    # Format as dictionary for easier consumption
    settings_dict = {setting.key: setting.value for setting in settings_list}
    
    return settings_dict

@router.put("/admin/settings/{setting_key}")
async def update_setting(
    setting_key: str = Path(..., description="Key of the setting to update"),
    setting_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Update an application setting.
    Only admins can access this endpoint.
    """
    if "value" not in setting_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Setting value is required"
        )
    
    setting = db.query(Settings).filter(Settings.key == setting_key).first()
    
    if not setting:
        # Create new setting if it doesn't exist
        setting = Settings(
            key=setting_key,
            value=setting_data["value"],
            description=setting_data.get("description")
        )
        db.add(setting)
    else:
        # Update existing setting
        setting.value = setting_data["value"]
        if "description" in setting_data:
            setting.description = setting_data["description"]
    
    setting.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(setting)
    
    return setting

@router.get("/admin/system-health")
async def check_system_health(
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Check overall system health.
    Only admins can access this endpoint.
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {}
    }
    
    # Check database
    try:
        # Simple query to check database connectivity
        db.execute("SELECT 1")
        health_status["components"]["database"] = {
            "status": "healthy",
            "message": "Connected successfully"
        }
    except Exception as e:
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "message": str(e)
        }
        health_status["status"] = "degraded"
    
    # Check Redis if used
    if hasattr(settings, "REDIS_URL") and settings.REDIS_URL:
        try:
            import redis
            redis_client = redis.from_url(settings.REDIS_URL)
            redis_client.ping()
            health_status["components"]["redis"] = {
                "status": "healthy",
                "message": "Connected successfully"
            }
        except Exception as e:
            health_status["components"]["redis"] = {
                "status": "unhealthy",
                "message": str(e)
            }
            health_status["status"] = "degraded"
    
    # Check storage
    storage_path = settings.LOCAL_STORAGE_PATH
    try:
        import os
        if os.path.exists(storage_path) and os.access(storage_path, os.W_OK):
            # Check disk space
            import shutil
            total, used, free = shutil.disk_usage(storage_path)
            percent_used = used / total * 100
            
            storage_status = "healthy"
            message = f"Storage accessible, {free / (1024**3):.2f} GB free"
            
            if percent_used > 90:
                storage_status = "warning"
                message += " (disk almost full)"
                if health_status["status"] == "healthy":
                    health_status["status"] = "warning"
            
            health_status["components"]["storage"] = {
                "status": storage_status,
                "message": message,
                "details": {
                    "total_gb": total / (1024**3),
                    "used_gb": used / (1024**3),
                    "free_gb": free / (1024**3),
                    "percent_used": percent_used
                }
            }
        else:
            health_status["components"]["storage"] = {
                "status": "unhealthy",
                "message": "Storage directory not accessible"
            }
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["components"]["storage"] = {
            "status": "unhealthy",
            "message": str(e)
        }
        health_status["status"] = "degraded"
    
    # Log this health check
    SystemLog.log_event(
        db=db,
        event_type="system_health_check",
        details=health_status,
        severity=health_status["status"]
    )
    
    return health_status

@router.post("/admin/run-maintenance")
async def run_maintenance(
    maintenance_type: str = Query(..., description="Type of maintenance to run"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Trigger a maintenance task.
    Only admins can access this endpoint.
    """
    valid_maintenance_types = ["database", "cache", "logs", "reports", "all"]
    
    if maintenance_type not in valid_maintenance_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid maintenance type. Must be one of: {', '.join(valid_maintenance_types)}"
        )
    
    # In a real app, you would trigger Celery tasks for these operations
    
    if maintenance_type in ["database", "all"]:
        # Run database maintenance
        pass
    
    if maintenance_type in ["cache", "all"]:
        # Clear caches
        pass
    
    if maintenance_type in ["logs", "all"]:
        # Rotate logs
        pass
    
    if maintenance_type in ["reports", "all"]:
        # Clean up old reports
        pass
    
    return {
        "success": True,
        "message": f"Maintenance task '{maintenance_type}' started successfully",
        "task_id": str(uuid.uuid4())  # This would be a real task ID in a Celery implementation
    }