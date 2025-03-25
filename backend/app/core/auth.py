from fastapi import Depends, status, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from datetime import datetime, timedelta
import logging
from typing import Optional, Dict, Any, Union, List
import requests
from pydantic import BaseModel, ConfigDict
from functools import lru_cache
import json
import os
import aiohttp
import uuid

from app.config import settings
from app.db.database import get_db
from app.models.user import User
from app.core.exceptions import AuthenticationException, AuthorizationException, NotFoundException

logger = logging.getLogger(__name__)

# Create a custom security class that provides more detailed error messages
class CustomHTTPBearer(HTTPBearer):
    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)
        
    async def __call__(self, request):
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
    """JWT Token model for validation"""
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "sub": "auth0|123456789",
                "exp": 1735689600,
                "iat": 1635689600,
                "azp": "your-client-id",
                "scope": "openid profile email",
                "permissions": ["read:users", "write:users"]
            }
        }
    )

    sub: str
    exp: int
    iat: Optional[int] = None
    azp: Optional[str] = None
    scope: Optional[str] = None
    permissions: Optional[List[str]] = None
    
    @property
    def scopes(self) -> List[str]:
        """Convert space-separated scope string to list"""
        return self.scope.split() if self.scope else []

class AuthHandler:
    """Enhanced authentication handler with proper JWT validation"""
    
    def __init__(self):
        """Initialize the auth handler with settings"""
        self.domain = settings.AUTH0_DOMAIN
        if not self.domain:
            raise ValueError("AUTH0_DOMAIN is not configured")
            
        self.audience = settings.AUTH0_API_AUDIENCE
        if not self.audience:
            raise ValueError("AUTH0_API_AUDIENCE is not configured")
            
        self.issuer = settings.AUTH0_ISSUER or f"https://{self.domain}/"
        self.algorithms = settings.AUTH0_ALGORITHMS
        self.jwks = None
        self.jwks_last_updated = None
        self.jwks_cache_duration = timedelta(hours=24)
        self._private_key = None
        
        logger.info(f"AuthHandler initialized with domain: {self.domain}, issuer: {self.issuer}")
        
    def _load_private_key(self) -> str:
        """Load private key from file"""
        if not self._private_key and settings.JWT_PRIVATE_KEY_PATH:
            try:
                with open(settings.JWT_PRIVATE_KEY_PATH, 'r') as f:
                    self._private_key = f.read()
            except Exception as e:
                logger.error(f"Failed to load private key: {e}")
                raise AuthenticationException("Failed to load private key")
        return self._private_key
        
    def get_client_credentials_token(self) -> str:
        """Get access token using client credentials flow"""
        try:
            private_key = self._load_private_key()
            if not private_key:
                raise AuthenticationException("Private key not configured")
                
            now = datetime.utcnow()
            payload = {
                "iss": settings.AUTH0_CLIENT_ID,
                "sub": settings.AUTH0_CLIENT_ID,
                "aud": f"https://{self.domain}/api/v2/",
                "iat": now,
                "exp": now + timedelta(hours=1)
            }
            
            client_assertion = jwt.encode(
                payload,
                private_key,
                algorithm='RS256'
            )
            
            token_url = f"https://{self.domain}/oauth/token"
            data = {
                "grant_type": "client_credentials",
                "client_id": settings.AUTH0_CLIENT_ID,
                "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                "client_assertion": client_assertion,
                "audience": self.audience
            }
            
            response = requests.post(token_url, json=data)
            response.raise_for_status()
            
            return response.json()["access_token"]
            
        except Exception as e:
            logger.error(f"Failed to get client credentials token: {e}")
            raise AuthenticationException("Failed to get access token")
        
    async def get_jwks(self):
        """Fetch JWKS from Auth0"""
        try:
            if (not self.jwks or 
                not self.jwks_last_updated or 
                datetime.utcnow() - self.jwks_last_updated > self.jwks_cache_duration):
                
                jwks_url = f"https://{self.domain}/.well-known/jwks.json"
                logger.info(f"Fetching JWKS from {jwks_url}")
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(jwks_url) as response:
                        if response.status != 200:
                            error_text = await response.text()
                            logger.error(f"JWKS fetch failed with status {response.status}: {error_text}")
                            raise AuthenticationException(f"Failed to fetch JWKS: {error_text}")
                        
                        self.jwks = await response.json()
                        self.jwks_last_updated = datetime.utcnow()
                        logger.info("JWKS fetched and cached successfully")
                
            return self.jwks
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {str(e)}")
            raise AuthenticationException(f"Failed to fetch JWKS: {str(e)}")
    
    async def get_rsa_key(self, token: str) -> Optional[dict]:
        """Get RSA key from JWKS"""
        try:
            unverified_header = jwt.get_unverified_header(token)
            jwks = await self.get_jwks()
            
            for key in jwks["keys"]:
                if key["kid"] == unverified_header["kid"]:
                    return {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"]
                    }
        except Exception as e:
            logger.error(f"Failed to get RSA key: {e}")
            return None
            
        return None
    
    async def verify_token(self, token: str) -> JWTToken:
        """Verify JWT token and return decoded payload"""
        try:
            logger.info("Starting token verification")
            # Get unverified headers first
            unverified_headers = jwt.get_unverified_header(token)
            logger.debug(f"Token header (unverified): {unverified_headers}")

            # Get the RSA key
            rsa_key = await self.get_rsa_key(token)
            if not rsa_key:
                logger.error("No valid RSA key found for token")
                raise AuthenticationException("No valid key found for token")

            try:
                # Verify the token
                payload = jwt.decode(
                    token,
                    rsa_key,
                    algorithms=self.algorithms,
                    audience=self.audience,
                    issuer=self.issuer
                )
                logger.debug(f"Token verification successful")
                
                # Validate token model
                token_data = JWTToken(**payload)
                return token_data
                
            except JWTError as e:
                logger.error(f"JWT decode error: {e}")
                raise AuthenticationException(f"Invalid token: {e}")
                
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            raise AuthenticationException(str(e))
    
    async def auth_wrapper(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> JWTToken:
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
    
    async def get_auth0_user_info(self, access_token: str) -> dict:
        """Get user info from Auth0 userinfo endpoint"""
        try:
            userinfo_url = f"https://{settings.AUTH0_DOMAIN}/userinfo"
            logger.info(f"Fetching user info from {userinfo_url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    userinfo_url,
                    headers={"Authorization": f"Bearer {access_token}"}
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"User info fetch failed: {error_text}")
                        raise AuthenticationException(f"Failed to get user info: {error_text}")
                    
                    user_info = await response.json()
                    logger.info("User info fetched successfully")
                    return user_info
                    
        except Exception as e:
            logger.error(f"Failed to get user info: {str(e)}")
            raise AuthenticationException(f"Failed to get user info: {str(e)}")
    
    async def get_current_user(
        self, token: Optional[HTTPAuthorizationCredentials] = Depends(security), db: Session = Depends(get_db)
    ) -> User:
        """
        Validates the token and returns the current user.
        Raises HTTPException if token is invalid or user is not found.
        """
        # Print full token information for debugging
        request_id = str(uuid.uuid4())
        logger.info(f"[{request_id}] get_current_user called")
        logger.info(f"[{request_id}] Token object: {token}")
        
        if not token:
            logger.error(f"[{request_id}] No authentication token provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        try:
            # Extract the actual token from the credentials object
            token_str = token.credentials
            logger.info(f"[{request_id}] Token extracted: {token_str[:10]}...")
            
            # Use the verify_token method which already handles JWT verification
            token_data = await self.verify_token(token_str)
            user_id = token_data.sub
            logger.info(f"[{request_id}] User ID from token: {user_id}")
            
            if user_id is None:
                logger.error(f"[{request_id}] Token validation failed: missing subject claim")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )
                
            # Find the user with the matching auth_id
            user = db.query(User).filter(User.auth_id == user_id).first()
            if user is None:
                logger.error(f"[{request_id}] User not found for auth_id: {user_id}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            logger.info(f"[{request_id}] User found: {user.email}, role: {user.role}")
            return user
            
        except JWTError as e:
            logger.error(f"[{request_id}] JWT error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            logger.error(f"[{request_id}] Authentication error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication failed: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    async def get_current_user_optional(
        self, token: Optional[HTTPAuthorizationCredentials] = Depends(security), db: Session = Depends(get_db)
    ) -> Optional[User]:
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
            user_id = token_data.sub
            
            if user_id is None:
                logger.debug("Token validation failed: missing subject claim")
                return None
                
            # Find the user with the matching auth_id
            user = db.query(User).filter(User.auth_id == user_id).first()
            return user
            
        except JWTError as e:
            logger.debug(f"JWT error in optional auth: {str(e)}")
            return None
        except Exception as e:
            logger.debug(f"Authentication error in optional auth: {str(e)}")
            return None
    
    def require_permissions(self, required_permissions: List[str]):
        """Decorator to check if user has required permissions"""
        async def permission_checker(
            token: JWTToken = Depends(self.auth_wrapper)
        ):
            token_permissions = token.permissions or []
            for permission in required_permissions:
                if permission not in token_permissions:
                    raise AuthorizationException(
                        f"Missing required permission: {permission}"
                    )
            return token
        return permission_checker
    
    def require_scope(self, required_scope: str):
        """Decorator to check if token has required scope"""
        async def scope_checker(
            token: JWTToken = Depends(self.auth_wrapper)
        ):
            if required_scope not in token.scopes:
                raise AuthorizationException(
                    f"Missing required scope: {required_scope}"
                )
            return token
        return scope_checker
    
    async def verify_admin(
        self, 
        user: User = Depends(get_current_user)
    ) -> User:
        """Verify that the user has admin role"""
        logger.info(f"Verifying admin role for user: {user.email}")
        if user.role != "admin":
            logger.error(f"Admin role required, but user {user.email} has role {user.role}")
            raise AuthorizationException("Admin role required")
        logger.info(f"Admin role verified for user: {user.email}")
        return user

    async def verify_manager(
        self,
        user: User = Depends(get_current_user)
    ) -> User:
        """Verify that the user has manager role"""
        if user.role != "manager":
            raise AuthorizationException("Manager role required")
        return user

    async def verify_manager_or_admin(
        self,
        user: User = Depends(get_current_user)
    ) -> User:
        """Verify that the user has either manager or admin role"""
        if user.role not in ["admin", "manager"]:
            raise AuthorizationException("Manager or Admin role required")
        return user

    async def verify_technician(
        self,
        user: User = Depends(get_current_user)
    ) -> User:
        """Verify that the user has technician role"""
        if user.role != "technician":
            raise AuthorizationException("Technician role required")
        return user

    async def verify_client(
        self,
        user: User = Depends(get_current_user)
    ) -> User:
        """Verify that the user has client role"""
        if user.role != "client":
            raise AuthorizationException("Client role required")
        return user

    async def can_access_work_order(self, work_order_id: uuid.UUID, user: User, db: Session) -> bool:
        """
        Check if user can access a specific work order.
        
        - Admins and managers can access all work orders
        - Technicians can only access work orders assigned to them
        - Clients can only access their own work orders
        """
        logger.info(f"Checking work order access for user {user.id} with role {user.role}")
        
        # Admins and managers have full access
        if user.role in ["admin", "manager"]:
            return True
            
        # Get the work order to check permissions
        from app.models.work_order import WorkOrder
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        
        if not work_order:
            logger.error(f"Work order {work_order_id} not found")
            return False
            
        # Technician access check
        if user.role == "technician":
            from app.models.technician import Technician
            technician = db.query(Technician).filter(Technician.user_id == user.id).first()
            if not technician:
                logger.error(f"Technician profile not found for user {user.id}")
                return False
                
            # Check if work order is assigned to this technician
            return work_order.technician_id == technician.id
            
        # Client access check
        if user.role == "client":
            from app.models.client import Client
            client = db.query(Client).filter(Client.user_id == user.id).first()
            if not client:
                logger.error(f"Client profile not found for user {user.id}")
                return False
                
            # Check if work order belongs to this client
            return work_order.client_id == client.id
            
        # Default deny for unknown roles
        logger.error(f"Unknown role {user.role} for user {user.id}")
        return False

# Initialize auth handler lazily
_auth_handler = None

def get_auth_handler() -> AuthHandler:
    """Get or create the auth handler instance"""
    global _auth_handler
    if _auth_handler is None:
        try:
            _auth_handler = AuthHandler()
            logger.info("AuthHandler initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize AuthHandler: {str(e)}")
            raise
    return _auth_handler