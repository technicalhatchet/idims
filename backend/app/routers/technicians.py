from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime, date

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.technician import Technician
from app.schemas.technician import (
    TechnicianCreate, TechnicianUpdate, TechnicianResponse, TechnicianListResponse
)
from app.services.technician_service import TechnicianService
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/technicians", response_model=TechnicianListResponse)
async def list_technicians(
    search: Optional[str] = Query(None, description="Search term for technician name or skills"),
    status: Optional[str] = Query(None, description="Filter by status"),
    skill: Optional[str] = Query(None, description="Filter by skill"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    List technicians with filtering and pagination.
    Only managers and admins can access this endpoint.
    """
    skip = (page - 1) * limit
    
    try:
        result = await TechnicianService.get_technicians(
            db=db,
            search=search,
            status=status,
            skill=skill,
            skip=skip,
            limit=limit
        )
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving technicians: {str(e)}"
        )

@router.post("/technicians", response_model=TechnicianResponse, status_code=status.HTTP_201_CREATED)
async def create_technician(
    technician_data: TechnicianCreate,
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new technician.
    Only managers and admins can create technicians.
    """
    try:
        return await TechnicianService.create_technician(db, technician_data, current_user.id)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating technician: {str(e)}"
        )

@router.get("/technicians/{technician_id}", response_model=TechnicianResponse)
async def get_technician(
    technician_id: uuid.UUID = Path(..., description="The ID of the technician to retrieve"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific technician by ID.
    Technicians can view their own profile, and managers/admins can view any profile.
    """
    # Check if technician is viewing their own profile
    if current_user.role == "technician":
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician or technician.id != technician_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this technician"
            )
    # Managers and admins can view any technician
    elif current_user.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view technician details"
        )
    
    try:
        return await TechnicianService.get_technician(db, technician_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving technician: {str(e)}"
        )

@router.put("/technicians/{technician_id}", response_model=TechnicianResponse)
async def update_technician(
    technician_id: uuid.UUID = Path(..., description="The ID of the technician to update"),
    technician_data: TechnicianUpdate = Body(...),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a technician.
    Technicians can update their own profile, and managers/admins can update any profile.
    """
    # Check if technician is updating their own profile
    if current_user.role == "technician":
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician or technician.id != technician_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this technician"
            )
        
        # Technicians can only update certain fields
        allowed_fields = ["skills", "certifications", "phone", "notes"]
        restricted_fields = [field for field in technician_data.__dict__ if field not in allowed_fields and technician_data.__dict__[field] is not None]
        
        if restricted_fields:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Technicians cannot update these fields: {', '.join(restricted_fields)}"
            )
    # Only managers and admins can update other properties
    elif current_user.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update technician details"
        )
    
    try:
        return await TechnicianService.update_technician(db, technician_id, technician_data)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating technician: {str(e)}"
        )

@router.delete("/technicians/{technician_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_technician(
    technician_id: uuid.UUID = Path(..., description="The ID of the technician to delete"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a technician.
    Only admins can delete technicians.
    """
    try:
        await TechnicianService.delete_technician(db, technician_id)
        return None
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting technician: {str(e)}"
        )

@router.get("/technicians/{technician_id}/workload", response_model=dict)
async def get_technician_workload(
    technician_id: uuid.UUID = Path(..., description="The ID of the technician"),
    start_date: date = Query(..., description="Start date for workload period"),
    end_date: date = Query(..., description="End date for workload period"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a technician's workload for a specific period.
    Shows assigned work orders, hours worked, and utilization.
    """
    # Check permissions
    if current_user.role == "technician":
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician or technician.id != technician_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this technician's workload"
            )
    elif current_user.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view technician workload"
        )
    
    try:
        # Convert dates to datetime for query
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        workload = await TechnicianService.get_technician_workload(
            db, technician_id, start_datetime, end_datetime
        )
        
        return workload
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving technician workload: {str(e)}"
        )

@router.get("/technicians/{technician_id}/performance", response_model=dict)
async def get_technician_performance(
    technician_id: uuid.UUID = Path(..., description="The ID of the technician"),
    period: str = Query("month", description="Period for performance metrics (week, month, quarter, year)"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Get a technician's performance metrics.
    Only managers and admins can access this endpoint.
    """
    try:
        performance = await TechnicianService.get_technician_performance(db, technician_id, period)
        return performance
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving technician performance: {str(e)}"
        )

@router.get("/technicians/skills", response_model=List[str])
async def get_all_skills(
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a list of all skills across all technicians.
    Used for filtering and form dropdowns.
    """
    try:
        skills = await TechnicianService.get_all_skills(db)
        return skills
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving skills: {str(e)}"
        )