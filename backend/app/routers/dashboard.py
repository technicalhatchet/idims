from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import logging
import os

from app.db.database import get_db
from app.models.user import User 
from app.services.dashboard_service import DashboardService
from app.core.auth import get_auth_handler

router = APIRouter()
logger = logging.getLogger(__name__)

# Environment check for development mode
is_dev_mode = os.environ.get("ENVIRONMENT", "development").lower() == "development"

# Get the auth handler instance
auth_handler = get_auth_handler()

# Optional authentication
async def get_optional_user(db: Session = Depends(get_db)):
    try:
        # Try to get the user, but don't raise an exception if not authenticated
        credentials = None
        try:
            # This will fail if no auth header is present, and that's ok
            from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
            security = HTTPBearer(auto_error=False)
            credentials = await security(None)
        except Exception as e:
            logger.debug(f"No auth header present: {str(e)}")
            return None
            
        if not credentials:
            return None
            
        try:
            # If we have credentials, try to get the user
            token = credentials.credentials
            # First verify the token
            payload = await auth_handler.verify_token(token)
            if not payload or not payload.sub:
                return None
                
            # Then get the user from the database
            user = db.query(User).filter(User.auth_id == payload.sub).first()
            return user
        except Exception as e:
            logger.warning(f"Authentication failed but allowing access: {str(e)}")
            return None
    except Exception as e:
        logger.warning(f"Authentication failed but allowing access: {str(e)}")
        return None

@router.get("/dashboard/stats", tags=["Dashboard"])
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Get dashboard statistics.
    In development mode, authentication is optional.
    In production mode, authentication is required.
    """
    try:
        # In production, require authentication
        if not is_dev_mode and not current_user:
            logger.warning("Unauthenticated access attempt to dashboard stats in production mode")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        logger.info(f"Getting dashboard stats" + (f" for user {current_user.id}" if current_user else " (unauthenticated)"))
        
        # DashboardService.get_dashboard_stats is async, so we need to await it
        stats = await DashboardService.get_dashboard_stats(db)
        
        # Ensure stats is properly serializable (not SQLAlchemy models)
        return stats
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving dashboard stats: {str(e)}"
        ) 