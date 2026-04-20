import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
from typing import Optional, Dict, Any, List

from app.models.user import User
from app.models.client import Client
from app.models.technician import Technician
from app.core.auth import TokenData

logger = logging.getLogger(__name__)

class UserService:
    """Service for managing users and Auth0 synchronization"""
    
    @staticmethod
    async def sync_auth0_user(db: Session, token_data: TokenData) -> User:
        """
        Synchronize Auth0 user data with our database
        This function will create or update a user record based on Auth0 token data
        """
        # Extract user info from token data
        auth_id = token_data.sub
        
        # Try to find existing user first
        user = db.query(User).filter(User.auth_id == auth_id).first()
        
        # Get roles from token data
        roles = token_data.roles or []
        role = "admin" if "admin" in roles else "client"  # Default to client if no admin role
        
        if user:
            logger.info(f"Updating existing user with Auth0 ID: {auth_id}")
            # Update existing user with new data
            user.email = token_data.email or user.email
            user.first_name = token_data.given_name or token_data.name or user.first_name
            user.last_name = token_data.family_name or user.last_name
            user.avatar_url = token_data.picture or user.avatar_url
            user.email_verified = True  # Since Auth0 has verified this
            user.last_login = datetime.utcnow()
            
            # Update roles if changed
            if role not in user.roles:
                user.roles = [role]
                logger.info(f"Updated roles for user {auth_id} to {[role]}")
                
        else:
            logger.info(f"Creating new user from Auth0 ID: {auth_id}")
            # Create a new user
            user = User(
                auth_id=auth_id,
                email=token_data.email or f"{auth_id}@example.com",
                first_name=token_data.given_name or token_data.name or "User",
                last_name=token_data.family_name or auth_id[-6:],  # Use last part of sub as placeholder
                roles=[role],
                is_active=True,
                email_verified=True,
                avatar_url=token_data.picture,
                last_login=datetime.utcnow(),
                permissions=token_data.permissions or []
            )
            db.add(user)
            
            # If user is a client, create a client record
            if role == "client":
                client = Client(
                    user=user,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    email=user.email,
                    status="active"
                )
                db.add(client)
                logger.info(f"Created client record for user {auth_id}")
                
            # If user is a technician, create a technician record
            elif role == "technician":
                technician = Technician(
                    user=user,
                    skills=[],
                    status="active"
                )
                db.add(technician)
                logger.info(f"Created technician record for user {auth_id}")
        
        try:
            db.commit()
            logger.info(f"Successfully synchronized user {auth_id}")
            return user
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error synchronizing user {auth_id}: {str(e)}")
            raise Exception(f"Failed to synchronize user with database: {str(e)}")
    
    @staticmethod
    def get_user_by_auth_id(db: Session, auth_id: str) -> Optional[User]:
        """Get a user by Auth0 ID"""
        return db.query(User).filter(User.auth_id == auth_id).first()
    
    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Get a user by email"""
        return db.query(User).filter(User.email == email).first()
    
    @staticmethod
    def get_client_by_user_id(db: Session, user_id: str) -> Optional[Client]:
        """Get a client by user ID"""
        return db.query(Client).filter(Client.user_id == user_id).first()
    
    @staticmethod
    def get_technician_by_user_id(db: Session, user_id: str) -> Optional[Technician]:
        """Get a technician by user ID"""
        return db.query(Technician).filter(Technician.user_id == user_id).first() 