from fastapi import Depends, status, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from datetime import datetime, timedelta
import logging
from typing import Optional, Dict, Any, Union, List
import requests
from pydantic import BaseModel, ConfigDict, Field
from functools import lru_cache
import json
import os
import aiohttp
import uuid
import httpx
from fastapi import Request

from app.config import settings
from app.db.database import get_db
from app.models.user import User as DBUser
from app.core.exceptions import AuthenticationException, AuthorizationException, NotFoundException

logger = logging.getLogger(__name__)

# Create a custom security class that provides more detailed error messages
class CustomHTTPBearer(HTTPBearer):
    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)
        
    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        try:
            return await super().__call__(request)
        except HTTPException as e:
            logger.warning(f"Authentication error in CustomHTTPBearer: {e.detail}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication failed: {e.detail}",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except Exception as e:
            logger.error(f"Unexpected error in CustomHTTPBearer: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication failed: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"}
            )

# Use our custom HTTP bearer
security = CustomHTTPBearer(auto_error=True)

# JWT Token model
class JWTToken(BaseModel):
    """JWT token model with Auth0 fields"""
    # Required fields
    sub: str
    exp: int
    iat: int
    # Common Auth0 fields
    azp: Optional[str] = None
    scope: Optional[str] = None
    permissions: Optional[List[str]] = Field(default_factory=list)
    # Identity fields - might be named differently depending on setup
    email: Optional[str] = None
    name: Optional[str] = None
    nickname: Optional[str] = None
    picture: Optional[str] = None
    # Role-related fields
    roles: Optional[List[str]] = Field(default_factory=list)
    
    # Model configuration for docs and examples
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "sub": "auth0|123456789",
                "exp": 1735689600,
                "iat": 1635689600,
                "azp": "your-client-id",
                "scope": "openid profile email",
                "permissions": ["read:users", "write:users"],
                "email": "user@example.com",
                "name": "John Doe",
                "nickname": "johndoe",
                "picture": "https://example.com/profile.jpg",
                "roles": ["admin", "user"]
            }
        }
    )

    @property
    def scopes(self) -> List[str]:
        """Convert scope string to list of scopes"""
        if not self.scope:
            return []
        return self.scope.split()

class TokenData(BaseModel):
    sub: str
    exp: int
    iat: Optional[int] = None
    iss: Optional[str] = None
    aud: Optional[List[str]] = None
    azp: Optional[str] = None
    scope: Optional[str] = None
    permissions: Optional[List[str]] = None
    email: Optional[str] = None
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    nickname: Optional[str] = None
    picture: Optional[str] = None
    updated_at: Optional[str] = None
    roles: Optional[List[str]] = None

    # Store the raw token data for debugging
    raw_payload: Optional[Dict[str, Any]] = None

class AuthHandler:
    """Auth0 Authentication Handler for verifying JWTs"""
    
    def __init__(self, domain: str, audience: str):
        self.domain = domain
        self.audience = audience
        self.jwks_uri = f"https://{domain}/.well-known/jwks.json"
        self.jwks = None
        self.jwks_last_updated = None
        self.algorithm = "RS256"  # Auth0 uses RS256 by default
        
    async def get_jwks(self) -> Dict[str, Any]:
        """Fetch the JWKS from Auth0"""
        # Check if we've already fetched the JWKS and if it's still fresh
        if self.jwks and self.jwks_last_updated and \
           (datetime.utcnow() - self.jwks_last_updated) < timedelta(hours=24):
            return self.jwks
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.jwks_uri)
                response.raise_for_status()
                
                self.jwks = response.json()
                self.jwks_last_updated = datetime.utcnow()
                return self.jwks
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Failed to fetch JWKS from Auth0"
            )
    
    async def verify_token(self, token: str) -> TokenData:
        """Verify the JWT token"""
        try:
            # Decode token without verification to get kid
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
            
            if not kid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token header: No kid found"
                )
            
            # Get JWKS
            jwks = await self.get_jwks()
            
            # Find the right key
            rsa_key = None
            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    rsa_key = {
                        "kty": key.get("kty"),
                        "kid": key.get("kid"),
                        "use": key.get("use"),
                        "n": key.get("n"),
                        "e": key.get("e")
                    }
                    break
            
            if not rsa_key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unable to find appropriate key"
                )
            
            # Verify the token
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=[self.algorithm],
                audience=self.audience,
                issuer=f"https://{self.domain}/"
            )
            
            # Debug: Log the token payload for debugging
            logger.debug(f"Token payload: {json.dumps(payload, indent=2)}")
            
            # Extract roles from different possible locations in the token
            roles = []
            
            # Method 1: Check standard namespace
            if 'roles' in payload:
                roles = payload['roles']
            
            # Method 2: Check Auth0 namespace
            if f'https://{self.domain}/roles' in payload:
                roles = payload[f'https://{self.domain}/roles']
            
            # Method 3: Check custom namespace
            if 'https://idimsapi/app_metadata' in payload and 'roles' in payload['https://idimsapi/app_metadata']:
                roles = payload['https://idimsapi/app_metadata']['roles']
            
            # Extract email from different possible locations
            email = None
            if 'email' in payload:
                email = payload['email']
            elif 'https://idimsapi/email' in payload:
                email = payload['https://idimsapi/email']
            
            # Extract name from different possible locations
            name = None
            if 'name' in payload:
                name = payload['name']
            elif 'https://idimsapi/name' in payload:
                name = payload['https://idimsapi/name']
            
            # Extract other standard OIDC claims if present
            given_name = payload.get('given_name')
            family_name = payload.get('family_name')
            nickname = payload.get('nickname')
            picture = payload.get('picture')
            updated_at = payload.get('updated_at')
            
            # Create TokenData object
            token_data = TokenData(
                sub=payload["sub"],
                exp=payload["exp"],
                iat=payload.get("iat"),
                iss=payload.get("iss"),
                aud=payload.get("aud"),
                azp=payload.get("azp"),
                scope=payload.get("scope"),
                permissions=payload.get("permissions"),
                email=email,
                name=name,
                given_name=given_name,
                family_name=family_name,
                nickname=nickname,
                picture=picture,
                updated_at=updated_at,
                roles=roles,
                raw_payload=payload  # Store the raw payload for debugging
            )
            
            logger.info(f"Verified token for user {token_data.sub}, roles: {token_data.roles}")
            
            return token_data
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.JWTClaimsError:
            logger.warning("Invalid claims")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid claims: check audience and issuer"
            )
        except jwt.JWTError:
            logger.warning("Invalid token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification failed: {str(e)}"
            )
    
    async def get_current_user(self, request_or_token: Union[Request, str, None] = None, token: str = None, db: Session = None) -> DBUser:
        """
        Get current user from database based on token.
        If user doesn't exist, create a new one.
        
        This method supports both old and new call patterns:
        - Old: await get_current_user(token)
        - New: await get_current_user(request, token, db)
        """
        # Handle backward compatibility
        if isinstance(request_or_token, str) and token is None:
            # Old call pattern: first argument is the token
            token = request_or_token
            request_or_token = None
        
        # Ensure we have a database session
        if db is None:
            db = next(get_db())
            
        # Get token data
        token_data = await self.verify_token(token)
        
        try:
            # Extract user information from token
            auth_id = token_data.sub
            email = token_data.email
            
            # Try to get profile info from token claims
            user_profile = {}
            raw_payload = {}
            
            # Check for profile info in custom claims
            if hasattr(token_data, 'raw_payload'):
                payload = token_data.raw_payload or {}
                raw_payload = payload
                logger.info(f"Token payload: {json.dumps(payload, default=str)}")
                
                # Try to get profile from various possible locations in token
                profile_sources = [
                    payload.get('https://idimsapi/user_profile', {}),
                    payload.get('https://idimsapi/user_metadata', {}),
                    payload
                ]
                
                # Use the first source that has profile data
                for source in profile_sources:
                    if source and isinstance(source, dict):
                        user_profile = source
                        if user_profile.get('name') or user_profile.get('email'):
                            logger.info(f"Found profile data in token: {user_profile.get('name', 'unknown')}")
                            break
                
                # Extract Auth0 roles if present
                auth0_roles = []
                # Check app_metadata first
                app_metadata = payload.get('https://idimsapi/app_metadata', {})
                if app_metadata and isinstance(app_metadata, dict) and 'roles' in app_metadata:
                    auth0_roles = app_metadata.get('roles', [])
                    logger.info(f"Found roles in app_metadata: {auth0_roles}")
                # Then check direct roles claim
                elif 'roles' in payload:
                    auth0_roles = payload.get('roles', [])
                    logger.info(f"Found roles in payload: {auth0_roles}")
            
            # Extract name information
            name = user_profile.get('name') or token_data.name or ""
            given_name = user_profile.get('given_name') or getattr(token_data, 'given_name', None)
            family_name = user_profile.get('family_name') or getattr(token_data, 'family_name', None)
            
            # If we have a name but not components, split it
            name_parts = name.split() if name else []
            if name_parts and not given_name:
                given_name = name_parts[0]
            if len(name_parts) > 1 and not family_name:
                family_name = ' '.join(name_parts[1:])
                
            # Get the best values available
            first_name = given_name or "User"
            
            # For Google OAuth users, extract last name from auth_id if necessary
            if not family_name and auth_id and auth_id.startswith('google-oauth2|'):
                user_id = auth_id.split('|')[1]
                family_name = user_id[-6:] if user_id else ""
            else:
                family_name = family_name or ""
                
            # Get profile picture if available
            picture = user_profile.get('picture') or getattr(token_data, 'picture', None)
            
            # Extract roles from token data or Auth0 metadata
            roles = token_data.roles or auth0_roles or []
            permissions = token_data.permissions or []
            
            # Get real email address (more aggressive)
            real_email = None
            
            # Method 1: Direct payload email key (most reliable)
            if 'email' in raw_payload:
                real_email = raw_payload.get('email')
                logger.info(f"Found email in raw payload: {real_email}")
            
            # Method 2: User profile email
            if not real_email and user_profile.get('email'):
                real_email = user_profile.get('email')
                logger.info(f"Found email in user profile: {real_email}")
            
            # Method 3: Token data email
            if not real_email and token_data.email and '@example.com' not in token_data.email:
                real_email = token_data.email
                logger.info(f"Using token_data email: {real_email}")
            
            # Method 4: Check for OAuth profile email
            if not real_email and 'https://idimsapi/email' in raw_payload:
                real_email = raw_payload.get('https://idimsapi/email')
                logger.info(f"Found email in idimsapi namespace: {real_email}")
            
            # Final fallback - if we still don't have a real email, use whatever we have
            if not real_email:
                real_email = email or f"{auth_id}@example.com"
                logger.warning(f"No real email found, using placeholder: {real_email}")
            
            # Debug all the email extraction attempts
            logger.info(f"Email extraction results - Original: {email}, Final: {real_email}")
            logger.info(f"Extracted user info - Auth ID: {auth_id}, Email: {real_email}, Roles: {roles}")
            
            # Look for existing user in database
            user = None
            
            # First try by auth_id
            if auth_id:
                user = db.query(DBUser).filter(DBUser.auth_id == auth_id).first()
                if user:
                    logger.info(f"Found user by auth_id: {user.id}")
            
            # If not found by auth_id, try by email
            if not user and real_email:
                user = db.query(DBUser).filter(DBUser.email == real_email).first()
                if user:
                    logger.info(f"Found user by email: {user.id}")
            
            # If user exists, update profile info if needed
            if user:
                logger.info(f"Found existing user: {user.id}, checking for profile updates")
                
                # Check if we need to update user information
                update_needed = False
                
                # Always update auth_id if it's not set
                if auth_id and not user.auth_id:
                    user.auth_id = auth_id
                    update_needed = True
                    logger.info(f"Updating auth_id to: {auth_id}")
                
                # Update email if we have a better one
                if real_email and ('@example.com' in user.email or user.email != real_email):
                    user.email = real_email
                    update_needed = True
                    logger.info(f"Updating user email to: {real_email}")
                
                # Update name if we have better data
                if first_name != "User" and user.first_name == "User":
                    user.first_name = first_name
                    update_needed = True
                    logger.info(f"Updating first name to: {first_name}")
                    
                if family_name and (not user.last_name or user.last_name.isdigit()):
                    user.last_name = family_name
                    update_needed = True
                    logger.info(f"Updating last name to: {family_name}")
                
                # Update picture if available
                if picture and not user.avatar_url:
                    user.avatar_url = picture
                    update_needed = True
                    logger.info(f"Updating profile picture")
                
                # Always sync roles from Auth0
                if roles:
                    # Check if roles need to be updated
                    current_roles = user.roles or []
                    roles_set = set(roles)
                    current_roles_set = set(current_roles)
                    
                    if roles_set != current_roles_set:
                        user.roles = list(roles)
                        update_needed = True
                        logger.info(f"Updating roles from {current_roles} to {roles}")
                
                # Update last login time
                user.last_login = datetime.utcnow()
                update_needed = True
                
                # Save changes if needed
                if update_needed:
                    logger.info(f"Updating user profile for {user.id}")
                    try:
                        db.commit()
                        db.refresh(user)
                    except Exception as e:
                        db.rollback()
                        logger.error(f"Error updating user: {str(e)}")
            else:
                # Create new user
                logger.info(f"Creating new user for {auth_id} / {real_email}")
                
                # Default role if no roles specified
                if not roles:
                    roles = ["client"]
                    logger.info(f"No roles found, using default role: {roles}")
                
                try:
                    new_user = DBUser(
                        auth_id=auth_id,
                        email=real_email,
                        first_name=first_name,
                        last_name=family_name,
                        roles=roles,
                        is_active=True,
                        email_verified=token_data.email is not None,
                        avatar_url=picture,
                        last_login=datetime.utcnow(),
                        permissions=permissions
                    )
                    
                    db.add(new_user)
                    db.commit()
                    db.refresh(new_user)
                    user = new_user
                    logger.info(f"Created new user with ID: {user.id}")
                except Exception as e:
                    db.rollback()
                    logger.error(f"Error creating user: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Database error: {str(e)}"
                    )
            
            logger.info(f"Returning user: ID={user.id}, Email={user.email}, Roles={user.roles}")
            # Return the user
            return user
            
        except Exception as e:
            logger.error(f"Error getting current user: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Error getting current user: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"}
            )
    
    async def auth_wrapper(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenData:
        """Dependency for token authentication"""
        try:
            # Log the incoming token for debugging
            logger.info("Processing auth_wrapper request with provided credentials")
            if not credentials:
                logger.warning("No credentials provided to auth_wrapper")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="No credentials provided",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            token = credentials.credentials
            logger.debug(f"Token found, starting verification (length: {len(token)})")
            token_data = await self.verify_token(token)
            logger.info(f"Token verified successfully for subject: {token_data.sub}")
            return token_data
        except Exception as e:
            logger.error(f"Authentication failed in auth_wrapper: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e),
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    async def get_current_user_optional(
        self, token: Optional[HTTPAuthorizationCredentials] = Depends(security), db: Session = Depends(get_db)
    ) -> Optional[DBUser]:
        """
        Similar to get_current_user but returns None instead of raising exceptions
        when authentication fails. Useful for endpoints that should work both
        with and without authentication.
        """
        if not token:
            logger.debug("No authentication token provided in optional auth")
            return None
            
        try:
            # Extract the actual token from the credentials object
            token_str = token.credentials
            
            # Use the verify_token method which already handles JWT verification
            token_data = await self.verify_token(token_str)
            
            # Create user from token data
            user_info = {
                "id": token_data.sub,
                "sub": token_data.sub,
                "email": token_data.email or f"{token_data.sub}@example.com",
                "name": token_data.name or token_data.nickname or token_data.sub,
                "roles": token_data.roles or [],
                "permissions": token_data.permissions or []
            }
            
            return DBUser(**user_info)
            
        except Exception as e:
            logger.debug(f"Authentication error in optional auth: {str(e)}")
            return None
    
    async def verify_admin(self, token: Optional[str] = None, request: Optional[Request] = None, db: Optional[Session] = None) -> DBUser:
        """Verify that the user has admin role"""
        user = await self.get_current_user(request, token, db)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        logger.info(f"Verifying admin role for user: {user.email}")
        if "admin" not in user.roles:
            logger.error(f"Admin role required, but user {user.email} has roles {user.roles}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role required"
            )
        logger.info(f"Admin role verified for user: {user.email}")
        return user
    
    async def verify_manager(self, token: Optional[str] = None, request: Optional[Request] = None, db: Optional[Session] = None) -> DBUser:
        """Verify that the user has manager role"""
        user = await self.get_current_user(request, token, db)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        if "manager" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Manager role required"
            )
        return user
    
    async def verify_manager_or_admin(self, token: Optional[str] = None, request: Optional[Request] = None, db: Optional[Session] = None) -> DBUser:
        """Verify that the user has either manager or admin role"""
        user = await self.get_current_user(request, token, db)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        if not any(role in ["admin", "manager"] for role in user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Manager or Admin role required"
            )
        return user
    
    async def verify_technician(self, token: Optional[str] = None, request: Optional[Request] = None, db: Optional[Session] = None) -> DBUser:
        """Verify that the user has technician role"""
        user = await self.get_current_user(request, token, db)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"}
            )
            
        if "technician" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Technician role required"
            )
        return user
    
    async def verify_client(self, user: DBUser = Depends(get_current_user)) -> DBUser:
        """Verify that the user has client role"""
        if "client" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Client role required"
            )
        return user

    async def get_auth0_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Retrieve user profile information from Auth0 userinfo endpoint.
        
        Args:
            access_token: The access token for the authenticated user
            
        Returns:
            Dictionary containing user profile information
            
        Raises:
            HTTPException: If the request to Auth0 userinfo fails
        """
        userinfo_url = f"https://{self.domain}/userinfo"
        
        try:
            logger.info(f"Fetching user info from Auth0: {userinfo_url}")
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    userinfo_url,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                response.raise_for_status()
                
                user_info = response.json()
                logger.info(f"Retrieved user info for: {user_info.get('email', 'unknown')}")
                logger.debug(f"User info details: {json.dumps(user_info, indent=2, default=str)}")
                
                return user_info
                
        except httpx.HTTPStatusError as e:
            error_msg = f"Error fetching user info from Auth0: {e.response.status_code} - {e.response.text}"
            logger.error(error_msg)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error_msg
            )
        except Exception as e:
            error_msg = f"Unexpected error fetching user info from Auth0: {str(e)}"
            logger.error(error_msg)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_msg
            )

def get_auth_handler() -> AuthHandler:
    """Get the Auth0 authentication handler"""
    if not settings.AUTH0_DOMAIN or not settings.AUTH0_API_AUDIENCE:
        logger.error("Auth0 configuration missing")
        raise ValueError("Auth0 configuration is incomplete")
        
    return AuthHandler(
        domain=settings.AUTH0_DOMAIN,
        audience=settings.AUTH0_API_AUDIENCE
    )

# Helper function to check if a user has required roles
def has_required_roles(token_data: TokenData, required_roles: List[str]) -> bool:
    """Check if the user has any of the required roles"""
    if not token_data.roles or not required_roles:
        return False
        
    return any(role in token_data.roles for role in required_roles)

class AuthUser(BaseModel):
    """User model for authenticated users"""
    id: Optional[str] = None  # Auth0 user ID (sub claim)
    sub: Optional[str] = None # Same as id, but from the token
    email: str
    name: Optional[str] = None
    roles: List[str] = []
    permissions: List[str] = []