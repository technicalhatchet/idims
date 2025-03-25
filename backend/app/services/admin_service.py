from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from uuid import UUID

from app.models.user import User
from app.models.work_order import WorkOrder
from app.models.client import Client
from app.models.technician import Technician
from app.schemas.user import UserResponse, UserListResponse
from app.core.exceptions import NotFoundException, ValidationException

class AdminService:
    """Service for admin operations"""

    def __init__(self, db: Session):
        self.db = db

    async def get_users(
        self,
        skip: int = 0,
        limit: int = 100,
        role: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> UserListResponse:
        """Get paginated list of users with optional filters"""
        query = self.db.query(User)
        
        if role:
            query = query.filter(User.role == role)
        if is_active is not None:
            query = query.filter(User.is_active == is_active)
            
        total = query.count()
        users = query.offset(skip).limit(limit).all()
        
        return UserListResponse(
            items=users,
            total=total,
            page=skip // limit + 1,
            pages=(total + limit - 1) // limit
        )

    async def get_user(self, user_id: UUID) -> UserResponse:
        """Get user by ID"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise NotFoundException(f"User with ID {user_id} not found")
        return user

    async def update_user(
        self,
        user_id: UUID,
        user_data: Dict[str, Any]
    ) -> UserResponse:
        """Update user data"""
        user = await self.get_user(user_id)
        
        for field, value in user_data.items():
            if hasattr(user, field):
                setattr(user, field, value)
                
        user.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user)
        return user

    async def deactivate_user(self, user_id: UUID) -> UserResponse:
        """Deactivate a user"""
        user = await self.get_user(user_id)
        user.is_active = False
        user.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user)
        return user

    async def get_system_stats(self) -> Dict[str, Any]:
        """Get system statistics"""
        return {
            "total_users": self.db.query(User).count(),
            "active_users": self.db.query(User).filter(User.is_active == True).count(),
            "total_work_orders": self.db.query(WorkOrder).count(),
            "total_clients": self.db.query(Client).count(),
            "total_technicians": self.db.query(Technician).count(),
            "active_work_orders": self.db.query(WorkOrder).filter(
                WorkOrder.status.in_(["pending", "in_progress"])
            ).count()
        }

    async def get_user_activity(
        self,
        user_id: UUID,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get user activity statistics"""
        user = await self.get_user(user_id)
        
        # Get work orders created by user
        work_orders = self.db.query(WorkOrder).filter(
            WorkOrder.created_by == user_id,
            WorkOrder.created_at >= datetime.utcnow() - timedelta(days=days)
        ).all()
        
        return {
            "user_id": str(user_id),
            "email": user.email,
            "role": user.role,
            "last_login": user.last_login,
            "work_orders_created": len(work_orders),
            "active_work_orders": len([wo for wo in work_orders if wo.status in ["pending", "in_progress"]]),
            "completed_work_orders": len([wo for wo in work_orders if wo.status == "completed"])
        } 