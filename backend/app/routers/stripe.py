"""
Stripe payment router for handling payment operations
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.db.database import get_db
from app.core.dependencies import get_current_user, get_admin_or_manager_user
from app.models.user import User
from app.services.stripe_service import StripeService
from app.schemas.stripe import (
    CreateCheckoutSessionRequest,
    CreateCheckoutSessionResponse,
    PaymentSessionStatus,
    PaymentSuccessResponse,
    ProcessPaymentRequest,
    ProcessPaymentResponse
)
from app.models.work_order import WorkOrder, WorkOrderService, WorkOrderPart
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stripe", tags=["stripe"])

@router.post("/create-checkout-session", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a Stripe checkout session for a work order payment
    """
    try:
        # Get the work order
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == request.work_order_id
        ).first()
        
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        # Check if user has permission to create payment for this work order
        # For now, allow any authenticated user - you can add more specific permissions later
        
        # Get billable services
        billable_services = db.query(WorkOrderService).filter(
            WorkOrderService.work_order_id == request.work_order_id,
            WorkOrderService.billing_status == 'billable'
        ).all()
        
        # Get billable parts
        billable_parts = db.query(WorkOrderPart).filter(
            WorkOrderPart.work_order_id == request.work_order_id,
            WorkOrderPart.status.in_(['completed', 'phone_payment', 'up_front'])
        ).all()
        
        # Convert to dictionaries for Stripe service
        services_data = [
            {
                'name': service.name,
                'price': float(service.price),
                'quantity': service.quantity,
                'billing_status': service.billing_status,
                'notes': service.notes
            }
            for service in billable_services
        ]
        
        parts_data = [
            {
                'name': part.name,
                'price': float(part.price),
                'quantity': part.quantity,
                'status': part.status,
                'description': part.description
            }
            for part in billable_parts
        ]
        
        # Create line items
        line_items = StripeService.create_line_items(
            services=services_data,
            parts=parts_data,
            diagnostic_discount=work_order.diagnostic_discount_amount
        )
        
        if not line_items:
            raise HTTPException(
                status_code=400, 
                detail="No billable items found for this work order"
            )
        
        # Create checkout session
        session_data = StripeService.create_checkout_session(
            work_order_id=request.work_order_id,
            client_email=request.client_email,
            client_name=request.client_name,
            line_items=line_items,
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata={
                "created_by": str(current_user.id),
                "work_order_number": work_order.order_number or work_order.id[:8]
            }
        )
        
        logger.info(f"Created Stripe checkout session {session_data['session_id']} for work order {request.work_order_id}")
        
        return CreateCheckoutSessionResponse(**session_data)
        
    except ValueError as e:
        logger.error(f"Value error creating checkout session: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating payment session: {str(e)}")

@router.get("/session/{session_id}", response_model=PaymentSessionStatus)
async def get_session_status(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the status of a Stripe checkout session
    """
    try:
        session_data = StripeService.retrieve_session(session_id)
        return PaymentSessionStatus(**session_data)
        
    except ValueError as e:
        logger.error(f"Value error retrieving session {session_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving payment session: {str(e)}")

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Handle Stripe webhook events
    """
    try:
        # Get the raw body and signature
        body = await request.body()
        sig_header = request.headers.get('stripe-signature')
        
        if not sig_header:
            raise HTTPException(status_code=400, detail="Missing stripe-signature header")
        
        # Verify the webhook
        event = StripeService.construct_webhook_event(body, sig_header)
        
        logger.info(f"Received Stripe webhook event: {event['type']}")
        
        # Handle different event types
        if event['type'] == 'checkout.session.completed':
            await handle_checkout_completed(event, db, background_tasks)
        elif event['type'] == 'payment_intent.succeeded':
            await handle_payment_succeeded(event, db, background_tasks)
        elif event['type'] == 'payment_intent.payment_failed':
            await handle_payment_failed(event, db, background_tasks)
        else:
            logger.info(f"Unhandled webhook event type: {event['type']}")
        
        return {"status": "success"}
        
    except ValueError as e:
        logger.error(f"Value error processing webhook: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing webhook: {str(e)}")

async def handle_checkout_completed(event: Dict[str, Any], db: Session, background_tasks: BackgroundTasks):
    """Handle checkout.session.completed webhook"""
    session_data = event['data']['object']
    work_order_id = session_data['metadata'].get('work_order_id')
    
    if not work_order_id:
        logger.error("No work_order_id in checkout session metadata")
        return
    
    logger.info(f"Checkout completed for work order {work_order_id}")
    
    # Update work order with payment information
    background_tasks.add_task(
        process_payment_success,
        work_order_id=work_order_id,
        session_id=session_data['id'],
        payment_intent_id=session_data['payment_intent'],
        amount=session_data['amount_total']
    )

async def handle_payment_succeeded(event: Dict[str, Any], db: Session, background_tasks: BackgroundTasks):
    """Handle payment_intent.succeeded webhook"""
    payment_intent = event['data']['object']
    work_order_id = payment_intent['metadata'].get('work_order_id')
    
    if not work_order_id:
        logger.error("No work_order_id in payment intent metadata")
        return
    
    logger.info(f"Payment succeeded for work order {work_order_id}")
    
    # Process the payment
    background_tasks.add_task(
        process_payment_success,
        work_order_id=work_order_id,
        session_id=None,
        payment_intent_id=payment_intent['id'],
        amount=payment_intent['amount']
    )

async def handle_payment_failed(event: Dict[str, Any], db: Session, background_tasks: BackgroundTasks):
    """Handle payment_intent.payment_failed webhook"""
    payment_intent = event['data']['object']
    work_order_id = payment_intent['metadata'].get('work_order_id')
    
    if not work_order_id:
        logger.error("No work_order_id in payment intent metadata")
        return
    
    logger.error(f"Payment failed for work order {work_order_id}")
    
    # Log the failure - you might want to send notifications here
    background_tasks.add_task(
        process_payment_failure,
        work_order_id=work_order_id,
        payment_intent_id=payment_intent['id'],
        failure_reason=payment_intent.get('last_payment_error', {}).get('message', 'Unknown error')
    )

def process_payment_success(
    work_order_id: str,
    session_id: Optional[str],
    payment_intent_id: str,
    amount: int
):
    """Process successful payment - update work order and service statuses"""
    try:
        from app.db.database import SessionLocal
        
        db = SessionLocal()
        
        # Get the work order
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id
        ).first()
        
        if not work_order:
            logger.error(f"Work order {work_order_id} not found")
            return
        
        # Convert amount from cents to dollars
        payment_amount = amount / 100
        
        # Update work order with payment information
        work_order.amount_previously_paid = (work_order.amount_previously_paid or 0) + payment_amount
        
        # Update all billable services to paid
        billable_services = db.query(WorkOrderService).filter(
            WorkOrderService.work_order_id == work_order_id,
            WorkOrderService.billing_status == 'billable'
        ).all()
        
        for service in billable_services:
            service.billing_status = 'paid'
            logger.info(f"Updated service {service.id} to paid status")
        
        # Recalculate totals
        work_order.calculate_totals()
        
        db.commit()
        logger.info(f"Successfully processed payment for work order {work_order_id}: ${payment_amount}")
        
    except Exception as e:
        logger.error(f"Error processing payment success: {e}")
        db.rollback()
    finally:
        db.close()

def process_payment_failure(
    work_order_id: str,
    payment_intent_id: str,
    failure_reason: str
):
    """Process payment failure - log and potentially send notifications"""
    try:
        logger.error(f"Payment failed for work order {work_order_id}: {failure_reason}")
        
        # Here you could:
        # - Send email notification to admin
        # - Update work order status
        # - Log to audit trail
        # - Send SMS notification
        
    except Exception as e:
        logger.error(f"Error processing payment failure: {e}")

@router.post("/process-payment", response_model=ProcessPaymentResponse)
async def process_payment(
    request: ProcessPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user)
):
    """
    Process payment manually (admin/manager only)
    """
    try:
        # Get the work order
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == request.work_order_id
        ).first()
        
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        # Update work order with payment
        work_order.amount_previously_paid = (work_order.amount_previously_paid or 0) + request.amount
        
        # Update billable services to paid
        billable_services = db.query(WorkOrderService).filter(
            WorkOrderService.work_order_id == request.work_order_id,
            WorkOrderService.billing_status == 'billable'
        ).all()
        
        for service in billable_services:
            service.billing_status = 'paid'
        
        # Recalculate totals
        work_order.calculate_totals()
        
        db.commit()
        
        logger.info(f"Manually processed payment of ${request.amount} for work order {request.work_order_id}")
        
        return ProcessPaymentResponse(
            success=True,
            payment_id=f"manual_{work_order_id}_{int(request.amount * 100)}",
            amount=request.amount,
            currency="usd",
            status="succeeded",
            message="Payment processed successfully"
        )
        
    except Exception as e:
        logger.error(f"Error processing manual payment: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing payment: {str(e)}")
