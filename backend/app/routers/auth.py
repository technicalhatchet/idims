from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
import logging
from datetime import datetime, timedelta
import uuid
import requests
import json

from app.db.database import get_db
from app.core.auth import AuthHandler, JWTToken
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, UserLogin
from app.core.exceptions import AuthenticationException, ValidationException, NotFoundException

router = APIRouter()
auth_handler = AuthHandler()
logger = logging.getLogger(__name__)

@router.post("/auth/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login with username (email) and password to get access token.
    """
    try:
        user = db.query(User).filter(User.email == form_data.username).first()
        
        if not user:
            raise AuthenticationException("Invalid credentials")
        
        # For password-based authentication
        if not user.auth_id and not user.hashed_password:
            raise AuthenticationException("No password set for this user")
        
        # Future implementation: Add password verification
        
        # Create access token
        access_token_expires = timedelta(minutes=auth_handler.access_token_expire_minutes)
        token_data = {
            "sub": str(user.id),
            "name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "roles": [user.role]
        }
        
        access_token = auth_handler.create_access_token(token_data)
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": access_token_expires.total_seconds(),
            "user": user
        }
        
    except AuthenticationException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )

@router.post("/auth/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new user (for self-registration).
    """
    try:
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise ValidationException(f"User with email {user_data.email} already exists")
        
        # Create new user
        new_user = User(
            email=user_data.email,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=user_data.role,
            # Future implementation: Add password hashing
            is_active=True,
            email_verified=False,
            preferences=user_data.preferences
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return new_user
        
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"User registration error: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error registering user"
        )

@router.post("/auth/verify-token")
async def verify_token(
    token: JWTToken = Depends(auth_handler.auth_wrapper)
):
    """
    Verify JWT token validity.
    """
    try:
        return {
            "valid": True,
            "user_id": token.sub,
            "email": token.email,
            "name": token.name,
            "roles": token.roles
        }
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"}
        )

@router.post("/auth/auth0-callback")
async def auth0_callback(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle Auth0 callback to create or update user.
    This endpoint is called by Auth0 after successful authentication.
    """
    try:
        # Get token from request
        payload = await request.json()
        token = payload.get("access_token")
        
        if not token:
            raise ValidationException("Missing access token")
        
        # Get user info from Auth0
        user_info = await auth_handler.get_auth0_user_info(token)
        
        # Check if user exists
        auth_id = user_info.get("sub")
        email = user_info.get("email")
        
        user = db.query(User).filter(User.auth_id == auth_id).first()
        if not user:
            # Check if user exists with email
            user_by_email = db.query(User).filter(User.email == email).first()
            
            if user_by_email:
                # Update existing user with Auth0 ID
                user_by_email.auth_id = auth_id
                user_by_email.email_verified = user_info.get("email_verified", False)
                user_by_email.last_login = datetime.utcnow()
                user = user_by_email
            else:
                # Create new user
                new_user = User(
                    auth_id=auth_id,
                    email=email,
                    first_name=user_info.get("given_name", ""),
                    last_name=user_info.get("family_name", ""),
                    role="client",  # Default role
                    is_active=True,
                    email_verified=user_info.get("email_verified", False),
                    avatar_url=user_info.get("picture")
                )
                
                db.add(new_user)
                db.flush()
                user = new_user
        else:
            # Update existing user
            user.email = email
            user.email_verified = user_info.get("email_verified", False)
            user.avatar_url = user_info.get("picture")
            user.last_login = datetime.utcnow()
        
        db.commit()
        db.refresh(user)
        
        # Create token for the user
        token_data = {
            "sub": str(user.id),
            "name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "roles": [user.role]
        }
        
        access_token = auth_handler.create_access_token(token_data)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": auth_handler.access_token_expire_minutes * 60,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role
            }
        }
        
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Auth0 callback error: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing Auth0 authentication"
        )

@router.post("/auth/refresh-token", response_model=Token)
async def refresh_token(
    token: JWTToken = Depends(auth_handler.auth_wrapper),
    db: Session = Depends(get_db)
):
    """
    Refresh access token.
    """
    try:
        user = db.query(User).filter(User.id == token.sub).first()
        
        if not user:
            raise NotFoundException("User not found")
        
        # Create new access token
        token_data = {
            "sub": str(user.id),
            "name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "roles": [user.role]
        }
        
        access_token = auth_handler.create_access_token(token_data)
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": auth_handler.access_token_expire_minutes * 60,
            "user": user
        }
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error refreshing token"
        )

@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(auth_handler.get_current_user)
):
    """
    Get current user information.
    """
    return current_user