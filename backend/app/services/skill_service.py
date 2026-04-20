from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Dict, Any, List, Optional
import uuid
import logging
from datetime import datetime

from app.models.skill import Skill
from app.schemas.skill import SkillCreate, SkillUpdate
from app.core.exceptions import NotFoundException, ConflictException

logger = logging.getLogger(__name__)

class SkillService:
    """Service for handling skill operations"""
    
    @staticmethod
    async def get_skills(
        db: Session, 
        search: Optional[str] = None,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get skills with filtering and pagination"""
        query = db.query(Skill)
        
        # Apply filters
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Skill.name.ilike(search_term)) |
                (Skill.description.ilike(search_term))
            )
        
        if category:
            query = query.filter(Skill.category == category)
            
        if is_active is not None:
            query = query.filter(Skill.is_active == is_active)
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination
        query = query.order_by(Skill.name)
        skills = query.offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": skills,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit if limit > 0 else 1
        }
    
    @staticmethod
    async def get_skill(db: Session, skill_id: uuid.UUID) -> Skill:
        """Get a specific skill by ID"""
        skill = db.query(Skill).filter(Skill.id == skill_id).first()
        
        if not skill:
            raise NotFoundException(f"Skill with ID {skill_id} not found")
        
        return skill
    
    @staticmethod
    async def create_skill(db: Session, skill_data: SkillCreate) -> Skill:
        """Create a new skill"""
        try:
            # Check if skill with same name exists
            existing_skill = db.query(Skill).filter(Skill.name == skill_data.name).first()
            if existing_skill:
                raise ConflictException(f"Skill with name '{skill_data.name}' already exists")
            
            # Create skill
            new_skill = Skill(
                name=skill_data.name,
                description=skill_data.description,
                category=skill_data.category,
                is_active=skill_data.is_active,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(new_skill)
            db.commit()
            db.refresh(new_skill)
            
            logger.info(f"Created new skill: {new_skill.name}")
            return new_skill
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating skill: {str(e)}")
            raise ConflictException(f"Error creating skill: {str(e)}")
    
    @staticmethod
    async def update_skill(db: Session, skill_id: uuid.UUID, skill_update: SkillUpdate) -> Skill:
        """Update a skill"""
        skill = await SkillService.get_skill(db, skill_id)
        
        try:
            # Check name uniqueness if name is being updated
            if skill_update.name is not None and skill_update.name != skill.name:
                existing_skill = db.query(Skill).filter(Skill.name == skill_update.name).first()
                if existing_skill:
                    raise ConflictException(f"Skill with name '{skill_update.name}' already exists")
            
            # Update attributes if provided
            if skill_update.name is not None:
                skill.name = skill_update.name
            if skill_update.description is not None:
                skill.description = skill_update.description
            if skill_update.category is not None:
                skill.category = skill_update.category
            if skill_update.is_active is not None:
                skill.is_active = skill_update.is_active
                
            skill.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(skill)
            
            logger.info(f"Updated skill: {skill.id}")
            return skill
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating skill: {str(e)}")
            raise ConflictException(f"Error updating skill: {str(e)}")
    
    @staticmethod
    async def delete_skill(db: Session, skill_id: uuid.UUID) -> None:
        """Delete a skill"""
        skill = await SkillService.get_skill(db, skill_id)
        
        try:
            db.delete(skill)
            db.commit()
            logger.info(f"Deleted skill: {skill_id}")
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error deleting skill: {str(e)}")
            raise ConflictException(f"Error deleting skill: {str(e)}") 