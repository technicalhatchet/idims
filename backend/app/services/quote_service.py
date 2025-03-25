from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date
from fastapi import BackgroundTasks

from app.models.quote import Quote
from app.models.client import Client
from app.models.work_order import WorkOrder
from app.schemas.quote import (
    QuoteCreate, QuoteUpdate, QuoteResponse, QuoteListResponse,
    QuoteStatusUpdate, QuoteSend, ConvertQuoteRequest
)
from app.core.exceptions import NotFoundException, ValidationException, ConflictException
from app.services.email_service import EmailService
from app.services.work_order_service import WorkOrderService

class QuoteService:
    @staticmethod
    async def get_quotes(
        db: Session,
        client_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 10
    ) -> QuoteListResponse:
        """
        Get quotes with filtering and pagination.
        """
        query = db.query(Quote)
        
        # Apply filters
        if client_id:
            query = query.filter(Quote.client_id == client_id)
        
        if status:
            query = query.filter(Quote.status == status)
        
        if start_date:
            query = query.filter(Quote.created_at >= start_date)
        
        if end_date:
            query = query.filter(Quote.created_at <= end_date)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        quotes = query.order_by(Quote.created_at.desc()).offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "quotes": quotes,
            "page": (skip // limit) + 1,
            "pages": (total + limit - 1) // limit
        }

    @staticmethod
    async def create_quote(
        db: Session,
        quote_data: QuoteCreate,
        created_by: uuid.UUID
    ) -> QuoteResponse:
        """
        Create a new quote.
        """
        # Validate client exists
        client = db.query(Client).filter(Client.id == quote_data.client_id).first()
        if not client:
            raise NotFoundException(f"Client with ID {quote_data.client_id} not found")
        
        # Create new quote
        new_quote = Quote(
            client_id=quote_data.client_id,
            work_order_id=quote_data.work_order_id,
            total_amount=quote_data.total_amount,
            valid_until=quote_data.valid_until,
            notes=quote_data.notes,
            status="draft",
            created_by=created_by,
            items=quote_data.items,
            terms=quote_data.terms,
            conditions=quote_data.conditions
        )
        
        db.add(new_quote)
        db.commit()
        db.refresh(new_quote)
        
        return new_quote

    @staticmethod
    async def get_quote(db: Session, quote_id: uuid.UUID) -> QuoteResponse:
        """
        Get a specific quote by ID.
        """
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        return quote

    @staticmethod
    async def update_quote(
        db: Session,
        quote_id: uuid.UUID,
        quote_update: QuoteUpdate
    ) -> QuoteResponse:
        """
        Update a quote.
        """
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        # Check if quote can be updated
        if quote.status not in ["draft", "pending"]:
            raise ValidationException(f"Cannot update quote with status {quote.status}")
        
        # Update fields
        for key, value in quote_update.dict(exclude_unset=True).items():
            if hasattr(quote, key):
                setattr(quote, key, value)
        
        quote.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(quote)
        
        return quote

    @staticmethod
    async def delete_quote(db: Session, quote_id: uuid.UUID) -> None:
        """
        Delete a quote.
        """
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        # Check if quote can be deleted
        if quote.status not in ["draft", "rejected"]:
            raise ValidationException(f"Cannot delete quote with status {quote.status}")
        
        db.delete(quote)
        db.commit()

    @staticmethod
    async def update_quote_status(
        db: Session,
        quote_id: uuid.UUID,
        status: str,
        notes: Optional[str] = None
    ) -> QuoteResponse:
        """
        Update a quote's status.
        """
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        # Validate status transition
        valid_transitions = {
            "draft": ["pending", "rejected"],
            "pending": ["accepted", "rejected"],
            "accepted": ["converted"],
            "rejected": ["draft"]
        }
        
        if status not in valid_transitions.get(quote.status, []):
            raise ValidationException(
                f"Cannot transition quote from {quote.status} to {status}"
            )
        
        quote.status = status
        if notes:
            quote.notes = f"{quote.notes}\nStatus Update: {notes}"
        quote.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(quote)
        
        return quote

    @staticmethod
    async def send_quote(
        db: Session,
        quote_id: uuid.UUID,
        send_data: QuoteSend,
        created_by: uuid.UUID,
        background_tasks: Optional[BackgroundTasks] = None
    ) -> QuoteResponse:
        """
        Send a quote to the client.
        """
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        if quote.status != "draft":
            raise ValidationException(f"Cannot send quote with status {quote.status}")
        
        # Update quote status
        quote.status = "pending"
        quote.sent_at = datetime.utcnow()
        quote.sent_by = created_by
        quote.updated_at = datetime.utcnow()
        
        # Add email to background tasks if provided
        if background_tasks and send_data.send_email:
            background_tasks.add_task(
                EmailService.send_quote_email,
                quote_id=quote_id,
                recipient_email=send_data.recipient_email,
                message=send_data.message
            )
        
        db.commit()
        db.refresh(quote)
        
        return quote

    @staticmethod
    async def convert_quote(
        db: Session,
        quote_id: uuid.UUID,
        convert_request: ConvertQuoteRequest
    ) -> Dict[str, Any]:
        """
        Convert a quote to a work order.
        """
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        if quote.status != "accepted":
            raise ValidationException("Only accepted quotes can be converted to work orders")
        
        # Create work order from quote
        work_order_data = {
            "client_id": quote.client_id,
            "description": quote.notes or "Work order created from quote",
            "scheduled_date": convert_request.scheduled_date,
            "priority": convert_request.priority,
            "items": quote.items,
            "total_amount": quote.total_amount,
            "created_by": convert_request.created_by
        }
        
        work_order = await WorkOrderService.create_work_order(db, work_order_data)
        
        # Update quote status
        quote.status = "converted"
        quote.work_order_id = work_order.id
        quote.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(quote)
        
        return {
            "quote": quote,
            "work_order": work_order,
            "message": "Quote successfully converted to work order"
        } 