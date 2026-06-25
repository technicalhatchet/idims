from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import Dict, Any, List, Optional
import uuid
import logging
from datetime import datetime

from app.models.service import Service, ServiceBundle, ServiceSurcharge
from app.schemas.service import ServiceCreate, ServiceUpdate, ServiceBundleCreate, ServiceBundleUpdate, ServiceSurchargeCreate, ServiceSurchargeUpdate
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

logger = logging.getLogger(__name__)

class ServiceService:
    """Service for handling service operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    @staticmethod
    async def get_services(
        db: Session, 
        search: Optional[str] = None,
        category: Optional[str] = None,
        service_type: Optional[str] = None,
        equipment_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get services with filtering and pagination"""
        query = db.query(Service)
        
        # Apply filters
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Service.name.ilike(search_term)) |
                (Service.description.ilike(search_term)) |
                (Service.sku_code.ilike(search_term))
            )
        
        if category:
            query = query.filter(Service.category == category)
            
        if service_type:
            # Handle enum mapping for service_type
            from app.models.service import ServiceType as SQLAlchemyServiceTypeEnum
            try:
                service_type_enum = SQLAlchemyServiceTypeEnum[service_type.lower()]
                query = query.filter(Service.service_type == service_type_enum)
            except KeyError as e:
                logger.warning(f"Invalid service_type filter value: {service_type}. Error: {e}")
            
        if equipment_type:
            # Handle enum mapping for equipment_type
            from app.models.service import EquipmentType as SQLAlchemyEquipmentTypeEnum
            try:
                # Convert to lowercase for enum key lookup
                lookup_key = equipment_type.lower()
                # No special mapping needed as the enum member name is now 'network'
                equipment_type_enum = SQLAlchemyEquipmentTypeEnum[lookup_key]
                query = query.filter(Service.equipment_type == equipment_type_enum)
            except KeyError as e: # Catch specific KeyError
                logger.warning(f"Invalid equipment_type filter value: {equipment_type}. Error: {e}")
            
        if is_active is not None:
            query = query.filter(Service.is_active == is_active)
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination
        query = query.order_by(Service.name)
        services = query.offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": services,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit if limit > 0 else 1
        }
    
    async def get_all_services(self) -> List[Service]:
        """Get all services without pagination"""
        return self.db.query(Service).all()
    
    async def get_service_by_name(self, name: str) -> Optional[Service]:
        """Get a specific service by name"""
        return self.db.query(Service).filter(Service.name == name).first()
    
    async def get_services_by_sku_prefix(self, prefix: str) -> List[Service]:
        """Get services with a specific SKU prefix"""
        return self.db.query(Service).filter(Service.sku_code.like(f"{prefix}%")).all()
    
    async def get_service(self, service_id: uuid.UUID) -> Service:
        """Get a specific service by ID"""
        service = self.db.query(Service).filter(Service.id == service_id).first()
        
        if not service:
            raise NotFoundException(f"Service with ID {service_id} not found")
        
        return service
    
    @staticmethod
    async def get_service_by_sku(db: Session, sku_code: str) -> Service:
        """Get a specific service by SKU code"""
        service = db.query(Service).filter(Service.sku_code == sku_code).first()
        
        if not service:
            raise NotFoundException(f"Service with SKU {sku_code} not found")
        
        return service
    
    async def get_service_by_sku(self, sku_code: str) -> Optional[Service]:
        """Get a specific service by SKU code without raising exception"""
        return self.db.query(Service).filter(Service.sku_code == sku_code).first()
    
    @staticmethod
    async def create_service(db: Session, service_data: ServiceCreate) -> Service:
        """Create a new service"""
        try:
            # Check if SKU code already exists
            existing_sku = db.query(Service).filter(Service.sku_code == service_data.sku_code).first()
            if existing_sku:
                raise ConflictException(f"Service with SKU code {service_data.sku_code} already exists")
            
            # Create service with all fields from service_data
            new_service_data = service_data.model_dump(exclude_unset=True)
            
            # Handle enum conversions
            # The service_data values should already be the correct enum objects
            # from the Pydantic validation, so no additional conversion needed
            
            new_service = Service(**new_service_data)
            
            db.add(new_service)
            db.commit()
            db.refresh(new_service)
            
            logger.info(f"Created new service: {new_service.name} with SKU: {new_service.sku_code}")
            return new_service
            
        except ConflictException as e:
            # Re-raise conflict exceptions
            raise e
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating service: {str(e)}")
            raise ConflictException(f"Error creating service: {str(e)}")
    
    async def create_service(self, service_data: dict) -> Service:
        """Create a new service from dict data"""
        try:
            # Check if SKU code already exists
            existing_sku = self.db.query(Service).filter(Service.sku_code == service_data["sku_code"]).first()
            if existing_sku:
                raise ConflictException(f"Service with SKU code {service_data['sku_code']} already exists")
            
            # Create service with fields from service_data
            service = Service(
                sku_code=service_data["sku_code"],
                name=service_data["name"],
                description=service_data.get("description"),
                category=service_data.get("category"),
                base_price=service_data["base_price"],
                unit="service",
                service_type=service_data.get("service_type"),
                equipment_type=service_data.get("equipment_type"),
                skill_level=service_data.get("skill_level"),
                duration_minutes=service_data.get("duration_minutes"),
                is_bundle=service_data.get("is_bundle", False),
                is_custom_price=service_data.get("is_custom_price", False),
                requires_diagnostic=service_data.get("requires_diagnostic", False),
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            self.db.add(service)
            self.db.commit()
            self.db.refresh(service)
            
            logger.info(f"Created new service: {service.name} with SKU: {service.sku_code}")
            return service
            
        except ConflictException as e:
            # Re-raise conflict exceptions
            raise e
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database error creating service: {str(e)}")
            raise ConflictException(f"Error creating service: {str(e)}")
    
    @staticmethod
    async def update_service(db: Session, service_id: uuid.UUID, service_update: ServiceUpdate) -> Service:
        """Update a service"""
        try:
            service = await ServiceService(db).get_service(service_id)
            
            # Check if SKU code is being updated and if it already exists
            if service_update.sku_code and service_update.sku_code != service.sku_code:
                existing_sku = db.query(Service).filter(Service.sku_code == service_update.sku_code).first()
                if existing_sku:
                    raise ConflictException(f"Service with SKU code {service_update.sku_code} already exists")
            
            # Update all fields from service_update
            update_data = service_update.model_dump(exclude_unset=True)
            
            # The service_update values should already be the correct enum objects
            # from the Pydantic validation, so no additional conversion needed
            
            for key, value in update_data.items():
                setattr(service, key, value)
                
            service.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(service)
            
            logger.info(f"Updated service: {service.id}")
            return service
            
        except NotFoundException as e:
            # Re-raise not found exceptions
            raise e
        except ConflictException as e:
            # Re-raise conflict exceptions
            raise e
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating service: {str(e)}")
            raise ConflictException(f"Error updating service: {str(e)}")
    
    @staticmethod
    async def delete_service(db: Session, service_id: uuid.UUID) -> None:
        """Delete a service"""
        service = await ServiceService.get_service(db, service_id)
        
        try:
            # Check if service is used in any bundles
            bundle_services = db.query(ServiceBundle).filter(
                (ServiceBundle.bundle_service_id == service_id) |
                (ServiceBundle.included_service_id == service_id)
            ).first()
            
            if bundle_services:
                raise ConflictException(f"Cannot delete service {service.name} because it is used in service bundles")
            
            db.delete(service)
            db.commit()
            logger.info(f"Deleted service: {service_id}")
        except ConflictException as e:
            # Re-raise conflict exceptions
            raise e
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error deleting service: {str(e)}")
            raise ConflictException(f"Error deleting service: {str(e)}")
    
    @staticmethod
    async def generate_sku(
        db: Session, 
        service_type: str, 
        equipment_type: Optional[str] = None, 
        additional_info: Optional[str] = None
    ) -> str:
        """Generate a unique SKU code based on service and equipment type"""
        # Base prefixes for different service types
        prefixes = {
            "diagnostic": "DIAG",
            "repair": "REP",
            "installation": "INST",
            "additional_time": "TIME",
            "network": "NET",
            "remote": "REM",
            "custom": "CUST"
        }
        
        # Equipment type codes
        equipment_codes = {
            "washer": "WSH",
            "dryer": "DRY",
            "stacked_laundry": "STK",
            "aio_laundry": "AIO",
            "refrigerator": "REF",
            "dishwasher": "DWS",
            "range": "RNG",
            "wall_oven": "OVN",
            "tv": "TV",
            "network": "NET",
            "other": "OTH"
        }
        
        # Get base prefix
        prefix = prefixes.get(service_type, "SVC")
        
        # Add equipment code if available
        if equipment_type and equipment_type in equipment_codes:
            prefix += "-" + equipment_codes[equipment_type]
        
        # Add additional info if available
        if additional_info:
            prefix += "-" + additional_info.upper()
        
        # Get count of existing services with this prefix to create a unique suffix
        count = db.query(Service).filter(Service.sku_code.like(f"{prefix}-%")).count()
        
        # Generate SKU with sequential number
        sku = f"{prefix}-{count+1:03d}"
        
        # Check if the SKU already exists (should be rare but possible)
        while db.query(Service).filter(Service.sku_code == sku).first():
            count += 1
            sku = f"{prefix}-{count+1:03d}"
        
        return sku
    
    # Service Bundle methods
    @staticmethod
    async def get_service_bundles(
        db: Session, 
        bundle_service_id: Optional[uuid.UUID] = None,
        is_active: Optional[bool] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get service bundles with filtering and pagination"""
        query = db.query(ServiceBundle)
        
        # Apply filters
        if bundle_service_id:
            query = query.filter(ServiceBundle.bundle_service_id == bundle_service_id)
            
        if is_active is not None:
            query = query.filter(ServiceBundle.is_active == is_active)
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination and eager loading
        query = query.options(
            joinedload(ServiceBundle.bundle_service),
            joinedload(ServiceBundle.included_service)
        )
        bundles = query.offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": bundles,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit if limit > 0 else 1
        }
    
    @staticmethod
    async def get_service_bundle(db: Session, bundle_id: uuid.UUID) -> ServiceBundle:
        """Get a specific service bundle by ID"""
        bundle = db.query(ServiceBundle).options(
            joinedload(ServiceBundle.bundle_service),
            joinedload(ServiceBundle.included_service)
        ).filter(ServiceBundle.id == bundle_id).first()
        
        if not bundle:
            raise NotFoundException(f"Service bundle with ID {bundle_id} not found")
        
        return bundle
    
    @staticmethod
    async def create_service_bundle(db: Session, bundle_data: ServiceBundleCreate) -> ServiceBundle:
        """Create a new service bundle"""
        try:
            # Check if both services exist
            await ServiceService.get_service(db, bundle_data.bundle_service_id)
            await ServiceService.get_service(db, bundle_data.included_service_id)
            
            # Check if bundle already exists
            existing_bundle = db.query(ServiceBundle).filter(
                ServiceBundle.bundle_service_id == bundle_data.bundle_service_id,
                ServiceBundle.included_service_id == bundle_data.included_service_id
            ).first()
            
            if existing_bundle:
                raise ConflictException(f"This service is already included in the bundle")
            
            # Create bundle
            new_bundle = ServiceBundle(
                bundle_service_id=bundle_data.bundle_service_id,
                included_service_id=bundle_data.included_service_id,
                quantity=bundle_data.quantity,
                discount_percent=bundle_data.discount_percent,
                is_active=bundle_data.is_active,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(new_bundle)
            db.commit()
            db.refresh(new_bundle)
            
            logger.info(f"Created new service bundle: {new_bundle.id}")
            return new_bundle
            
        except NotFoundException as e:
            # Re-raise not found exceptions
            raise e
        except ConflictException as e:
            # Re-raise conflict exceptions
            raise e
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating service bundle: {str(e)}")
            raise ConflictException(f"Error creating service bundle: {str(e)}")
    
    @staticmethod
    async def update_service_bundle(db: Session, bundle_id: uuid.UUID, bundle_update: ServiceBundleUpdate) -> ServiceBundle:
        """Update a service bundle"""
        bundle = await ServiceService.get_service_bundle(db, bundle_id)
        
        try:
            # Update all fields from bundle_update
            update_data = bundle_update.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(bundle, key, value)
                
            bundle.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(bundle)
            
            logger.info(f"Updated service bundle: {bundle.id}")
            return bundle
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating service bundle: {str(e)}")
            raise ConflictException(f"Error updating service bundle: {str(e)}")
    
    @staticmethod
    async def delete_service_bundle(db: Session, bundle_id: uuid.UUID) -> None:
        """Delete a service bundle"""
        bundle = await ServiceService.get_service_bundle(db, bundle_id)
        
        try:
            db.delete(bundle)
            db.commit()
            logger.info(f"Deleted service bundle: {bundle_id}")
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error deleting service bundle: {str(e)}")
            raise ConflictException(f"Error deleting service bundle: {str(e)}")
    
    # Service Surcharge methods
    @staticmethod
    async def get_service_surcharges(
        db: Session, 
        surcharge_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get service surcharges with filtering and pagination"""
        query = db.query(ServiceSurcharge)
        
        # Apply filters
        if surcharge_type:
            query = query.filter(ServiceSurcharge.surcharge_type == surcharge_type)
            
        if is_active is not None:
            query = query.filter(ServiceSurcharge.is_active == is_active)
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination
        query = query.order_by(ServiceSurcharge.name)
        surcharges = query.offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": surcharges,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit if limit > 0 else 1
        }
    
    @staticmethod
    async def get_service_surcharge(db: Session, surcharge_id: uuid.UUID) -> ServiceSurcharge:
        """Get a specific service surcharge by ID"""
        surcharge = db.query(ServiceSurcharge).filter(ServiceSurcharge.id == surcharge_id).first()
        
        if not surcharge:
            raise NotFoundException(f"Service surcharge with ID {surcharge_id} not found")
        
        return surcharge
    
    @staticmethod
    async def create_service_surcharge(db: Session, surcharge_data: ServiceSurchargeCreate) -> ServiceSurcharge:
        """Create a new service surcharge"""
        try:
            # Create surcharge
            new_surcharge = ServiceSurcharge(
                name=surcharge_data.name,
                description=surcharge_data.description,
                surcharge_type=surcharge_data.surcharge_type,
                amount=surcharge_data.amount,
                is_percentage=surcharge_data.is_percentage,
                is_active=surcharge_data.is_active,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(new_surcharge)
            db.commit()
            db.refresh(new_surcharge)
            
            logger.info(f"Created new service surcharge: {new_surcharge.name}")
            return new_surcharge
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating service surcharge: {str(e)}")
            raise ConflictException(f"Error creating service surcharge: {str(e)}")
    
    @staticmethod
    async def update_service_surcharge(db: Session, surcharge_id: uuid.UUID, surcharge_update: ServiceSurchargeUpdate) -> ServiceSurcharge:
        """Update a service surcharge"""
        surcharge = await ServiceService.get_service_surcharge(db, surcharge_id)
        
        try:
            # Update all fields from surcharge_update
            update_data = surcharge_update.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(surcharge, key, value)
                
            surcharge.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(surcharge)
            
            logger.info(f"Updated service surcharge: {surcharge.id}")
            return surcharge
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating service surcharge: {str(e)}")
            raise ConflictException(f"Error updating service surcharge: {str(e)}")
    
    @staticmethod
    async def delete_service_surcharge(db: Session, surcharge_id: uuid.UUID) -> None:
        """Delete a service surcharge"""
        surcharge = await ServiceService.get_service_surcharge(db, surcharge_id)
        
        try:
            db.delete(surcharge)
            db.commit()
            logger.info(f"Deleted service surcharge: {surcharge_id}")
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error deleting service surcharge: {str(e)}")
            raise ConflictException(f"Error deleting service surcharge: {str(e)}")
            
    @staticmethod
    async def calculate_service_duration(db: Session, service_ids: List[uuid.UUID]) -> int:
        """Calculate the total duration for a list of services"""
        total_duration = 0
        
        for service_id in service_ids:
            service = await ServiceService.get_service(db, service_id)
            if service.duration_minutes:
                total_duration += service.duration_minutes
        
        return total_duration
            
    @staticmethod
    async def calculate_service_price(
        db: Session, 
        service_ids: List[uuid.UUID],
        apply_surcharges: List[uuid.UUID] = None
    ) -> float:
        """Calculate the total price for a list of services with optional surcharges"""
        total_price = 0
        
        # Calculate base price from services
        for service_id in service_ids:
            service = await ServiceService.get_service(db, service_id)
            total_price += service.base_price
        
        # Apply surcharges if any
        if apply_surcharges:
            for surcharge_id in apply_surcharges:
                surcharge = await ServiceService.get_service_surcharge(db, surcharge_id)
                
                if surcharge.is_percentage:
                    # Apply percentage surcharge
                    total_price += (total_price * surcharge.amount / 100)
                else:
                    # Apply fixed amount surcharge
                    total_price += surcharge.amount
        
        return total_price 