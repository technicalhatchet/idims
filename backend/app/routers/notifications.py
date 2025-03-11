from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.notification import Notification, NotificationTemplate
from app.schemas.notification import (
    NotificationResponse, NotificationListResponse, NotificationUpdate,
    NotificationTemplateResponse, NotificationTemplateCreate, NotificationTemplateUpdate
)
from app.services.notification_service import NotificationService
from app.core.exceptions import NotFoundException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications(
    is_read: Optional[bool] = Query(None, description="Filter by read status"),
    type: Optional[str] = Query(None, description="Filter by notification type"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List notifications for the current user with filtering and pagination.
    """
    skip = (page - 1) * limit
    
    try:
        # Build query
        query = db.query(Notification).filter(Notification.user_id == current_user.id)
        
        # Apply filters
        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)
        
        if type:
            query = query.filter(Notification.type == type)
        
        # Get total count
        total = query.count()
        
        # Apply pagination and order by created_at descending (newest first)
        notifications = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": notifications,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving notifications: {str(e)}"
        )

@router.get("/notifications/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: uuid.UUID = Path(..., description="The ID of the notification to retrieve"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific notification by ID.
    Users can only access their own notifications.
    """
    try:
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        ).first()
        
        if not notification:
            raise NotFoundException(f"Notification with ID {notification_id} not found")
        
        return notification
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving notification: {str(e)}"
        )

@router.put("/notifications/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: uuid.UUID = Path(..., description="The ID of the notification to update"),
    notification_update: NotificationUpdate = Body(...),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a notification, primarily to mark it as read.
    Users can only update their own notifications.
    """
    try:
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        ).first()
        
        if not notification:
            raise NotFoundException(f"Notification with ID {notification_id} not found")
        
        # Update fields
        update_data = notification_update.dict(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(notification, key, value)
        
        # If marking as read, update read_at timestamp
        if notification_update.is_read and not notification.is_read:
            notification.read_at = datetime.utcnow()
        
        db.commit()
        db.refresh(notification)
        
        return notification
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating notification: {str(e)}"
        )

@router.put("/notifications/mark-all-read", status_code=status.HTTP_200_OK)
async def mark_all_notifications_read(
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark all notifications for the current user as read.
    """
    try:
        # Update all unread notifications for the user
        db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        ).update({
            "is_read": True,
            "read_at": datetime.utcnow()
        })
        
        db.commit()
        
        return {"message": "All notifications marked as read"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error marking notifications as read: {str(e)}"
        )

@router.delete("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: uuid.UUID = Path(..., description="The ID of the notification to delete"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a notification.
    Users can only delete their own notifications.
    """
    try:
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        ).first()
        
        if not notification:
            raise NotFoundException(f"Notification with ID {notification_id} not found")
        
        db.delete(notification)
        db.commit()
        
        return None
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting notification: {str(e)}"
        )

@router.get("/notification-templates", response_model=List[NotificationTemplateResponse])
async def list_notification_templates(
    type: Optional[str] = Query(None, description="Filter by notification type"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    List notification templates.
    Only managers and admins can access notification templates.
    """
    try:
        query = db.query(NotificationTemplate)
        
        if type:
            query = query.filter(NotificationTemplate.type == type)
        
        templates = query.order_by(NotificationTemplate.name).all()
        
        return templates
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving notification templates: {str(e)}"
        )

@router.post("/notification-templates", response_model=NotificationTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_notification_template(
    template_data: NotificationTemplateCreate = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new notification template.
    Only managers and admins can create notification templates.
    """
    try:
        new_template = NotificationTemplate(
            name=template_data.name,
            type=template_data.type,
            subject=template_data.subject,
            content=template_data.content,
            variables=template_data.variables,
            is_active=True
        )
        
        db.add(new_template)
        db.commit()
        db.refresh(new_template)
        
        return new_template
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating notification template: {str(e)}"
        )

@router.get("/notification-templates/{template_id}", response_model=NotificationTemplateResponse)
async def get_notification_template(
    template_id: uuid.UUID = Path(..., description="The ID of the template to retrieve"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Get a specific notification template by ID.
    Only managers and admins can access notification templates.
    """
    try:
        template = db.query(NotificationTemplate).filter(NotificationTemplate.id == template_id).first()
        
        if not template:
            raise NotFoundException(f"Notification template with ID {template_id} not found")
        
        return template
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving notification template: {str(e)}"
        )

@router.put("/notification-templates/{template_id}", response_model=NotificationTemplateResponse)
async def update_notification_template(
    template_id: uuid.UUID = Path(..., description="The ID of the template to update"),
    template_data: NotificationTemplateUpdate = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Update a notification template.
    Only managers and admins can update notification templates.
    """
    try:
        template = db.query(NotificationTemplate).filter(NotificationTemplate.id == template_id).first()
        
        if not template:
            raise NotFoundException(f"Notification template with ID {template_id} not found")
        
        # Update fields
        update_data = template_data.dict(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(template, key, value)
        
        template.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(template)
        
        return template
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating notification template: {str(e)}"
        )

@router.delete("/notification-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification_template(
    template_id: uuid.UUID = Path(..., description="The ID of the template to delete"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a notification template.
    Only admins can delete notification templates.
    """
    try:
        template = db.query(NotificationTemplate).filter(NotificationTemplate.id == template_id).first()
        
        if not template:
            raise NotFoundException(f"Notification template with ID {template_id} not found")
        
        # Check if template is in use
        notifications_count = db.query(Notification).filter(Notification.template_id == template_id).count()
        
        if notifications_count > 0:
            raise ValidationException(f"Cannot delete template that is used by {notifications_count} notifications")
        
        db.delete(template)
        db.commit()
        
        return None
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting notification template: {str(e)}"
        )