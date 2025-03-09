from fastapi import Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from datetime import datetime, timedelta
import logging
from typing import Optional, Dict, Any, Union
import requests
from pydantic import BaseModel

from app.config import settings
from app.db.database import get_db
from app.models.user import User
from app.core.exceptions import AuthenticationException, AuthorizationException, NotFoundException

logger = logging.getLogger(__name__)
security = HTTPBearer()

# JWT Token model
class JWTToken(BaseModel):
    """JWT Token model for validation"""
    sub: str
    exp: int
    iat: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    roles: Optional[list] = None

class AuthHandler:
    """Enhanced authentication handler"""
    
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.access_token_expire_minutes = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        self.auth0_domain = settings.AUTH0_DOMAIN
        self.auth0_audience = settings.AUTH0_API_AUDIENCE
    
    def create_access_token(self, data: dict) -> str:
        """Create a new JWT token with expiration time"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        to_encode.update({"exp": expire})
        
        token = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return token
    
    def verify_token(self, token: str) -> JWTToken:
        """Verify JWT token and return decoded payload"""
        try:
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=[self.algorithm],
                audience=self.auth0_audience
            )
            
            # Validate token structure
            return JWTToken(**payload)
        except JWTError as e:
            logger.error(f"JWT verification error: {e}")
            raise AuthenticationException("Invalid token")
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            raise AuthenticationException("Failed to process token")
    
    def auth_wrapper(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> JWTToken:
        """Wrapper for token authentication"""
        if not credentials:
            raise AuthenticationException("No credentials provided")
        
        return self.verify_token(credentials.credentials)
    
    def get_auth0_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user info from Auth0"""
        url = f"https://{self.auth0_domain}/userinfo"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Auth0 userinfo error: {e}")
            raise AuthenticationException("Failed to validate token with Auth0")
    
    async def get_current_user(
        self, 
        token: JWTToken = Depends(auth_wrapper), 
        db: Session = Depends(get_db)
    ) -> User:
        """Get current user from token"""
        try:
            user_id = token.sub
            if not user_id:
                raise AuthenticationException("Invalid user ID in token")
            
            user = db.query(User).filter(User.auth_id == user_id).first()
            if not user:
                raise NotFoundException("User not found")
            
            if not user.is_active:
                raise AuthorizationException("User is inactive")
                
            return user
        except AuthenticationException:
            raise
        except AuthorizationException:
            raise
        except NotFoundException:
            raise
        except Exception as e:
            logger.error(f"Get current user error: {e}")
            raise AuthenticationException("Failed to authenticate user")
    
    async def verify_admin(
        self, 
        user: User = Depends(get_current_user)
    ) -> User:
        """Verify that the user has admin role"""
        if user.role != "admin":
            raise AuthorizationException("Admin role required")
        return user
    
    async def verify_manager_or_admin(
        self, 
        user: User = Depends(get_current_user)
    ) -> User:
        """Verify that the user has manager or admin role"""
        if user.role not in ["admin", "manager"]:
            raise AuthorizationException("Manager or admin role required")
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
    
    async def can_access_work_order(
        self,
        work_order_id: str,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> bool:
        """Check if user can access a specific work order"""
        from app.models.work_order import WorkOrder
        
        # Admins and managers can access all work orders
        if user.role in ["admin", "manager"]:
            return True
        
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        if not work_order:
            raise NotFoundException("Work order not found")
        
        # Technicians can access only their assigned work orders
        if user.role == "technician":
            from app.models.technician import Technician
            technician = db.query(Technician).filter(Technician.user_id == user.id).first()
            if not technician:
                return False
            return work_order.assigned_technician_id == technician.id
        
        # Clients can access only their own work orders
        if user.role == "client":
            from app.models.client import Client
            client = db.query(Client).filter(Client.user_id == user.id).first()
            if not client:
                return False
            return work_order.client_id == client.id
        
        return False