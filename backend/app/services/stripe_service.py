"""
Stripe payment service for handling payments
"""

import stripe
import logging
from typing import Dict, List, Optional, Any
from decimal import Decimal
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Stripe with API key
if settings.STRIPE_API_KEY:
    stripe.api_key = settings.STRIPE_API_KEY
else:
    logger.warning("STRIPE_API_KEY not configured - Stripe functionality will be disabled")

class StripeService:
    """Service for handling Stripe payments"""
    
    @staticmethod
    def create_checkout_session(
        work_order_id: str,
        client_email: Optional[str] = None,
        client_name: Optional[str] = None,
        line_items: List[Dict[str, Any]],
        success_url: str,
        cancel_url: str,
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Create a Stripe Checkout session for payment
        
        Args:
            work_order_id: The work order ID
            client_email: Client's email address
            client_name: Client's name
            line_items: List of line items to charge for
            success_url: URL to redirect to on successful payment
            cancel_url: URL to redirect to on cancelled payment
            metadata: Additional metadata to store with the session
            
        Returns:
            Dict containing the checkout session data
        """
        if not settings.STRIPE_API_KEY:
            raise ValueError("Stripe API key not configured")
        
        try:
            # Prepare metadata
            session_metadata = {
                "work_order_id": work_order_id,
                **({"client_name": client_name} if client_name else {}),
                **(metadata or {})
            }
            
            # Create the checkout session
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=line_items,
                mode='payment',
                customer_email=client_email if client_email else None,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=session_metadata,
                invoice_creation={
                    'enabled': True,
                    'invoice_data': {
                        'description': f'Payment for Work Order #{work_order_id}',
                        'metadata': session_metadata
                    }
                },
                # Allow promo codes
                allow_promotion_codes=True,
                # Automatic tax calculation (if enabled in Stripe)
                automatic_tax={'enabled': False},
                # Payment intent data for additional metadata
                payment_intent_data={
                    'metadata': session_metadata
                }
            )
            
            logger.info(f"Created Stripe checkout session {checkout_session.id} for work order {work_order_id}")
            
            return {
                "session_id": checkout_session.id,
                "url": checkout_session.url,
                "payment_intent_id": checkout_session.payment_intent,
                "amount_total": checkout_session.amount_total,
                "currency": checkout_session.currency
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating checkout session: {e}")
            raise Exception(f"Payment processing error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error creating checkout session: {e}")
            raise Exception(f"Payment processing error: {str(e)}")
    
    @staticmethod
    def create_line_items(
        services: List[Dict[str, Any]], 
        parts: List[Dict[str, Any]], 
        diagnostic_discount: Optional[Decimal] = None
    ) -> List[Dict[str, Any]]:
        """
        Create Stripe line items from services and parts
        
        Args:
            services: List of services with billing_status 'billable'
            parts: List of parts with status in ['completed', 'phone_payment', 'up_front']
            diagnostic_discount: Optional diagnostic discount amount
            
        Returns:
            List of Stripe line items
        """
        line_items = []
        
        # Add services
        for service in services:
            if service.get('billing_status') == 'billable':
                line_items.append({
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': service['name'],
                            'description': f"Service: {service.get('notes', '')}" if service.get('notes') else None
                        },
                        'unit_amount': int(float(service['price']) * 100),  # Convert to cents
                    },
                    'quantity': service.get('quantity', 1),
                })
        
        # Add parts
        for part in parts:
            if part.get('status') in ['completed', 'phone_payment', 'up_front']:
                line_items.append({
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': part['name'],
                            'description': f"Part: {part.get('description', '')}" if part.get('description') else None
                        },
                        'unit_amount': int(float(part['price']) * 100),  # Convert to cents
                    },
                    'quantity': part.get('quantity', 1),
                })
        
        # Add diagnostic discount as a negative line item
        if diagnostic_discount and diagnostic_discount > 0:
            line_items.append({
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'Diagnostic Discount',
                        'description': 'Discount applied for diagnostic service when repair is performed'
                    },
                    'unit_amount': -int(float(diagnostic_discount) * 100),  # Negative amount
                },
                'quantity': 1,
            })
        
        return line_items
    
    @staticmethod
    def retrieve_session(session_id: str) -> Dict[str, Any]:
        """
        Retrieve a Stripe checkout session
        
        Args:
            session_id: The Stripe session ID
            
        Returns:
            Dict containing the session data
        """
        if not settings.STRIPE_API_KEY:
            raise ValueError("Stripe API key not configured")
        
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            
            return {
                "session_id": session.id,
                "payment_status": session.payment_status,
                "payment_intent_id": session.payment_intent,
                "amount_total": session.amount_total,
                "currency": session.currency,
                "customer_email": session.customer_email,
                "metadata": session.metadata,
                "status": session.status
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error retrieving session {session_id}: {e}")
            raise Exception(f"Error retrieving payment session: {str(e)}")
    
    @staticmethod
    def construct_webhook_event(payload: bytes, sig_header: str) -> Dict[str, Any]:
        """
        Construct and verify a Stripe webhook event
        
        Args:
            payload: Raw webhook payload
            sig_header: Stripe signature header
            
        Returns:
            Parsed webhook event
        """
        if not settings.STRIPE_WEBHOOK_SECRET:
            raise ValueError("Stripe webhook secret not configured")
        
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
            return event
        except ValueError as e:
            logger.error(f"Invalid payload: {e}")
            raise Exception("Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid signature: {e}")
            raise Exception("Invalid signature")
    
    @staticmethod
    def handle_payment_success(payment_intent_id: str) -> Dict[str, Any]:
        """
        Handle successful payment
        
        Args:
            payment_intent_id: Stripe payment intent ID
            
        Returns:
            Payment details
        """
        if not settings.STRIPE_API_KEY:
            raise ValueError("Stripe API key not configured")
        
        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            return {
                "payment_intent_id": payment_intent.id,
                "amount": payment_intent.amount,
                "currency": payment_intent.currency,
                "status": payment_intent.status,
                "metadata": payment_intent.metadata,
                "charges": [
                    {
                        "charge_id": charge.id,
                        "amount": charge.amount,
                        "currency": charge.currency,
                        "status": charge.status,
                        "payment_method": charge.payment_method_details.type if charge.payment_method_details else None
                    }
                    for charge in payment_intent.charges.data
                ]
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error retrieving payment intent {payment_intent_id}: {e}")
            raise Exception(f"Error retrieving payment details: {str(e)}")

