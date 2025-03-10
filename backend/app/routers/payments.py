from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, date, timedelta

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.client import Client
from app.schemas.payment import (
    PaymentCreate, 
    PaymentResponse, 
    PaymentListResponse, 
    PaymentMethodCreate,
    PaymentMethodResponse,
    RefundRequest
)
from app.core.exceptions import NotFoundException, ValidationException, ConflictException
from app.services.payment_service import PaymentService

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/payments", response_model=PaymentListResponse)
async def list_payments(
    invoice_id: Optional[uuid.UUID] = Query(None, description="Filter by invoice ID"),
    client_id: Optional[uuid.UUID] = Query(None, description="Filter by client ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    start_date: Optional[date] = Query(None, description="Filter by payment date (start)"),
    end_date: Optional[date] = Query(None, description="Filter by payment date (end)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List payments with filtering and pagination.
    Regular clients can only see their own payments.
    """
    # Calculate skip for pagination
    skip = (page - 1) * limit
    
    # Handle client permissions
    if current_user.role == "client":
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client:
            raise NotFoundException("Client profile not found")
        
        # Force client_id filter for client users
        client_id = client.id
    
    try:
        result = await PaymentService.get_payments(
            db=db,
            invoice_id=invoice_id,
            client_id=client_id,
            status=status,
            payment_method=payment_method,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit
        )
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving payments: {str(e)}"
        )

@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new payment.
    Only managers and admins can create payments.
    """
    try:
        return await PaymentService.create_payment(db, payment_data, created_by=current_user.id)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating payment: {str(e)}"
        )

@router.get("/payments/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: uuid.UUID = Path(..., description="The ID of the payment to retrieve"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific payment by ID.
    Regular clients can only see their own payments.
    """
    try:
        payment = await PaymentService.get_payment(db, payment_id)
        
        # Check if client user has access to this payment
        if current_user.role == "client":
            client = db.query(Client).filter(Client.user_id == current_user.id).first()
            if not client:
                raise NotFoundException("Client profile not found")
            
            # Check if payment belongs to client's invoice
            invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
            if not invoice or invoice.client_id != client.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this payment"
                )
        
        return payment
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving payment: {str(e)}"
        )

@router.post("/payments/{payment_id}/refund", response_model=PaymentResponse)
async def refund_payment(
    payment_id: uuid.UUID = Path(..., description="The ID of the payment to refund"),
    refund_data: RefundRequest = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Refund a payment, either partially or in full.
    Only managers and admins can process refunds.
    """
    try:
        return await PaymentService.refund_payment(
            db, 
            payment_id, 
            amount=refund_data.amount, 
            reason=refund_data.reason,
            created_by=current_user.id
        )
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing refund: {str(e)}"
        )

@router.post("/payments/process-stripe-webhook")
async def process_stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Process webhook from Stripe payment gateway.
    This is called by Stripe when a payment event occurs.
    """
    # Get the webhook payload
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        return await PaymentService.process_stripe_webhook(db, payload, sig_header)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )

@router.get("/clients/{client_id}/payment-methods", response_model=List[PaymentMethodResponse])
async def get_client_payment_methods(
    client_id: uuid.UUID = Path(..., description="The ID of the client"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get payment methods for a client.
    Clients can only view their own payment methods.
    """
    # Check permissions for client users
    if current_user.role == "client":
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client or client.id != client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view payment methods for this client"
            )
    
    try:
        return await PaymentService.get_client_payment_methods(db, client_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving payment methods: {str(e)}"
        )

@router.post("/clients/{client_id}/payment-methods", response_model=PaymentMethodResponse)
async def create_client_payment_method(
    client_id: uuid.UUID = Path(..., description="The ID of the client"),
    payment_method: PaymentMethodCreate = Body(...),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a new payment method for a client.
    Clients can only add payment methods to their own account.
    """
    # Check permissions for client users
    if current_user.role == "client":
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client or client.id != client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to add payment methods for this client"
            )
    
    try:
        return await PaymentService.create_payment_method(db, client_id, payment_method)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating payment method: {str(e)}"
        )

@router.delete("/clients/{client_id}/payment-methods/{payment_method_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client_payment_method(
    client_id: uuid.UUID = Path(..., description="The ID of the client"),
    payment_method_id: uuid.UUID = Path(..., description="The ID of the payment method to delete"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a payment method from a client.
    Clients can only delete their own payment methods.
    """
    # Check permissions for client users
    if current_user.role == "client":
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client or client.id != client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete payment methods for this client"
            )
    
    try:
        await PaymentService.delete_payment_method(db, client_id, payment_method_id)
        return None
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting payment method: {str(e)}"
        )