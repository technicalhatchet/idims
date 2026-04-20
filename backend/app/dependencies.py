from typing import List, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials

# Imports from our auth module
from app.core.auth import AuthHandler, get_auth_handler, security # Import security object too
from app.models.user import User as DBUser # Import the DB User model
from app.schemas.user import UserResponse # UserResponse is still needed for role_checker's type hint
from app.db.database import get_db # Import get_db for the user lookup
from sqlalchemy.orm import Session # Use Session for synchronous DB operations if needed by auth
from sqlalchemy.ext.asyncio import AsyncSession # Keep AsyncSession if other parts use it


# Dependency to get the current user from the token
async def get_current_user(
    # Use the security dependency from auth.py to get the credentials
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security, use_cache=False), 
    auth_handler: AuthHandler = Depends(get_auth_handler),
    db: AsyncSession = Depends(get_db) # Assuming get_current_user in auth needs async session
                                         # Change to Session if it needs sync session
) -> Optional[DBUser]: # Return the DBUser model from auth handler
    """Dependency to get the current user from the token using AuthHandler."""
    if credentials is None:
        # This case might happen if security = CustomHTTPBearer(auto_error=False)
        # Or if the Authorization header is missing/malformed.
        print("DEBUG: get_current_user dependency - No credentials found.")
        # Depending on policy, could raise 401 here or let role_checker handle None
        return None 

    try:
        # The auth_handler.get_current_user might need the actual token string
        token = credentials.credentials
        
        # Call the method from AuthHandler - Make sure its signature matches!
        # It might expect request, token, and db session (sync or async).
        # Adjust the call based on the actual signature in auth.py
        # If it needs sync Session: db_sync: Session = Depends(get_db) # Adjust get_db if needed
        
        # Assuming auth_handler.get_current_user needs token and db (adjust if needed)
        user = await auth_handler.get_current_user(token=token, db=db)
        return user
    except HTTPException as e:
        # Re-raise HTTPExceptions (like 401, 403) from AuthHandler
        raise e
    except Exception as e:
        # Catch other potential errors during user retrieval
        print(f"ERROR: Unexpected error in get_current_user dependency: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve user information."
        )


def require_role(required_roles: List[str]):
    """
    FastAPI dependency factory that checks if the current user has at least one of the required roles.
    """
    # Use DBUser for the type hint here as that's what get_current_user now returns
    async def role_checker(current_user: Optional[DBUser] = Depends(get_current_user)) -> DBUser:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated or user not found.", # Updated detail
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check if the DBUser object has a 'roles' attribute
        # This depends on your User model definition in models/user.py
        user_roles_list = []
        if hasattr(current_user, 'roles') and current_user.roles:
             # Assuming current_user.roles is a relationship or similar that needs accessing
             # Adjust based on how roles are stored on your DBUser model (e.g., a list field, a relationship)
             if isinstance(current_user.roles, list):
                 # If it's already a list of strings (or Role objects with a 'name' attribute)
                 user_roles_list = [role.name if hasattr(role, 'name') else str(role) for role in current_user.roles]
             else:
                 # Handle other cases if necessary (e.g., relationship that needs iteration)
                 print(f"WARNING: User roles attribute is not a list: {type(current_user.roles)}")
        else:
            print(f"WARNING: User object (ID: {current_user.id}) has no 'roles' attribute or it's empty.")

        if not user_roles_list:
             print(f"ERROR: Could not determine roles for user {current_user.id}")
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User role information is missing or invalid."
             )

        # Check if user has any of the required roles
        user_roles_set = set(user_roles_list)
        print(f"DEBUG: Checking user roles {user_roles_set} against required {required_roles}")
        if not any(role in user_roles_set for role in required_roles):
            print(f"User {current_user.id} roles {user_roles_set} do not include required roles {required_roles}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have the required role(s): {', '.join(required_roles)}"
            )
            
        print(f"DEBUG: Role check passed for user {current_user.id}")
        return current_user
    
    return role_checker 