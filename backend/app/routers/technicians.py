from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status, Request, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date, timedelta
import logging

from app.db.database import get_db
from app.core.auth import get_auth_handler, AuthUser
from app.models.technician import Technician
from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.schemas.technician import (
    TechnicianCreate, TechnicianUpdate, TechnicianResponse, TechnicianListResponse, TechnicianAvailability
)
from app.services.technician_service import TechnicianService
from app.services.user_service import UserService
from app.core.dependencies import get_current_user, get_admin_user, get_admin_or_manager_user
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
        logger.error(f"Authentication error in technicians router: {str(e)}", exc_info=True)
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

@router.get("", response_model=TechnicianListResponse)
@router.get("/", response_model=TechnicianListResponse, include_in_schema=False)
async def list_technicians(
    search: Optional[str] = Query(None, description="Search term for technician name or skills"),
    status: Optional[str] = Query(None, description="Filter by status"),
    skill: Optional[str] = Query(None, description="Filter by skill"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: AuthUser = Depends(get_current_user_dependency),
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

@router.post("/", response_model=TechnicianResponse, status_code=status.HTTP_201_CREATED)
async def create_technician(
    request: Request,
    technician_data: TechnicianCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_admin_or_manager_user)
):
    """
    Create a new technician.
    Only managers and admins can create technicians.
    """
    try:
        # Log more details about the request for debugging
        body = await request.body()
        logger.info(f"Creating technician, payload size: {len(body)}")
        logger.info(f"Request body: {body.decode()}")
        
        # Log the parsed technician data
        logger.info(f"Parsed technician data: {technician_data.dict()}")
        logger.info(f"user_email: {technician_data.user_email}")
        logger.info(f"user_id: {technician_data.user_id}")
        logger.info(f"user_first_name: {technician_data.user_first_name}")
        logger.info(f"user_last_name: {technician_data.user_last_name}")
        
        if current_user and hasattr(current_user, 'id'):
            logger.info(f"Authenticated user: {current_user.email}, ID: {current_user.id}")
        else:
            logger.warning("User authentication issue: current_user is invalid")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        
        # Manual validation to ensure we have either user_id or user_email
        if not technician_data.user_id and (not technician_data.user_email or not technician_data.user_email.strip()):
            logger.error("Manual validation error: Neither user_id nor user_email was provided in request")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Either user_id or user_email must be provided"
            )
            
        # Process the request
        return await TechnicianService.create_technician(db, technician_data, current_user.id)
    except ValidationException as e:
        logger.error(f"Validation error creating technician: {str(e)}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        logger.error(f"Conflict error creating technician: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating technician: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating technician: {str(e)}"
        )


def _appointment_status_str(value) -> str:
    if value is None:
        return ""
    return value.value if hasattr(value, "value") else str(value)


@router.get("/{technician_id}/schedule", response_model=Dict[str, Any])
async def get_technician_schedule(
    technician_id: uuid.UUID = Path(..., description="Technician ID"),
    start_date: Optional[datetime] = Query(None, description="Range start (ISO datetime)"),
    end_date: Optional[datetime] = Query(None, description="Range end (ISO datetime)"),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user_dependency),
):
    """
    Appointments for a technician within a time window (for technician profile schedule tab).
    """
    if "technician" in (current_user.roles or []):
        technician_row = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician_row or technician_row.id != technician_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this technician's schedule",
            )
    elif not any(role in (current_user.roles or []) for role in ["admin", "manager"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view technician schedule",
        )

    try:
        await TechnicianService.get_technician(db, technician_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    now = datetime.utcnow()
    start_dt = start_date or now
    end_dt = end_date or (now + timedelta(days=7))
    if end_dt <= start_dt:
        end_dt = start_dt + timedelta(days=1)

    # Overlap: appointment intersects [start_dt, end_dt]
    appt_query = (
        db.query(WorkOrderAppointment)
        .options(
            joinedload(WorkOrderAppointment.work_order).joinedload(WorkOrder.client),
        )
        .filter(
            WorkOrderAppointment.assigned_technician_id == technician_id,
            WorkOrderAppointment.status != "canceled",
            WorkOrderAppointment.scheduled_start < end_dt,
            WorkOrderAppointment.scheduled_end > start_dt,
        )
        .order_by(WorkOrderAppointment.scheduled_start.asc())
    )
    rows = appt_query.all()

    appointments_out: List[Dict[str, Any]] = []
    for appt in rows:
        wo = appt.work_order
        client_name = None
        if wo and wo.client:
            client_name = wo.client.display_name
        desc = (wo.description or "").strip() if wo else ""
        title = desc[:200] if desc else (f"Work order {wo.order_number}" if wo else "Appointment")
        loc = None
        if wo and wo.service_location and isinstance(wo.service_location, dict):
            loc = wo.service_location.get("address")

        st = _appointment_status_str(appt.status)
        # Frontend badge uses "cancelled" in one branch; normalize for display
        if st == "canceled":
            st = "cancelled"

        entry: Dict[str, Any] = {
            "id": str(appt.id),
            "work_order_id": str(wo.id) if wo else None,
            "order_number": wo.order_number if wo else None,
            "appointment_type": appt.appointment_type,
            "title": title,
            "start_time": appt.scheduled_start.isoformat() if appt.scheduled_start else None,
            "end_time": appt.scheduled_end.isoformat() if appt.scheduled_end else None,
            "location": loc,
            "status": st,
            "description": wo.description if wo else None,
        }
        if client_name:
            entry["client"] = {"name": client_name}
        appointments_out.append(entry)

    return {
        "appointments": appointments_out,
        "date_range": {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
        },
        "technician_id": str(technician_id),
    }


@router.get("/{technician_id}", response_model=TechnicianResponse)
async def get_technician(
    technician_id: uuid.UUID = Path(..., description="The ID of the technician to retrieve"),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get a specific technician by ID.
    Technicians can view their own profile, and managers/admins can view any profile.
    """
    # Log the request details for debugging
    logger.info(f"Get technician request for technician_id: {technician_id}")
    logger.info(f"Current user: {current_user.email}, roles: {current_user.roles}")
    
    # Check if technician is viewing their own profile
    if "technician" in current_user.roles:
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician or technician.id != technician_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this technician"
            )
    # Managers and admins can view any technician
    elif not any(role in current_user.roles for role in ["admin", "manager"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view technician details"
        )
    
    try:
        # Fetch the technician
        technician = await TechnicianService.get_technician(db, technician_id)
        
        # Log the retrieved data for debugging
        logger.info(f"Technician data retrieved: ID={technician.id}, Employee ID={technician.employee_id}")
        logger.info(f"User relationship loaded: {technician.user is not None}")
        
        if technician.user:
            logger.info(f"User data: ID={technician.user.id}, Email={technician.user.email}, Name={technician.user.first_name} {technician.user.last_name}")
        else:
            logger.error(f"User relationship is None for technician {technician_id}!")
        
        # Log certifications format
        logger.info(f"Certifications type: {type(technician.certifications).__name__}")
        logger.info(f"Certifications value: {technician.certifications}")
        
        # Return the technician data
        return technician
    except NotFoundException as e:
        logger.error(f"Technician not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving technician: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving technician: {str(e)}"
        )

@router.put("/{technician_id}", response_model=TechnicianResponse)
async def update_technician(
    technician_id: uuid.UUID = Path(..., description="The ID of the technician to update"),
    technician_data: TechnicianUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_admin_or_manager_user)
):
    """
    Update a technician.
    Technicians can update their own profile, and managers/admins can update any profile.
    """
    # Check if technician is updating their own profile
    if "technician" in current_user.roles:
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
    elif not any(role in current_user.roles for role in ["admin", "manager"]):
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

@router.delete("/{technician_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_technician(
    technician_id: uuid.UUID = Path(..., description="The ID of the technician to delete"),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_admin_or_manager_user)
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
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a technician's workload for a specific period.
    Shows assigned work orders, hours worked, and utilization.
    """
    # Check permissions
    if "technician" in current_user.roles:
        technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician or technician.id != technician_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this technician's workload"
            )
    elif not any(role in current_user.roles for role in ["admin", "manager"]):
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

@router.get("/me/performance", response_model=dict)
async def get_my_technician_performance(
    period: str = Query("month", description="Period for performance metrics (week, month, quarter, year)"),
    current_user=Depends(get_current_user_dependency),
    db: Session = Depends(get_db),
):
    """Performance metrics for the logged-in technician."""
    technician = UserService.get_technician_by_user_id(db, str(current_user.id))
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No technician profile linked to this account",
        )
    try:
        return await TechnicianService.get_technician_performance(db, technician.id, period)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving technician performance: {str(e)}",
        )


@router.get("/{technician_id}/performance", response_model=dict)
async def get_technician_performance(
    technician_id: uuid.UUID = Path(..., description="The ID of the technician"),
    period: str = Query("month", description="Period for performance metrics (week, month, quarter, year)"),
    current_user=Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a technician's performance metrics.
    Technicians may view their own; managers and admins may view any.
    """
    own = UserService.get_technician_by_user_id(db, str(current_user.id))
    is_self = own is not None and own.id == technician_id
    roles = set(getattr(current_user, "roles", None) or [])
    if not is_self and not roles.intersection({"admin", "manager"}):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this technician's performance",
        )
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

@router.get("/skills", response_model=List[str])
async def get_all_skills(
    current_user: AuthUser = Depends(get_current_user_dependency),
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