from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import logging

from app.db.database import get_db
from app.core.auth import get_auth_handler, AuthUser
from app.models.skill import Skill
from app.schemas.skill import (
    SkillCreate, SkillUpdate, SkillResponse, SkillListResponse
)
from app.services.skill_service import SkillService
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

router = APIRouter()
logger = logging.getLogger(__name__)

async def get_current_user_dependency(request: Request = None):
    """Lazy-loaded dependency for current user"""
    try:
        auth_handler = get_auth_handler()
        # Extract token from Authorization header
        token = None
        if request and "Authorization" in request.headers:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                token = auth.replace("Bearer ", "")
                logger.info(f"Token extracted from Authorization header, length: {len(token)}")
        
        user = await auth_handler.get_current_user(token)
        if not user:
            logger.warning("Authentication failed: No user returned from auth handler")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
    except Exception as e:
        logger.error(f"Authentication error in skills router: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_manager_or_admin_dependency(request: Request = None):
    """Lazy-loaded dependency for manager or admin"""
    auth_handler = get_auth_handler()
    
    token = None
    if request and "Authorization" in request.headers:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.replace("Bearer ", "")
            logger.info(f"Token extracted from Authorization header, length: {len(token)}")
    
    return await auth_handler.verify_manager_or_admin(token)

@router.get("/", response_model=SkillListResponse)
async def get_skills(
    request: Request,
    search: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a paginated list of skills with optional filtering.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} retrieving skills with filters: search={search}, category={category}, is_active={is_active}")
    
    try:
        result = await SkillService.get_skills(
            db=db, 
            search=search,
            category=category,
            is_active=is_active,
            skip=skip, 
            limit=limit
        )
        
        logger.info(f"Retrieved {len(result['items'])} skills")
        return result
    except Exception as e:
        logger.error(f"Error retrieving skills: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    request: Request,
    skill: SkillCreate,
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Create a new skill.
    Only managers and admins can create skills.
    """
    logger.info(f"User {current_user.email} creating new skill: {skill.name}")
    
    try:
        result = await SkillService.create_skill(db=db, skill_data=skill)
        logger.info(f"Skill created successfully with ID: {result.id}")
        return result
    except ConflictException as e:
        logger.warning(f"Conflict creating skill: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationException as e:
        logger.warning(f"Validation error creating skill: {str(e)}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating skill: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(
    request: Request,
    skill_id: uuid.UUID = Path(...),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a specific skill by ID.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} retrieving skill with ID: {skill_id}")
    
    try:
        result = await SkillService.get_skill(db=db, skill_id=skill_id)
        logger.info(f"Skill retrieved successfully: {result.name}")
        return result
    except NotFoundException as e:
        logger.warning(f"Skill not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving skill: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    request: Request,
    skill_id: uuid.UUID = Path(...),
    skill_update: SkillUpdate = Body(...),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Update a skill.
    Only managers and admins can update skills.
    """
    logger.info(f"User {current_user.email} updating skill with ID: {skill_id}")
    
    try:
        result = await SkillService.update_skill(
            db=db, 
            skill_id=skill_id, 
            skill_update=skill_update
        )
        logger.info(f"Skill updated successfully: {result.name}")
        return result
    except NotFoundException as e:
        logger.warning(f"Skill not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        logger.warning(f"Conflict updating skill: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationException as e:
        logger.warning(f"Validation error updating skill: {str(e)}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating skill: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    request: Request,
    skill_id: uuid.UUID = Path(...),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Delete a skill.
    Only managers and admins can delete skills.
    """
    logger.info(f"User {current_user.email} deleting skill with ID: {skill_id}")
    
    try:
        await SkillService.delete_skill(db=db, skill_id=skill_id)
        logger.info(f"Skill deleted successfully: {skill_id}")
        return None
    except NotFoundException as e:
        logger.warning(f"Skill not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting skill: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) 