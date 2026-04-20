import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel
import logging
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.core.auth import AuthHandler, get_auth_handler

router = APIRouter()

# Setup logger
logger = logging.getLogger(__name__)

class UserProfile(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    roles: list = []
    permissions: list = []

@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    request: Request,
    auth_handler: AuthHandler = Depends(get_auth_handler)
):
    """
    Get the current user's profile based on their JWT token
    """
    request_id = str(uuid.uuid4())
    logger.info(f"[REQUEST-{request_id}] Accessing current user profile endpoint")
    
    # Get all headers for debugging
    headers = dict(request.headers)
    safe_headers = {k: v if k.lower() != "authorization" else f"{v[:20]}..." for k, v in headers.items()}
    logger.info(f"[REQUEST-{request_id}] Headers received: {safe_headers}")
    
    # Extract auth header
    auth_header = headers.get('Authorization') or headers.get('authorization')
    
    if not auth_header:
        logger.warning(f"[REQUEST-{request_id}] No Authorization header found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    if not auth_header.startswith('Bearer '):
        logger.warning(f"[REQUEST-{request_id}] Invalid header format: {auth_header[:15]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Bearer token required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = auth_header.replace('Bearer ', '')
    
    try:
        # Get user from token
        user = await auth_handler.get_current_user(token)
        
        if not user:
            logger.warning(f"[REQUEST-{request_id}] Token verification succeeded but no user found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        logger.info(f"[REQUEST-{request_id}] Successfully retrieved user profile for: {user.email}")
        
        return UserProfile(
            id=str(user.id) if hasattr(user, "id") else user.sub,
            email=user.email,
            name=user.name if hasattr(user, "name") else None,
            roles=user.roles if hasattr(user, "roles") else [],
            permissions=user.permissions if hasattr(user, "permissions") else []
        )
            
    except Exception as e:
        logger.error(f"[REQUEST-{request_id}] Error retrieving user profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        ) 