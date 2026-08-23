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

from app.config import settings

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
    from app.core.dependencies import get_current_user
    return get_current_user

def get_admin_dependency():
    """Lazy-loaded dependency for admin verification"""
    from app.core.dependencies import get_admin_user
    return get_admin_user

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
    user_profile: Optional[Dict[str, Any]] = None  # Add field for user profile

class IdentifyUserRequest(BaseModel):
    email: str
    auth0_user_id: str

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
        
        # Get user info - prefer the user_profile sent from Auth0 action if available
        user_profile = request.user_profile
        if not user_profile:
            # Fall back to getting user info from Auth0 directly
            logger.info("No user_profile in request, fetching from Auth0")
            user_info = await auth_handler.get_auth0_user_info(request.access_token)
            logger.info(f"Retrieved user info for: {user_info.get('email')}")
        else:
            logger.info(f"Using user_profile from request: {user_profile.get('email')}")
            user_info = user_profile
        
        # Extract user data
        auth_id = user_info.get("auth_id") or user_info.get("sub")
        email = user_info.get("email")
        email_verified = user_info.get("email_verified", False)

        # Get name information - prioritize full components if available
        given_name = user_info.get("given_name")
        family_name = user_info.get("family_name")
        full_name = user_info.get("name")
        
        # If we have full name but not components, split it
        if full_name and (not given_name or not family_name):
            name_parts = full_name.split()
            if not given_name and len(name_parts) > 0:
                given_name = name_parts[0]
            if not family_name and len(name_parts) > 1:
                family_name = ' '.join(name_parts[1:])
        
        # Final fallbacks
        first_name = given_name or "User"
        last_name = family_name or ""
        
        # Get profile picture
        picture = user_info.get("picture")
        
        if not auth_id:
            raise ValidationError("No auth_id (sub) found in user info")
        if not email:
            raise ValidationError("No email found in user info")
        
        logger.info(f"Processing user: {email} ({auth_id}), name: {first_name} {last_name}")
        
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
                    avatar_url=picture,
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
            user.avatar_url = picture
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

@router.get("/auth/debug-token")
async def debug_token(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Debug endpoint to inspect the Auth0 token data.
    Shows the full token payload and user info from Auth0.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return {"error": "No valid Authorization header found"}
    
    token = auth_header.replace("Bearer ", "")
    
    try:
        # Get the auth handler
        auth_handler = get_auth_handler()
        
        # Verify the token and get token data
        token_data = await auth_handler.verify_token(token)
        
        # Get user info from Auth0
        try:
            user_info = await auth_handler.get_auth0_user_info(token)
        except Exception as e:
            user_info = {"error": f"Failed to get user info: {str(e)}"}
        
        # Check if user exists in database
        user = None
        if token_data.sub:
            user = db.query(User).filter(User.auth_id == token_data.sub).first()
            if not user and token_data.email:
                user = db.query(User).filter(User.email == token_data.email).first()
                
        # Extract roles from user info
        roles = []
        if user_info and isinstance(user_info, dict):
            # Try to get roles from app_metadata
            app_metadata = user_info.get("https://idimsapi/app_metadata", {})
            if app_metadata and isinstance(app_metadata, dict) and 'roles' in app_metadata:
                roles = app_metadata.get('roles', [])
            # Try other sources for roles
            elif 'roles' in user_info:
                roles = user_info.get('roles', [])
                
        # Get token payload for inspection
        payload = {}
        if hasattr(token_data, 'raw_payload'):
            payload = token_data.raw_payload or {}
            
        # Create a result with detailed information
        result = {
            "token_data": {
                "sub": token_data.sub,
                "email": token_data.email,
                "name": token_data.name,
                "given_name": token_data.given_name,
                "family_name": token_data.family_name,
                "nickname": token_data.nickname,
                "picture": token_data.picture,
                "roles": token_data.roles,
                "exp": token_data.exp,
                "raw_payload": payload,
                "extracted_roles": roles
            },
            "auth0_user_info": user_info,
            "db_user": user.to_dict() if user else None,
            "auth_handler_info": {
                "domain": auth_handler.domain,
                "audience": auth_handler.audience,
                "issuer": auth_handler.issuer
            }
        }
        
        return result
    except Exception as e:
        logger.error(f"Error debugging token: {str(e)}")
        return {"error": str(e)}

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
        


@router.post("/auth/identify-user")
async def identify_user(
    body: IdentifyUserRequest,
    db: Session = Depends(get_db),
):
    from app.models.client import Client
    from app.models.technician import Technician

    email = body.email.lower().strip()
    auth0_user_id = body.auth0_user_id

    # Determine role based on matching record
    role_id = None
    record_id = None

    client = db.query(Client).filter(Client.email == email).first()
    if client:
        role_id = 'rol_okGmH3pkFUu0YXWi'  # client role
        record_id = str(client.id)
        if not client.auth0_user_id:
            client.auth0_user_id = auth0_user_id
            db.commit()

    if not role_id:
        technician = db.query(Technician).filter(Technician.email == email).first()
        if technician:
            role_id = 'rol_KIVgWHYL1p8smVsc'  # technician role
            record_id = str(technician.id)

    if not role_id:
        return {"role": None}

    # Assign role via Management API — same pattern as set_user_role
    try:
        management_token = get_auth_handler().get_client_credentials_token()
        auth0_api_url = f"https://{settings.AUTH0_DOMAIN}/api/v2/users/{auth0_user_id}/roles"
        headers = {
            "Authorization": f"Bearer {management_token}",
            "Content-Type": "application/json"
        }
        response = requests.post(auth0_api_url, headers=headers, json={"roles": [role_id]})
        response.raise_for_status()
        logger.info(f"[IdentifyUser] Assigned role {role_id} to {auth0_user_id}")
    except Exception as e:
        logger.error(f"[IdentifyUser] Role assignment failed: {str(e)}")
        # Still return success — role can be assigned manually

    role_name = 'client' if 'okGm' in role_id else 'technician'
    return {"role": role_name, "record_id": record_id}


DIY_STAFF_ROLE_CONFLICT = frozenset({"admin", "manager", "technician"})
DIYER_ROLE_ID = "rol_efrbzOWFRtk0sJYy"


@router.post("/auth/complete-diy-signup")
async def complete_diy_signup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency),
):
    """
    Assign DIY homeowner role after Solomon signup.
    Sets Auth0 app_metadata + optional RBAC role and syncs local user.roles.
    """
    if current_user.is_diyer:
        return {"ok": True, "already_diyer": True, "roles": current_user.roles or ["diyer"]}

    existing_roles = set(current_user.roles or [])
    if existing_roles & DIY_STAFF_ROLE_CONFLICT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff accounts cannot enroll as DIY. Sign in to Solomon with your technician access.",
        )

    auth_id = current_user.auth_id
    if not auth_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is missing Auth0 id",
        )

    try:
        management_token = get_auth_handler().get_client_credentials_token()
        auth0_domain = settings.AUTH0_DOMAIN
        headers = {
            "Authorization": f"Bearer {management_token}",
            "Content-Type": "application/json",
        }

        patch_url = f"https://{auth0_domain}/api/v2/users/{auth_id}"
        patch_response = requests.patch(
            patch_url,
            headers=headers,
            json={"app_metadata": {"roles": ["diyer"]}},
        )
        patch_response.raise_for_status()

        roles_url = f"https://{auth0_domain}/api/v2/users/{auth_id}/roles"
        role_response = requests.post(
            roles_url,
            headers=headers,
            json={"roles": [DIYER_ROLE_ID]},
        )
        role_response.raise_for_status()
    except requests.exceptions.RequestException as e:
        logger.error(f"[CompleteDiySignup] Auth0 error for {auth_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign DIY role in Auth0",
        )

    current_user.roles = ["diyer"]
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)

    logger.info(f"[CompleteDiySignup] Assigned diyer role to {current_user.email}")
    return {"ok": True, "roles": current_user.roles}