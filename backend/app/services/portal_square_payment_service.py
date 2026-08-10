"""Square Web Payments for portal self-scheduling."""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Optional

import httpx

from app.core.exceptions import ValidationException
from app.services.portal_scheduling_settings_service import get_portal_scheduling_settings

logger = logging.getLogger(__name__)


def _square_base_url(environment: str) -> str:
    if environment == "production":
        return "https://connect.squareup.com"
    return "https://connect.squareupsandbox.com"


def _amount_cents(amount: float) -> int:
    return int(Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * 100)


def get_square_config(db) -> Dict[str, Any]:
    settings = get_portal_scheduling_settings(db)
    payment = settings.get("payment") or {}
    return {
        "requires_payment": bool(payment.get("requires_payment")),
        "application_id": (payment.get("square_application_id") or "").strip(),
        "location_id": (payment.get("square_location_id") or "").strip(),
        "access_token": (payment.get("square_access_token") or "").strip(),
        "environment": payment.get("square_environment") or "sandbox",
    }


def square_credentials_configured(db) -> bool:
    cfg = get_square_config(db)
    return bool(cfg["application_id"] and cfg["location_id"] and cfg["access_token"])


def square_configured(db) -> bool:
    cfg = get_square_config(db)
    return bool(cfg["requires_payment"] and square_credentials_configured(db))


def public_square_config(db) -> Dict[str, Any]:
    """Safe fields for the client portal (no access token)."""
    cfg = get_square_config(db)
    return {
        "requires_payment": cfg["requires_payment"],
        "square_application_id": cfg["application_id"],
        "square_location_id": cfg["location_id"],
        "square_environment": cfg["environment"],
        "configured": square_configured(db),
    }


async def charge_square_payment(
    db,
    *,
    amount: float,
    source_id: str,
    idempotency_key: Optional[str] = None,
    reference: Optional[str] = None,
    require_portal_booking_payment: bool = False,
    failure_message: str = "Payment could not be processed. Please check your card or try again.",
) -> Dict[str, Any]:
    """Charge a card via Square Payments API. Returns payment payload."""
    cfg = get_square_config(db)
    if require_portal_booking_payment and not cfg["requires_payment"]:
        raise ValidationException("Payment is not required for portal booking.")
    if not square_credentials_configured(db):
        raise ValidationException(
            "Online payment is not configured yet. Please call us to complete payment."
        )
    if not source_id:
        raise ValidationException("Payment source is required.")

    cents = _amount_cents(amount)
    if cents < 100:
        raise ValidationException("Payment amount is too small.")

    payload = {
        "idempotency_key": idempotency_key or str(uuid.uuid4()),
        "source_id": source_id,
        "amount_money": {"amount": cents, "currency": "USD"},
        "location_id": cfg["location_id"],
        "autocomplete": True,
    }
    if reference:
        payload["reference_id"] = reference[:40]

    url = f"{_square_base_url(cfg['environment'])}/v2/payments"
    headers = {
        "Authorization": f"Bearer {cfg['access_token']}",
        "Content-Type": "application/json",
        "Square-Version": "2024-08-21",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)

    if response.status_code >= 400:
        logger.warning("Square payment failed: %s %s", response.status_code, response.text[:500])
        raise ValidationException(failure_message)

    body = response.json()
    payment = body.get("payment") or {}
    status = (payment.get("status") or "").upper()
    if status not in ("COMPLETED", "APPROVED", "PENDING"):
        raise ValidationException("Payment was not approved. Please try again or call us.")

    return {
        "square_payment_id": payment.get("id"),
        "status": status.lower(),
        "amount": amount,
        "receipt_url": payment.get("receipt_url"),
    }


async def charge_portal_booking(
    db,
    *,
    amount: float,
    source_id: str,
    idempotency_key: Optional[str] = None,
    reference: Optional[str] = None,
) -> Dict[str, Any]:
    """Charge a card for portal self-scheduling."""
    return await charge_square_payment(
        db,
        amount=amount,
        source_id=source_id,
        idempotency_key=idempotency_key,
        reference=reference,
        require_portal_booking_payment=True,
        failure_message=(
            "Payment could not be processed. Please check your card or call us to schedule."
        ),
    )
