from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, Dict, List, Any
from datetime import datetime
import uuid
import logging

from app.models.client import Client
from app.models.work_order import WorkOrder
from app.models.invoice import Invoice
from app.models.user import User
from app.schemas.client import ClientCreate, ClientUpdate
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

logger = logging.getLogger(__name__)

class ClientService:
    """Service for handling client operations"""
    
    @staticmethod
    async def get_clients(
        db: Session, 
        search: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get clients with filtering and pagination"""
        query = db.query(Client)
        
        # Apply filters
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Client.first_name.ilike(search_term)) |
                (Client.last_name.ilike(search_term)) |
                (Client.company_name.ilike(search_term)) |
                (Client.email.ilike(search_term))
            )
        
        if status:
            query = query.filter(Client.status == status)
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination
        query = query.order_by(Client.created_at.desc())
        clients = query.offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": clients,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit
        }
    
    @staticmethod
    async def get_client(db: Session, client_id: uuid.UUID) -> Client:
        """Get a specific client by ID"""
        client = db.query(Client).filter(Client.id == client_id).first()
        
        if not client:
            raise NotFoundException(f"Client with ID {client_id} not found")
        
        return client
    
    @staticmethod
    async def create_client(db: Session, client_data: ClientCreate, created_by: uuid.UUID) -> Client:
        """Create a new client"""
        # Check if email is unique
        existing_client = db.query(Client).filter(Client.email == client_data.email).first()
        if existing_client:
            raise ConflictException(f"A client with email {client_data.email} already exists")
        
        # Create user account if user_id is not provided
        user_id = client_data.user_id
        if not user_id:
            try:
                # Create user with client role
                user = User(
                    email=client_data.email,
                    first_name=client_data.first_name,
                    last_name=client_data.last_name,
                    role="client",
                    is_active=True
                )
                db.add(user)
                db.flush()
                user_id = user.id
            except SQLAlchemyError as e:
                db.rollback()
                logger.error(f"Database error creating user for client: {str(e)}")
                raise ConflictException("Failed to create user account for client")
        
        try:
            # Create new client
            new_client = Client(
                user_id=user_id,
                company_name=client_data.company_name,
                first_name=client_data.first_name,
                last_name=client_data.last_name,
                email=client_data.email,
                phone=client_data.phone,
                mobile=client_data.mobile,
                address=client_data.address,
                billing_address=client_data.billing_address,
                shipping_address=client_data.shipping_address,
                notes=client_data.notes,
                status=client_data.status,
                source=client_data.source,
                tags=client_data.tags,
                custom_fields=client_data.custom_fields,
                tax_id=client_data.tax_id,
                payment_terms=client_data.payment_terms,
                credit_limit=client_data.credit_limit,
                created_by=created_by
            )
            
            db.add(new_client)
            db.commit()
            db.refresh(new_client)
            
            return new_client
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating client: {str(e)}")
            raise ConflictException(f"Failed to create client: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating client: {str(e)}")
            raise ValidationException(f"Failed to create client: {str(e)}")
    
    @staticmethod
    async def update_client(db: Session, client_id: uuid.UUID, client_data: ClientUpdate) -> Client:
        """Update an existing client"""
        client = await ClientService.get_client(db, client_id)
        
        # Check email uniqueness if being updated
        if client_data.email and client_data.email != client.email:
            existing_client = db.query(Client).filter(Client.email == client_data.email).first()
            if existing_client:
                raise ConflictException(f"A client with email {client_data.email} already exists")
        
        try:
            # Update client with provided fields
            update_data = client_data.dict(exclude_unset=True)
            
            for key, value in update_data.items():
                setattr(client, key, value)
            
            # Update the user if email or name changed
            if (client_data.email or client_data.first_name or client_data.last_name) and client.user_id:
                user = db.query(User).filter(User.id == client.user_id).first()
                if user:
                    if client_data.email:
                        user.email = client_data.email
                    if client_data.first_name:
                        user.first_name = client_data.first_name
                    if client_data.last_name:
                        user.last_name = client_data.last_name
            
            db.commit()
            db.refresh(client)
            
            return client
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating client: {str(e)}")
            raise ConflictException(f"Failed to update client: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating client: {str(e)}")
            raise ValidationException(f"Failed to update client: {str(e)}")
    
    @staticmethod
    async def delete_client(db: Session, client_id: uuid.UUID) -> bool:
        """Delete a client"""
        client = await ClientService.get_client(db, client_id)
        
        try:
            # Check for related records
            work_orders = db.query(WorkOrder).filter(WorkOrder.client_id == client_id).count()
            if work_orders > 0:
                raise ConflictException(f"Cannot delete client with {work_orders} associated work orders")
            
            invoices = db.query(Invoice).filter(Invoice.client_id == client_id).count()
            if invoices > 0:
                raise ConflictException(f"Cannot delete client with {invoices} associated invoices")
            
            # Delete the client
            db.delete(client)
            
            # Handle user deletion if applicable
            if client.user_id:
                user = db.query(User).filter(User.id == client.user_id).first()
                if user and user.role == "client":
                    db.delete(user)
            
            db.commit()
            
            return True
            
        except ConflictException:
            raise
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error deleting client: {str(e)}")
            raise ConflictException(f"Failed to delete client: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting client: {str(e)}")
            raise ValidationException(f"Failed to delete client: {str(e)}")
            
    @staticmethod
    async def get_client_service_history(db: Session, client_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Get service history for a client"""
        client = await ClientService.get_client(db, client_id)
        
        # Get work orders
        work_orders = (
            db.query(WorkOrder)
            .filter(WorkOrder.client_id == client_id)
            .order_by(WorkOrder.created_at.desc())
            .all()
        )
        
        # Format service history
        history = []
        for wo in work_orders:
            history.append({
                "id": str(wo.id),
                "type": "work_order",
                "date": wo.created_at,
                "order_number": wo.order_number,
                "title": wo.title,
                "status": wo.status,
                "technician": wo.technician.name if wo.technician else None,
                "scheduled_start": wo.scheduled_start,
                "scheduled_end": wo.scheduled_end,
                "actual_start": wo.actual_start,
                "actual_end": wo.actual_end
            })
        
        # Get invoices
        invoices = (
            db.query(Invoice)
            .filter(Invoice.client_id == client_id)
            .order_by(Invoice.issue_date.desc())
            .all()
        )
        
        for inv in invoices:
            history.append({
                "id": str(inv.id),
                "type": "invoice",
                "date": inv.issue_date,
                "invoice_number": inv.invoice_number,
                "amount": inv.total,
                "status": inv.status,
                "due_date": inv.due_date,
                "work_order_id": str(inv.work_order_id) if inv.work_order_id else None
            })
        
        # Sort by date descending
        history.sort(key=lambda x: x["date"], reverse=True)
        
        return history