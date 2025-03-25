from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging
from datetime import datetime, timedelta
import uuid
import requests
import json
from pydantic import BaseModel, ValidationError

from app.db.database import get_db
from app.core.auth import AuthHandler, JWTToken, get_auth_handler
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, UserLogin
from app.core.exceptions import AuthenticationException, ValidationException, NotFoundException

router = APIRouter()
logger = logging.getLogger(__name__)

def get_auth_dependency():
    """Lazy-loaded dependency for auth handler"""
    return get_auth_handler().auth_wrapper

def get_current_user_dependency():
    """Lazy-loaded dependency for current user"""
    return get_auth_handler().get_current_user

def get_admin_dependency():
    """Lazy-loaded dependency for admin verification"""
    return get_auth_handler().verify_admin

@router.post("/auth/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login with username (email) and password to get access token.
    """
    try:
        auth_handler = get_auth_handler()
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
    token: JWTToken = Depends(get_auth_dependency)
):
    """
    Verify JWT token validity.
    """
    return {"valid": True, "token": token}

class Auth0CallbackRequest(BaseModel):
    """Auth0 callback request model"""
    access_token: str
    id_token: str
    scope: str = "openid profile email"  # Default scope
    expires_in: int
    token_type: str
    state: str = None

@router.post("/auth/auth0-callback", response_model=Dict[str, Any])
async def auth0_callback(
    request: Auth0CallbackRequest,
    db: Session = Depends(get_db)
):
    """
    Handle Auth0 callback to create or update user.
    This endpoint is called by Auth0 after successful authentication.
    """
    logger.info("Auth0 callback received with scope: %s", request.scope)
    try:
        logger.info("Received Auth0 callback")
        logger.debug(f"Callback request: {request}")
        
        # Verify the access token
        auth_handler = get_auth_handler()
        token_data = await auth_handler.verify_token(request.access_token)
        logger.info(f"Token verified for subject: {token_data.sub}")
        
        # Get user info from Auth0
        user_info = await auth_handler.get_auth0_user_info(request.access_token)
        logger.info(f"Retrieved user info for: {user_info.get('email')}")
        
        # Extract user data
        auth_id = user_info.get("sub")
        email = user_info.get("email")
        email_verified = user_info.get("email_verified", False)
        name = user_info.get("name", "").split()
        first_name = name[0] if name else user_info.get("given_name", "User")
        last_name = name[1] if len(name) > 1 else user_info.get("family_name", "")
        
        if not auth_id:
            raise ValidationError("No auth_id (sub) found in user info")
        if not email:
            raise ValidationError("No email found in user info")
        
        logger.info(f"Processing user: {email} ({auth_id})")
        
        # Get Auth0 metadata
        app_metadata = user_info.get("https://servicebusiness.com/app_metadata", {})
        user_metadata = user_info.get("https://servicebusiness.com/user_metadata", {})
        
        # Get role and permissions from Auth0
        roles = user_info.get("https://servicebusiness.com/roles", [])
        if not roles:
            # Try getting roles from app_metadata
            roles = app_metadata.get("roles", [])
        if not roles:
            # Try getting roles from the roles claim
            roles = user_info.get("roles", [])
            
        permissions = user_info.get("https://servicebusiness.com/permissions", [])
        if not permissions:
            # Try getting permissions from app_metadata
            permissions = app_metadata.get("permissions", [])
        if not permissions:
            # Try getting permissions from the permissions claim
            permissions = user_info.get("permissions", [])
            
        default_role = "admin"  # Changed default role to admin
        assigned_role = roles[0] if roles else default_role
        logger.info(f"Assigned role: {assigned_role}")
        
        # Check if user exists
        user = db.query(User).filter(User.auth_id == auth_id).first()
        if not user:
            logger.info(f"User not found with auth_id {auth_id}, checking email {email}")
            # Check if user exists with email
            user_by_email = db.query(User).filter(User.email == email).first()
            
            if user_by_email:
                logger.info(f"Found user by email, updating auth_id")
                # Update existing user with Auth0 ID
                user_by_email.auth_id = auth_id
                user_by_email.email_verified = email_verified
                user_by_email.last_login = datetime.utcnow()
                user_by_email.permissions = permissions  # Update permissions
                user = user_by_email
            else:
                logger.info(f"Creating new user with email {email} and role {assigned_role}")
                # Create new user
                new_user = User(
                    auth_id=auth_id,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role=assigned_role,
                    is_active=True,
                    email_verified=email_verified,
                    avatar_url=user_info.get("picture"),
                    phone=user_metadata.get("phone"),
                    company=app_metadata.get("company"),
                    preferences=user_metadata.get("preferences", {"theme": "light", "notifications": True}),
                    permissions=permissions  # Set initial permissions
                )
                
                db.add(new_user)
                db.flush()
                user = new_user
                logger.info(f"Created new user with ID: {user.id}")
        else:
            logger.info(f"Found existing user, updating details")
            # Update existing user
            user.email = email
            user.email_verified = email_verified
            user.avatar_url = user_info.get("picture")
            user.last_login = datetime.utcnow()
            user.role = assigned_role  # Update role from Auth0
            user.first_name = first_name
            user.last_name = last_name
            
            # Update metadata if available
            if user_metadata.get("phone"):
                user.phone = user_metadata["phone"]
            if app_metadata.get("company"):
                user.company = app_metadata["company"]
            if user_metadata.get("preferences"):
                user.preferences = user_metadata["preferences"]
            user.permissions = permissions  # Update permissions
        
        try:
            db.commit()
            db.refresh(user)
            logger.info(f"User saved successfully: {user.id}")
        except Exception as e:
            db.rollback()
            logger.error(f"Database error saving user: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"message": "Database error", "error": str(e)}
            )
        
        # Create session token with permissions
        token_data = {
            "sub": str(user.id),
            "name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "roles": [user.role],
            "permissions": permissions,
            "scope": request.scope
        }
        
        # Return user data and tokens
        return {
            "access_token": request.access_token,
            "id_token": request.id_token,
            "token_type": request.token_type,
            "expires_in": request.expires_in,
            "scope": request.scope,
            "user": UserResponse.from_orm(user).dict()
        }
        
    except ValidationError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": str(e), "errors": e.errors() if hasattr(e, 'errors') else None}
        )
    except AuthenticationException as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": str(e)}
        )
    except Exception as e:
        logger.error(f"Auth0 callback error: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Error processing Auth0 authentication", "error": str(e)}
        )

@router.post("/auth/refresh-token", response_model=Token)
async def refresh_token(
    token: JWTToken = Depends(get_auth_dependency),
    db: Session = Depends(get_db)
):
    """
    Refresh access token.
    """
    try:
        auth_handler = get_auth_handler()
        user = db.query(User).filter(User.id == token.sub).first()
        
        if not user:
            raise AuthenticationException("User not found")
        
        # Create new access token
        access_token_expires = timedelta(minutes=auth_handler.access_token_expire_minutes)
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
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during token refresh"
        )

@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user_dependency)
):
    """
    Get current user information.
    """
    return current_user

@router.post("/auth/set-role/{user_id}")
async def set_user_role(
    user_id: str,
    role: str = Body(..., embed=True),
    current_user: User = Depends(get_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Set a user's role in Auth0 and local database.
    Only admins can access this endpoint.
    """
    try:
        # Get client credentials token for Auth0 Management API
        management_token = get_auth_handler().get_client_credentials_token()
        
        # Update user's app_metadata in Auth0
        auth0_api_url = f"https://{settings.AUTH0_DOMAIN}/api/v2/users/{user_id}"
        headers = {
            "Authorization": f"Bearer {management_token}",
            "Content-Type": "application/json"
        }
        
        # Prepare metadata update
        metadata = {
            "app_metadata": {
                "roles": [role]
            }
        }
        
        # Update Auth0 user
        response = requests.patch(auth0_api_url, headers=headers, json=metadata)
        response.raise_for_status()
        
        # Update local user
        user = db.query(User).filter(User.auth_id == user_id).first()
        if user:
            user.role = role
            db.commit()
            
        return {"message": f"Role {role} assigned successfully"}
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Auth0 management API error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user role in Auth0"
        )
    except Exception as e:
        logger.error(f"Set role error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error setting user role"
        )