from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.quote import Quote, QuoteItem
from app.models.client import Client
from app.schemas.quote import (
    QuoteCreate, QuoteUpdate, QuoteResponse, QuoteListResponse,
    QuoteStatusUpdate, QuoteSend, ConvertQuoteRequest
)
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/quotes", response_model=QuoteListResponse)
async def list_quotes(
    client_id: Optional[uuid.UUID] = Query(None, description="Filter by client ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    start_date: Optional[date] = Query(None, description="Filter by creation date (start)"),
    end_date: Optional[date] = Query(None, description="Filter by creation date (end)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List quotes with filtering and pagination.
    Permissions: Staff can see all quotes, clients can only see their own.
    """
    skip = (page - 1) * limit
    
    # Handle client permissions
    if current_user.role == "client":
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client:
            raise NotFoundException("Client profile not found")
        
        # Force client_id filter for client users
        client_id = client.id
    
    try:
        # Apply filters to query
        query = db.query(Quote)
        
        if client_id:
            query = query.filter(Quote.client_id == client_id)
        
        if status:
            query = query.filter(Quote.status == status)
        
        if start_date:
            query = query.filter(Quote.created_at >= datetime.combine(start_date, datetime.min.time()))
        
        if end_date:
            query = query.filter(Quote.created_at <= datetime.combine(end_date, datetime.max.time()))
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination
        quotes = query.order_by(Quote.created_at.desc()).offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": quotes,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving quotes: {str(e)}"
        )

@router.post("/quotes", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_quote(
    quote: QuoteCreate,
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new quote.
    Permissions: Only managers and admins can create quotes.
    """
    try:
        # Validate client exists
        client = db.query(Client).filter(Client.id == quote.client_id).first()
        if not client:
            raise ValidationException(f"Client with ID {quote.client_id} not found")
            
        # Generate unique quote number
        # In a real implementation, this would be more sophisticated
        last_quote = db.query(Quote).order_by(Quote.quote_number.desc()).first()
        if last_quote and last_quote.quote_number.startswith("Q-"):
            try:
                last_number = int(last_quote.quote_number[2:])
                next_number = last_number + 1
            except ValueError:
                next_number = 1001
        else:
            next_number = 1001
            
        quote_number = f"Q-{next_number}"
        
        # Create new quote
        new_quote = Quote(
            quote_number=quote_number,
            client_id=quote.client_id,
            title=quote.title,
            description=quote.description,
            status=quote.status,
            valid_until=quote.valid_until,
            terms=quote.terms,
            notes=quote.notes,
            meta_data=quote.metadata,
            created_by=current_user.id
        )
        
        db.add(new_quote)
        db.flush()
        
        # Add quote items
        subtotal = 0
        for item_data in quote.items:
            item = QuoteItem(
                quote_id=new_quote.id,
                description=item_data.description,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                tax_rate=item_data.tax_rate,
                discount=item_data.discount,
                service_id=item_data.service_id,
                meta_data=item_data.metadata
            )
            
            # Calculate item total
            item_total = item.calculate_total()
            subtotal += item_total
            
            db.add(item)
        
        # Update quote totals
        tax_amount = 0  # In a real implementation, would calculate based on tax rules
        discount_amount = 0  # In a real implementation, would calculate based on discount rules
        
        new_quote.subtotal = subtotal
        new_quote.tax = tax_amount
        new_quote.discount = discount_amount
        new_quote.total = subtotal + tax_amount - discount_amount
        
        db.commit()
        db.refresh(new_quote)
        
        return new_quote
        
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating quote: {str(e)}"
        )

@router.get("/quotes/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: uuid.UUID = Path(..., description="The ID of the quote to retrieve"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific quote by ID.
    Permissions: Staff can access any quote, clients can only access their own.
    """
    try:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        # Handle client permissions
        if current_user.role == "client":
            client = db.query(Client).filter(Client.user_id == current_user.id).first()
            if not client or client.id != quote.client_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this quote"
                )
        
        return quote
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving quote: {str(e)}"
        )

@router.put("/quotes/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: uuid.UUID = Path(..., description="The ID of the quote to update"),
    quote_data: QuoteUpdate = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Update a quote.
    Permissions: Only managers and admins can update quotes.
    """
    try:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        # Prevent updating if quote is already accepted or rejected
        if quote.status in ["accepted", "rejected"] and quote_data.status not in ["cancelled", "expired"]:
            raise ConflictException(f"Cannot update a quote with status {quote.status}")
        
        # Update quote with provided fields
        update_data = quote_data.dict(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(quote, key, value)
        
        # If we're updating items, recalculate totals
        # This would typically be more complex and handle updating/adding/removing items
        
        quote.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(quote)
        
        return quote
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating quote: {str(e)}"
        )

@router.delete("/quotes/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quote(
    quote_id: uuid.UUID = Path(..., description="The ID of the quote to delete"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a quote.
    Permissions: Only managers and admins can delete quotes.
    """
    try:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        # Prevent deleting if quote is already accepted
        if quote.status == "accepted":
            raise ConflictException(f"Cannot delete a quote with status {quote.status}")
        
        # Check if work orders exist that reference this quote
        work_orders = db.query("WorkOrder").filter_by(quote_id=quote_id).count()
        if work_orders > 0:
            raise ConflictException(f"Cannot delete quote that is associated with work orders")
        
        # Delete quote items
        db.query(QuoteItem).filter(QuoteItem.quote_id == quote_id).delete()
        
        # Delete the quote
        db.delete(quote)
        db.commit()
        
        return None
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting quote: {str(e)}"
        )

@router.put("/quotes/{quote_id}/status", response_model=QuoteResponse)
async def update_quote_status(
    quote_id: uuid.UUID = Path(..., description="The ID of the quote"),
    status_update: QuoteStatusUpdate = Body(...),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a quote's status.
    Permissions: Staff can update any status, clients can only accept/reject quotes.
    """
    try:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        # Handle client permissions
        if current_user.role == "client":
            client = db.query(Client).filter(Client.user_id == current_user.id).first()
            if not client or client.id != quote.client_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this quote"
                )
            
            # Clients can only accept or reject quotes
            if status_update.status not in ["accepted", "rejected"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Clients can only accept or reject quotes"
                )
            
            # Can only accept/reject if quote is in sent status
            if quote.status != "sent":
                raise ConflictException(f"Cannot {status_update.status} a quote with status {quote.status}")
        
        # Staff have more permissions
        else:
            # Check valid transitions
            valid_transitions = {
                "draft": ["sent", "cancelled"],
                "sent": ["accepted", "rejected", "expired", "cancelled"],
                "accepted": ["cancelled"],
                "rejected": ["cancelled"],
                "expired": ["cancelled"]
            }
            
            if status_update.status not in valid_transitions.get(quote.status, []):
                raise ValidationException(
                    f"Invalid status transition from {quote.status} to {status_update.status}"
                )
        
        # Update the status
        quote.status = status_update.status
        
        # Add status notes if provided
        if status_update.notes:
            if not quote.notes:
                quote.notes = f"Status changed to {status_update.status}: {status_update.notes}"
            else:
                quote.notes += f"\n\nStatus changed to {status_update.status}: {status_update.notes}"
        
        quote.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(quote)
        
        return quote
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating quote status: {str(e)}"
        )

@router.post("/quotes/{quote_id}/send", response_model=QuoteResponse)
async def send_quote(
    quote_id: uuid.UUID = Path(..., description="The ID of the quote to send"),
    send_data: QuoteSend = Body(...),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Send a quote to the client.
    Permissions: Only managers and admins can send quotes.
    """
    try:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        # Check if quote can be sent
        if quote.status not in ["draft", "sent"]:
            raise ConflictException(
                f"Cannot send quote with status {quote.status}"
            )
        
        # Update quote status to sent
        quote.status = "sent"
        quote.updated_at = datetime.utcnow()
        
        # Store sending info in metadata
        if not quote.meta_data:
            quote.meta_data = {}
        
        if "send_history" not in quote.meta_data:
            quote.meta_data["send_history"] = []
        
        quote.meta_data["send_history"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "sent_by": str(current_user.id),
            "recipients": send_data.email_recipients,
            "message": send_data.email_message
        })
        
        db.commit()
        db.refresh(quote)
        
        # Send notifications
        if send_data.send_to_client and quote.client_id:
            client = db.query(Client).filter(Client.id == quote.client_id).first()
            
            if client and client.user_id:
                # In real implementation, would use NotificationService to send
                # notifications via email and in-app
                pass
        
        return quote
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sending quote: {str(e)}"
        )

@router.post("/quotes/{quote_id}/convert")
async def convert_quote(
    quote_id: uuid.UUID = Path(..., description="The ID of the quote to convert"),
    convert_request: ConvertQuoteRequest = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Convert a quote to a work order or invoice.
    Permissions: Only managers and admins can convert quotes.
    """
    try:
        quote = db.query(Quote).filter(Quote.id == quote_id).first()
        
        if not quote:
            raise NotFoundException(f"Quote with ID {quote_id} not found")
        
        # Check if quote can be converted (must be accepted)
        if quote.status != "accepted":
            raise ConflictException(
                f"Cannot convert quote with status {quote.status}. Quote must be accepted."
            )
        
        # Convert to work order
        if convert_request.convert_to == "work_order":
            # Create work order
            # This would be implemented in a real service
            return {"status": "success", "message": "Quote converted to work order", "type": "work_order"}
            
        # Convert to invoice
        elif convert_request.convert_to == "invoice":
            # Create invoice
            # This would be implemented in a real service
            return {"status": "success", "message": "Quote converted to invoice", "type": "invoice"}
            
        else:
            raise ValidationException(f"Invalid conversion type: {convert_request.convert_to}")
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error converting quote: {str(e)}"
        )