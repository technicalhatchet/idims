import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
import stripe
import json
import hmac
import hashlib

from app.models.payment import Payment, PaymentMethod
from app.models.invoice import Invoice
from app.models.client import Client
from app.schemas.payment import PaymentCreate, PaymentMethodCreate, PaymentIntentCreate
from app.core.exceptions import NotFoundException, ValidationException, ConflictException
from app.config import settings

logger = logging.getLogger(__name__)

# Configure Stripe if credentials available
if settings.STRIPE_API_KEY:
    stripe.api_key = settings.STRIPE_API_KEY

class PaymentService:
    """Service for handling payment operations"""
    
    @staticmethod
    async def get_payments(
        db: Session,
        invoice_id: Optional[uuid.UUID] = None,
        client_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        payment_method: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get payments with filtering and pagination"""
        query = db.query(Payment)
        
        # Apply filters
        if invoice_id:
            query = query.filter(Payment.invoice_id == invoice_id)
        
        if client_id:
            # Join with invoices to filter by client
            query = query.join(Invoice).filter(Invoice.client_id == client_id)
        
        if status:
            query = query.filter(Payment.status == status)
        
        if payment_method:
            query = query.filter(Payment.payment_method == payment_method)
        
        if start_date:
            query = query.filter(Payment.payment_date >= start_date)
        
        if end_date:
            query = query.filter(Payment.payment_date <= end_date)
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination and order by payment date descending
        payments = query.order_by(Payment.payment_date.desc()).offset(skip).limit(limit).all()
        
        # Enhance payment data with invoice and client info
        result_payments = []
        for payment in payments:
            payment_dict = {
                "id": payment.id,
                "payment_number": payment.payment_number,
                "invoice_id": payment.invoice_id,
                "amount": payment.amount,
                "payment_method": payment.payment_method,
                "reference_number": payment.reference_number,
                "notes": payment.notes,
                "payment_date": payment.payment_date,
                "status": payment.status,
                "transaction_id": payment.transaction_id,
                "processor_response": payment.processor_response,
                "created_at": payment.created_at,
                "updated_at": payment.updated_at,
                "created_by": payment.created_by,
                "invoice_number": None,
                "client_id": None,
                "client_name": None
            }
            
            # Get invoice information
            if payment.invoice:
                payment_dict["invoice_number"] = payment.invoice.invoice_number
                
                # Get client information
                if payment.invoice.client:
                    payment_dict["client_id"] = payment.invoice.client_id
                    payment_dict["client_name"] = payment.invoice.client.company_name or f"{payment.invoice.client.first_name} {payment.invoice.client.last_name}"
            
            result_payments.append(payment_dict)
        
        return {
            "total": total,
            "items": result_payments,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit
        }
    
    @staticmethod
    async def get_payment(db: Session, payment_id: uuid.UUID) -> Payment:
        """Get a specific payment by ID"""
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        
        if not payment:
            raise NotFoundException(f"Payment with ID {payment_id} not found")
        
        return payment
    
    @staticmethod
    async def create_payment(db: Session, payment_data: PaymentCreate, created_by: uuid.UUID) -> Payment:
        """Create a new payment"""
        # Validate invoice exists
        invoice = db.query(Invoice).filter(Invoice.id == payment_data.invoice_id).first()
        if not invoice:
            raise NotFoundException(f"Invoice with ID {payment_data.invoice_id} not found")
        
        # Set default payment date if not provided
        if not payment_data.payment_date:
            payment_data.payment_date = datetime.utcnow()
        
        try:
            # Generate unique payment number
            payment_number = await PaymentService._generate_payment_number(db)
            
            # Create payment record
            new_payment = Payment(
                invoice_id=payment_data.invoice_id,
                payment_number=payment_number,
                amount=payment_data.amount,
                payment_method=payment_data.payment_method,
                reference_number=payment_data.reference_number,
                notes=payment_data.notes,
                payment_date=payment_data.payment_date,
                status=payment_data.status,
                transaction_id=payment_data.transaction_id,
                processor_response=payment_data.processor_response,
                created_by=created_by
            )
            
            db.add(new_payment)
            db.flush()
            
            # Update invoice - apply payment
            new_payment.apply_to_invoice()
            
            db.commit()
            db.refresh(new_payment)
            
            return new_payment
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating payment: {str(e)}")
            raise ConflictException(f"Failed to create payment: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating payment: {str(e)}")
            raise ValidationException(f"Failed to create payment: {str(e)}")
    
    @staticmethod
    async def refund_payment(
        db: Session, 
        payment_id: uuid.UUID, 
        amount: Optional[float] = None, 
        reason: Optional[str] = None,
        created_by: uuid.UUID = None
    ) -> Payment:
        """Refund a payment, either partially or in full"""
        payment = await PaymentService.get_payment(db, payment_id)
        
        # Check if payment can be refunded
        if payment.status != "success":
            raise ConflictException(f"Payment with status {payment.status} cannot be refunded")
        
        try:
            # Process refund - for credit card/stripe payments, would call payment gateway
            if payment.payment_method in ["credit_card", "stripe", "paypal"]:
                await PaymentService._process_gateway_refund(payment, amount, reason)
            
            # Apply refund to payment
            refund_amount = amount if amount and amount <= payment.amount else payment.amount
            
            # Update payment status
            payment.status = "refunded"
            
            # Add refund details to notes
            refund_notes = f"Refunded {refund_amount} on {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}."
            if reason:
                refund_notes += f" Reason: {reason}"
                
            if payment.notes:
                payment.notes += f"\n{refund_notes}"
            else:
                payment.notes = refund_notes
            
            # Apply refund to invoice
            if payment.invoice:
                payment.invoice.amount_paid -= refund_amount
                payment.invoice.update_balance()
            
            # Create refund record if needed (for partial refunds)
            if amount and amount < payment.amount:
                # Create a negative payment (refund record)
                refund_payment = Payment(
                    invoice_id=payment.invoice_id,
                    payment_number=await PaymentService._generate_payment_number(db, prefix="REF-"),
                    amount=-refund_amount,  # Negative amount for refund
                    payment_method=payment.payment_method,
                    reference_number=f"Refund for {payment.payment_number}",
                    notes=f"Partial refund of {refund_amount} for payment {payment.payment_number}. Reason: {reason or 'Not specified'}",
                    payment_date=datetime.utcnow(),
                    status="success",
                    transaction_id=f"REF-{payment.transaction_id}" if payment.transaction_id else None,
                    created_by=created_by
                )
                
                db.add(refund_payment)
            
            db.commit()
            db.refresh(payment)
            
            return payment
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error processing refund: {str(e)}")
            raise ValidationException(f"Failed to process refund: {str(e)}")
    
    @staticmethod
    async def _process_gateway_refund(payment: Payment, amount: Optional[float] = None, reason: Optional[str] = None):
        """Process refund through payment gateway"""
        # Skip if no transaction ID (manual entry)
        if not payment.transaction_id:
            return
        
        # Process based on payment method
        if payment.payment_method == "stripe" and settings.STRIPE_API_KEY:
            try:
                refund_amount = int((amount or payment.amount) * 100)  # Convert to cents
                
                refund = stripe.Refund.create(
                    payment_intent=payment.transaction_id,
                    amount=refund_amount,
                    reason=reason or "requested_by_customer"
                )
                
                return refund
            except stripe.error.StripeError as e:
                logger.error(f"Stripe refund error: {str(e)}")
                raise ValidationException(f"Payment gateway error: {str(e)}")
        
        # Other payment gateways would be implemented here
        
        return None
    
    @staticmethod
    async def process_stripe_webhook(db: Session, payload, signature_header):
        """Process webhook from Stripe"""
        if not settings.STRIPE_WEBHOOK_SECRET:
            raise ValidationException("Stripe webhook secret not configured")
        
        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload, signature_header, settings.STRIPE_WEBHOOK_SECRET
            )
            
            # Process the event based on type
            if event['type'] == 'payment_intent.succeeded':
                await PaymentService._handle_payment_succeeded(db, event['data']['object'])
            elif event['type'] == 'payment_intent.payment_failed':
                await PaymentService._handle_payment_failed(db, event['data']['object'])
            
            return {"status": "success", "event_type": event['type']}
            
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            logger.error(f"Stripe webhook verification error: {str(e)}")
            raise ValidationException(f"Invalid webhook payload: {str(e)}")
    
    @staticmethod
    async def _handle_payment_succeeded(db: Session, payment_intent):
        """Handle successful payment from Stripe webhook"""
        # Extract metadata
        metadata = payment_intent.get('metadata', {})
        invoice_id = metadata.get('invoice_id')
        
        if not invoice_id:
            logger.error("Payment succeeded without invoice ID in metadata")
            return
        
        try:
            # Find the invoice
            invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            if not invoice:
                logger.error(f"Invoice {invoice_id} not found for payment intent {payment_intent['id']}")
                return
            
            # Check if payment already recorded
            existing_payment = db.query(Payment).filter(
                Payment.transaction_id == payment_intent['id']
            ).first()
            
            if existing_payment:
                logger.info(f"Payment for intent {payment_intent['id']} already recorded")
                return
            
            # Create new payment record
            amount = payment_intent['amount'] / 100  # Convert from cents
            
            new_payment = Payment(
                invoice_id=invoice.id,
                payment_number=await PaymentService._generate_payment_number(db),
                amount=amount,
                payment_method="stripe",
                transaction_id=payment_intent['id'],
                payment_date=datetime.utcnow(),
                status="success",
                processor_response={
                    'id': payment_intent['id'],
                    'payment_method_types': payment_intent['payment_method_types'],
                    'amount': payment_intent['amount'],
                    'currency': payment_intent['currency'],
                    'created': payment_intent['created']
                }
            )
            
            db.add(new_payment)
            db.flush()
            
            # Update invoice
            new_payment.apply_to_invoice()
            
            # Save payment method if requested
            if metadata.get('save_payment_method') == 'true' and payment_intent.get('payment_method'):
                # Get payment method details from Stripe
                payment_method_id = payment_intent['payment_method']
                pm_details = stripe.PaymentMethod.retrieve(payment_method_id)
                
                # Create payment method record
                client_payment_method = PaymentMethod(
                    client_id=invoice.client_id,
                    type="credit_card",
                    token=payment_method_id,
                    last_four=pm_details.card.last4 if hasattr(pm_details, 'card') else None,
                    expiry_date=f"{pm_details.card.exp_month:02d}/{pm_details.card.exp_year}" if hasattr(pm_details, 'card') else None,
                    is_default=True
                )
                
                # Set existing methods as non-default
                existing_methods = db.query(PaymentMethod).filter(
                    PaymentMethod.client_id == invoice.client_id,
                    PaymentMethod.is_default == True
                ).all()
                
                for method in existing_methods:
                    method.is_default = False
                
                db.add(client_payment_method)
            
            db.commit()
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error processing payment_intent.succeeded: {str(e)}")
    
    @staticmethod
    async def _handle_payment_failed(db: Session, payment_intent):
        """Handle failed payment from Stripe webhook"""
        # Record the failed payment attempt if needed
        pass
    
    @staticmethod
    async def create_payment_intent(db: Session, intent_data: PaymentIntentCreate) -> Dict[str, Any]:
        """Create a payment intent with Stripe"""
        if not settings.STRIPE_API_KEY:
            raise ValidationException("Stripe API key not configured")
        
        # Validate invoice exists
        invoice = db.query(Invoice).filter(Invoice.id == intent_data.invoice_id).first()
        if not invoice:
            raise NotFoundException(f"Invoice with ID {intent_data.invoice_id} not found")
        
        # Get client
        client = invoice.client
        if not client:
            raise ValidationException("Invoice has no associated client")
        
        try:
            # Prepare metadata
            metadata = {
                'invoice_id': str(invoice.id),
                'invoice_number': invoice.invoice_number,
                'client_id': str(client.id),
                'save_payment_method': str(intent_data.save_payment_method).lower()
            }
            
            if intent_data.metadata:
                metadata.update(intent_data.metadata)
            
            # Convert amount to cents for Stripe
            amount_cents = int(intent_data.amount * 100)
            
            # Create payment intent
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency='usd',  # Should be configurable
                payment_method=intent_data.payment_method_id,
                metadata=metadata,
                confirm=False,
                customer=client.stripe_customer_id if hasattr(client, 'stripe_customer_id') else None
            )
            
            return {
                'client_secret': intent.client_secret,
                'payment_intent_id': intent.id,
                'amount': intent_data.amount,
                'currency': 'usd',
                'invoice_id': str(invoice.id),
                'invoice_number': invoice.invoice_number
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe payment intent error: {str(e)}")
            raise ValidationException(f"Payment gateway error: {str(e)}")
        except Exception as e:
            logger.error(f"Error creating payment intent: {str(e)}")
            raise ValidationException(f"Failed to create payment intent: {str(e)}")
    
    @staticmethod
    async def get_client_payment_methods(db: Session, client_id: uuid.UUID) -> List[PaymentMethod]:
        """Get payment methods for a client"""
        # Check if client exists
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            raise NotFoundException(f"Client with ID {client_id} not found")
        
        # Get payment methods
        payment_methods = db.query(PaymentMethod).filter(
            PaymentMethod.client_id == client_id
        ).all()
        
        return payment_methods
    
    @staticmethod
    async def create_payment_method(db: Session, client_id: uuid.UUID, payment_method_data: PaymentMethodCreate) -> PaymentMethod:
        """Create a new payment method for a client"""
        # Check if client exists
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            raise NotFoundException(f"Client with ID {client_id} not found")
        
        try:
            # If setting as default, unset existing defaults
            if payment_method_data.is_default:
                existing_defaults = db.query(PaymentMethod).filter(
                    PaymentMethod.client_id == client_id,
                    PaymentMethod.is_default == True
                ).all()
                
                for method in existing_defaults:
                    method.is_default = False
            
            # Create payment method
            new_method = PaymentMethod(
                client_id=client_id,
                type=payment_method_data.type,
                token=payment_method_data.token,
                last_four=payment_method_data.last_four,
                expiry_date=payment_method_data.expiry_date,
                nickname=payment_method_data.nickname,
                is_default=payment_method_data.is_default,
                metadata=payment_method_data.metadata
            )
            
            db.add(new_method)
            db.commit()
            db.refresh(new_method)
            
            return new_method
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating payment method: {str(e)}")
            raise ConflictException(f"Failed to create payment method: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating payment method: {str(e)}")
            raise ValidationException(f"Failed to create payment method: {str(e)}")
    
    @staticmethod
    async def delete_payment_method(db: Session, client_id: uuid.UUID, payment_method_id: uuid.UUID) -> bool:
        """Delete a payment method"""
        # Check if payment method exists and belongs to client
        payment_method = db.query(PaymentMethod).filter(
            PaymentMethod.id == payment_method_id,
            PaymentMethod.client_id == client_id
        ).first()
        
        if not payment_method:
            raise NotFoundException(f"Payment method not found or doesn't belong to client")
        
        try:
            # Delete payment method
            db.delete(payment_method)
            db.commit()
            
            return True
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error deleting payment method: {str(e)}")
            raise ConflictException(f"Failed to delete payment method: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting payment method: {str(e)}")
            raise ValidationException(f"Failed to delete payment method: {str(e)}")
    
    @staticmethod
    async def _generate_payment_number(db: Session, prefix: str = "PMT-") -> str:
        """Generate a unique payment number"""
        # Get the last payment number
        last_payment = db.query(Payment).filter(
            Payment.payment_number.like(f"{prefix}%")
        ).order_by(Payment.payment_number.desc()).first()
        
        if last_payment and last_payment.payment_number.startswith(prefix):
            try:
                last_number = int(last_payment.payment_number[len(prefix):])
                next_number = last_number + 1
            except ValueError:
                next_number = 1001
        else:
            next_number = 1001
        
        return f"{prefix}{next_number}"