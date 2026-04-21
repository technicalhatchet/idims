from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status, Request
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import uuid
from datetime import datetime
import logging

from app.db.database import get_db
from app.models.service import Service, ServiceCategory, ServiceBundle, ServiceSurcharge
from app.schemas.service import (
    ServiceCreate, ServiceUpdate, ServiceResponse, ServiceListResponse,
    ServiceBundleCreate, ServiceBundleUpdate, ServiceBundleResponse, 
    ServiceSurchargeCreate, ServiceSurchargeUpdate, ServiceSurchargeResponse
)
from app.services.service_service import ServiceService
from app.core.auth import get_auth_handler, AuthUser
from app.core.exceptions import NotFoundException, ConflictException, ValidationException
from app.core.dependencies import get_current_user, get_admin_or_manager_user

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
        logger.error(f"Authentication error in services router: {str(e)}", exc_info=True)
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

@router.get("", response_model=ServiceListResponse)
@router.get("/", response_model=ServiceListResponse, include_in_schema=False)
async def get_services(
    request: Request,
    search: Optional[str] = None,
    category: Optional[str] = None,
    service_type: Optional[str] = None,
    equipment_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a paginated list of services with optional filtering.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} retrieving services with filters: search={search}, category={category}, service_type={service_type}, equipment_type={equipment_type}, is_active={is_active}")
    
    try:
        result = await ServiceService.get_services(
            db=db, 
            search=search,
            category=category,
            service_type=service_type,
            equipment_type=equipment_type,
            is_active=is_active,
            skip=skip, 
            limit=limit
        )
        
        logger.info(f"Retrieved {len(result['items'])} services")
        return result
    except Exception as e:
        logger.error(f"Error retrieving services: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    request: Request,
    service: ServiceCreate,
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Create a new service.
    Only managers and admins can create services.
    """
    logger.info(f"User {current_user.email} creating new service: {service.name}")
    
    try:
        result = await ServiceService.create_service(db=db, service_data=service)
        logger.info(f"Service created successfully with ID: {result.id}")
        return result
    except ConflictException as e:
        logger.warning(f"Conflict creating service: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationException as e:
        logger.warning(f"Validation error creating service: {str(e)}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    request: Request,
    service_id: uuid.UUID = Path(...),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a specific service by ID.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} retrieving service with ID: {service_id}")
    
    try:
        result = await ServiceService.get_service(db=db, service_id=service_id)
        logger.info(f"Service retrieved successfully: {result.name}")
        return result
    except NotFoundException as e:
        logger.warning(f"Service not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/sku/{sku_code}", response_model=ServiceResponse)
async def get_service_by_sku(
    request: Request,
    sku_code: str = Path(...),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a specific service by SKU code.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} retrieving service with SKU: {sku_code}")
    
    try:
        result = await ServiceService.get_service_by_sku(db=db, sku_code=sku_code)
        logger.info(f"Service retrieved successfully: {result.name}")
        return result
    except NotFoundException as e:
        logger.warning(f"Service not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/generate-sku", response_model=str)
async def generate_sku(
    request: Request,
    service_type: str = Query(..., description="Type of service"),
    equipment_type: Optional[str] = Query(None, description="Type of equipment"),
    additional_info: Optional[str] = Query(None, description="Additional information for the SKU"),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Generate a unique SKU code based on service type and equipment type.
    Only managers and admins can generate SKUs.
    """
    logger.info(f"User {current_user.email} generating SKU for service_type: {service_type}, equipment_type: {equipment_type}")
    
    try:
        result = await ServiceService.generate_sku(
            db=db, 
            service_type=service_type,
            equipment_type=equipment_type,
            additional_info=additional_info
        )
        logger.info(f"SKU generated successfully: {result}")
        return result
    except Exception as e:
        logger.error(f"Error generating SKU: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
    request: Request,
    service_id: uuid.UUID = Path(...),
    service_update: ServiceUpdate = Body(...),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Update a service.
    Only managers and admins can update services.
    """
    logger.info(f"User {current_user.email} updating service with ID: {service_id}")
    
    try:
        result = await ServiceService.update_service(
            db=db, 
            service_id=service_id, 
            service_update=service_update
        )
        logger.info(f"Service updated successfully: {result.name}")
        return result
    except NotFoundException as e:
        logger.warning(f"Service not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        logger.warning(f"Conflict updating service: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ValidationException as e:
        logger.warning(f"Validation error updating service: {str(e)}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    request: Request,
    service_id: uuid.UUID = Path(...),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Delete a service.
    Only managers and admins can delete services.
    """
    logger.info(f"User {current_user.email} deleting service with ID: {service_id}")
    
    try:
        await ServiceService.delete_service(db=db, service_id=service_id)
        logger.info(f"Service deleted successfully: {service_id}")
        return None
    except NotFoundException as e:
        logger.warning(f"Service not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        logger.warning(f"Conflict deleting service: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/calculate-duration", response_model=int)
async def calculate_service_duration(
    request: Request,
    service_ids: List[uuid.UUID] = Body(..., description="List of service IDs"),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Calculate the total duration in minutes for a list of services.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} calculating duration for {len(service_ids)} services")
    
    try:
        result = await ServiceService.calculate_service_duration(db=db, service_ids=service_ids)
        logger.info(f"Duration calculated successfully: {result} minutes")
        return result
    except NotFoundException as e:
        logger.warning(f"Service not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating duration: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/calculate-price", response_model=float)
async def calculate_service_price(
    request: Request,
    service_ids: List[uuid.UUID] = Body(..., description="List of service IDs"),
    surcharge_ids: Optional[List[uuid.UUID]] = Body(None, description="List of surcharge IDs to apply"),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Calculate the total price for a list of services with optional surcharges.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} calculating price for {len(service_ids)} services with {len(surcharge_ids) if surcharge_ids else 0} surcharges")
    
    try:
        result = await ServiceService.calculate_service_price(
            db=db, 
            service_ids=service_ids,
            apply_surcharges=surcharge_ids
        )
        logger.info(f"Price calculated successfully: ${result:.2f}")
        return result
    except NotFoundException as e:
        logger.warning(f"Service not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error calculating price: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Service Bundle endpoints
@router.get("/bundles/", response_model=dict)
async def get_service_bundles(
    request: Request,
    bundle_service_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a paginated list of service bundles with optional filtering.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} retrieving service bundles with filters: bundle_service_id={bundle_service_id}, is_active={is_active}")
    
    try:
        result = await ServiceService.get_service_bundles(
            db=db, 
            bundle_service_id=bundle_service_id,
            is_active=is_active,
            skip=skip, 
            limit=limit
        )
        
        logger.info(f"Retrieved {len(result['items'])} service bundles")
        return result
    except Exception as e:
        logger.error(f"Error retrieving service bundles: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/bundles/", response_model=ServiceBundleResponse, status_code=status.HTTP_201_CREATED)
async def create_service_bundle(
    request: Request,
    bundle: ServiceBundleCreate,
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Create a new service bundle.
    Only managers and admins can create service bundles.
    """
    logger.info(f"User {current_user.email} creating new service bundle")
    
    try:
        result = await ServiceService.create_service_bundle(db=db, bundle_data=bundle)
        logger.info(f"Service bundle created successfully with ID: {result.id}")
        return result
    except NotFoundException as e:
        logger.warning(f"Service not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        logger.warning(f"Conflict creating service bundle: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating service bundle: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/bundles/{bundle_id}", response_model=ServiceBundleResponse)
async def get_service_bundle(
    request: Request,
    bundle_id: uuid.UUID = Path(...),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a specific service bundle by ID.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} retrieving service bundle with ID: {bundle_id}")
    
    try:
        result = await ServiceService.get_service_bundle(db=db, bundle_id=bundle_id)
        logger.info(f"Service bundle retrieved successfully: {result.id}")
        return result
    except NotFoundException as e:
        logger.warning(f"Service bundle not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving service bundle: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/bundles/{bundle_id}", response_model=ServiceBundleResponse)
async def update_service_bundle(
    request: Request,
    bundle_id: uuid.UUID = Path(...),
    bundle_update: ServiceBundleUpdate = Body(...),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Update a service bundle.
    Only managers and admins can update service bundles.
    """
    logger.info(f"User {current_user.email} updating service bundle with ID: {bundle_id}")
    
    try:
        result = await ServiceService.update_service_bundle(
            db=db, 
            bundle_id=bundle_id, 
            bundle_update=bundle_update
        )
        logger.info(f"Service bundle updated successfully: {result.id}")
        return result
    except NotFoundException as e:
        logger.warning(f"Service bundle not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating service bundle: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/bundles/{bundle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_bundle(
    request: Request,
    bundle_id: uuid.UUID = Path(...),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Delete a service bundle.
    Only managers and admins can delete service bundles.
    """
    logger.info(f"User {current_user.email} deleting service bundle with ID: {bundle_id}")
    
    try:
        await ServiceService.delete_service_bundle(db=db, bundle_id=bundle_id)
        logger.info(f"Service bundle deleted successfully: {bundle_id}")
        return None
    except NotFoundException as e:
        logger.warning(f"Service bundle not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting service bundle: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Service Surcharge endpoints
@router.get("/surcharges/", response_model=dict)
async def get_service_surcharges(
    request: Request,
    surcharge_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a paginated list of service surcharges with optional filtering.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} retrieving service surcharges with filters: surcharge_type={surcharge_type}, is_active={is_active}")
    
    try:
        result = await ServiceService.get_service_surcharges(
            db=db, 
            surcharge_type=surcharge_type,
            is_active=is_active,
            skip=skip, 
            limit=limit
        )
        
        logger.info(f"Retrieved {len(result['items'])} service surcharges")
        return result
    except Exception as e:
        logger.error(f"Error retrieving service surcharges: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/surcharges/", response_model=ServiceSurchargeResponse, status_code=status.HTTP_201_CREATED)
async def create_service_surcharge(
    request: Request,
    surcharge: ServiceSurchargeCreate,
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Create a new service surcharge.
    Only managers and admins can create service surcharges.
    """
    logger.info(f"User {current_user.email} creating new service surcharge: {surcharge.name}")
    
    try:
        result = await ServiceService.create_service_surcharge(db=db, surcharge_data=surcharge)
        logger.info(f"Service surcharge created successfully with ID: {result.id}")
        return result
    except ConflictException as e:
        logger.warning(f"Conflict creating service surcharge: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating service surcharge: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/surcharges/{surcharge_id}", response_model=ServiceSurchargeResponse)
async def get_service_surcharge(
    request: Request,
    surcharge_id: uuid.UUID = Path(...),
    current_user: AuthUser = Depends(get_current_user_dependency),
    db: Session = Depends(get_db)
):
    """
    Get a specific service surcharge by ID.
    All users can access this endpoint.
    """
    logger.info(f"User {current_user.email} retrieving service surcharge with ID: {surcharge_id}")
    
    try:
        result = await ServiceService.get_service_surcharge(db=db, surcharge_id=surcharge_id)
        logger.info(f"Service surcharge retrieved successfully: {result.name}")
        return result
    except NotFoundException as e:
        logger.warning(f"Service surcharge not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving service surcharge: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.put("/surcharges/{surcharge_id}", response_model=ServiceSurchargeResponse)
async def update_service_surcharge(
    request: Request,
    surcharge_id: uuid.UUID = Path(...),
    surcharge_update: ServiceSurchargeUpdate = Body(...),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Update a service surcharge.
    Only managers and admins can update service surcharges.
    """
    logger.info(f"User {current_user.email} updating service surcharge with ID: {surcharge_id}")
    
    try:
        result = await ServiceService.update_service_surcharge(
            db=db, 
            surcharge_id=surcharge_id, 
            surcharge_update=surcharge_update
        )
        logger.info(f"Service surcharge updated successfully: {result.name}")
        return result
    except NotFoundException as e:
        logger.warning(f"Service surcharge not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        logger.warning(f"Conflict updating service surcharge: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating service surcharge: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/surcharges/{surcharge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_surcharge(
    request: Request,
    surcharge_id: uuid.UUID = Path(...),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
    db: Session = Depends(get_db)
):
    """
    Delete a service surcharge.
    Only managers and admins can delete service surcharges.
    """
    logger.info(f"User {current_user.email} deleting service surcharge with ID: {surcharge_id}")
    
    try:
        await ServiceService.delete_service_surcharge(db=db, surcharge_id=surcharge_id)
        logger.info(f"Service surcharge deleted successfully: {surcharge_id}")
        return None
    except NotFoundException as e:
        logger.warning(f"Service surcharge not found: {str(e)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        logger.warning(f"Conflict deleting service surcharge: {str(e)}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting service surcharge: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) 