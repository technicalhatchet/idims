import logging
from fastapi import Depends, HTTPException, Header, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, List, Union
import uuid

from app.core.auth import get_auth_handler
from app.db.database import get_db
from app.models.user import User
from app.services.user_service import UserService
from app.config import settings

logger = logging.getLogger(__name__)

# Create security scheme
security = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current user from the request's Authorization header.
    This handles extracting the token and passing it to the auth handler.
    """
    # Extract token from Authorization header
    token = None
    if authorization:
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
        else:
            token = authorization
    
    # If no token in header, try to get it from the request
    if not token and request:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            if settings.DEBUG:
                logger.info(f"Token extracted from request Authorization header, length: {len(token)}")
    
    if not token:
        logger.error("Missing authorization token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Get auth handler and verify token
    auth_handler = get_auth_handler()
    
    # Get user from auth handler
    try:
        if settings.DEBUG:
            logger.info(f"Sending token to auth handler, length: {len(token)}")
        user = await auth_handler.get_current_user(request, token, db)
        if not user:
            logger.error("No user returned from auth handler")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed: User not found",
                headers={"WWW-Authenticate": "Bearer"}
            )
        if settings.DEBUG:
            logger.info(f"Successfully authenticated user: {user.email}, roles: {user.roles}")
        return user
    except Exception as e:
        logger.error(f"Authentication error in get_current_user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )

# Helper functions for requiring specific roles
def has_roles(user: User, required_roles: List[str]) -> bool:
    """Check if user has any of the required roles"""
    if not required_roles:
        return True
        
    if not user or not user.roles:
        return False
        
    return any(role in user.roles for role in required_roles)

# Role-specific dependencies
async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verify that the current user has admin role.
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required"
        )
    return current_user

async def get_admin_or_manager_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verify that the current user has admin or manager role.
    """
    if not any(role in ["admin", "manager"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or manager role required"
        )
    return current_user

async def get_technician_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verify that the current user has technician role.
    """
    if "technician" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Technician role required"
        )
    return current_user

async def get_client_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Verify that the current user has client role.
    """
    if "client" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client role required"
        )
    return current_user 