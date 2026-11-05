"""Tap to Pay: hand a work order's balance to the Square POS app, then verify and record it.

Flow (Square Point of Sale API, web):
  1. TechDeck calls start_tap_to_pay() → amount (from compute_balance_due), a signed
     short-lived `state`, the POS callback URL, and the Square app/location ids.
  2. The browser opens the Square app (iOS URL scheme / Android intent) with that data.
  3. Square returns to /pay/tap-callback with a transaction id and our `state`.
  4. record_tap_to_pay_result() checks the signature, then asks Square for the order and
     payment (COMPLETED, our location) and records a WorkOrderPayment once per payment.

Nothing the phone sends back is trusted for the amount: it comes from Square's API.
The callback page is public because iOS opens it in Safari, which doesn't share the
TechDeck home-screen app's login. The signed `state` is what authorizes it.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional

import httpx
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.core.exceptions import ValidationException
from app.models.work_order import WorkOrder, WorkOrderService as WorkOrderServiceModel
from app.models.work_order_payment import WorkOrderPayment
from app.utils.status_helpers import is_canceled_status

logger = logging.getLogger(__name__)

_PURPOSE = "tap_to_pay"
STATE_TTL_SECONDS = 2 * 3600
TAP_TO_PAY_NOTES = "Tap to Pay — Square POS"
SQUARE_API_VERSION = "2024-08-21"


# ---------- signed state ----------

def _secret() -> bytes:
    return (settings.PORTAL_INVITE_SECRET or settings.SECRET_KEY or "change-me-in-production").encode()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def make_state(work_order_id: uuid.UUID, amount_cents: int, user_id: uuid.UUID) -> str:
    payload = {
        "p": _PURPOSE,
        "wo": str(work_order_id),
        "c": int(amount_cents),
        "u": str(user_id),
        "exp": int(time.time()) + STATE_TTL_SECONDS,
        "n": secrets.token_hex(4),
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_state(state: str) -> Dict[str, Any]:
    try:
        body, sig = (state or "").split(".", 1)
        expected = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, sig):
            raise ValueError("bad signature")
        payload = json.loads(_unb64(body))
    except Exception as exc:
        raise ValidationException("This Tap to Pay result couldn't be verified.") from exc
    if payload.get("p") != _PURPOSE:
        raise ValidationException("This Tap to Pay result couldn't be verified.")
    if int(payload.get("exp") or 0) < time.time():
        raise ValidationException(
            "This Tap to Pay result is too old to record automatically. Check Square and record it by hand."
        )
    return payload


# ---------- helpers ----------

def callback_url() -> str:
    override = (os.getenv("TAP_TO_PAY_CALLBACK_URL") or "").strip()
    if override:
        return override
    from app.frontend_site_urls import idims_frontend_origin

    return f"{idims_frontend_origin().rstrip('/')}/pay/tap-callback"


def _load_work_order(db: Session, work_order_id) -> Optional[WorkOrder]:
    return (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.service_items).joinedload(WorkOrderServiceModel.service),
            joinedload(WorkOrder.parts),
            joinedload(WorkOrder.appointments),
        )
        .filter(WorkOrder.id == work_order_id)
        .first()
    )


def _square_base_url(environment: str) -> str:
    return "https://connect.squareup.com" if environment == "production" else "https://connect.squareupsandbox.com"


async def _square_get(cfg: Dict[str, Any], path: str) -> Dict[str, Any]:
    url = f"{_square_base_url(cfg['environment'])}{path}"
    headers = {
        "Authorization": f"Bearer {cfg['access_token']}",
        "Square-Version": SQUARE_API_VERSION,
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, headers=headers)
    if resp.status_code >= 400:
        logger.warning("Square GET %s failed: %s %s", path, resp.status_code, resp.text[:300])
        raise ValidationException("Square couldn't confirm this payment yet. Check Square and try again.")
    return resp.json()


# ---------- start ----------

def start_tap_to_pay(db: Session, work_order_id: uuid.UUID, user_id: uuid.UUID) -> Dict[str, Any]:
    from app.services.portal_square_payment_service import get_square_config, square_credentials_configured
    from app.services.work_order_billing_helpers import compute_balance_due

    work_order = _load_work_order(db, work_order_id)
    if not work_order:
        raise ValueError("Work order not found")
    if is_canceled_status(work_order.status):
        raise ValidationException("This work order is canceled.")
    if not square_credentials_configured(db):
        raise ValidationException("Square isn't set up in Settings → Billing / Square.")

    due = Decimal(str(compute_balance_due(work_order)))
    cents = int((due * 100).to_integral_value())
    if cents < 100:
        raise ValidationException("Nothing (or less than $1.00) is due on this job.")

    cfg = get_square_config(db)
    order_no = work_order.order_number or str(work_order.id)[:8]
    return {
        "application_id": cfg["application_id"],
        "location_id": cfg["location_id"],
        "amount_cents": cents,
        "currency": "USD",
        "note": f"Atomic Repair WO #{order_no}"[:500],
        "state": make_state(work_order.id, cents, user_id),
        "callback_url": callback_url(),
        "work_order_id": str(work_order.id),
        "order_number": order_no,
    }


# ---------- callback ----------

def _existing_payment(db: Session, work_order_id, square_payment_id: str) -> Optional[WorkOrderPayment]:
    return (
        db.query(WorkOrderPayment)
        .filter(
            WorkOrderPayment.work_order_id == work_order_id,
            WorkOrderPayment.reference_number == square_payment_id,
        )
        .first()
    )


def _result(work_order: WorkOrder, payment: WorkOrderPayment, *, already: bool, warning: Optional[str] = None,
            completion: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    from app.services.work_order_billing_helpers import compute_balance_due

    return {
        "recorded": True,
        "already_recorded": already,
        "amount": float(payment.amount),
        "payment_number": payment.payment_number,
        "work_order_id": str(work_order.id),
        "order_number": work_order.order_number,
        "balance_due": float(compute_balance_due(work_order)),
        "work_order_completed": bool((completion or {}).get("work_order_completed")),
        "warning": warning,
    }


async def record_tap_to_pay_result(db: Session, *, state: str, transaction_id: str) -> Dict[str, Any]:
    from app.services.portal_square_payment_service import get_square_config
    from app.services.work_order_billing_helpers import compute_tax_on_billable_parts_due
    from app.services.work_order_payment_service import _generate_payment_number, apply_payment_to_work_order

    payload = read_state(state)
    transaction_id = (transaction_id or "").strip()
    if not transaction_id or len(transaction_id) > 128:
        raise ValidationException("Square didn't send back a transaction id.")

    work_order = _load_work_order(db, uuid.UUID(payload["wo"]))
    if not work_order:
        raise ValueError("Work order not found")

    cfg = get_square_config(db)
    if not cfg["access_token"]:
        raise ValidationException("Square isn't set up in Settings → Billing / Square.")

    # POS API transaction id == Orders API order id; its tender points at the Payment.
    order = (await _square_get(cfg, f"/v2/orders/{transaction_id}")).get("order") or {}
    if cfg["location_id"] and order.get("location_id") and order["location_id"] != cfg["location_id"]:
        raise ValidationException("That Square payment belongs to a different location.")
    tenders = order.get("tenders") or []
    payment_id = next((t.get("payment_id") or t.get("id") for t in tenders if t.get("payment_id") or t.get("id")), None)
    if not payment_id:
        raise ValidationException("Square has no card payment on that transaction.")

    # Lock the work order row so a double-loaded callback can't record twice.
    db.query(WorkOrder.id).filter(WorkOrder.id == work_order.id).with_for_update().first()
    existing = _existing_payment(db, work_order.id, payment_id)
    if existing:
        return _result(work_order, existing, already=True)

    payment = (await _square_get(cfg, f"/v2/payments/{payment_id}")).get("payment") or {}
    if (payment.get("status") or "").upper() != "COMPLETED":
        raise ValidationException(f"Square shows this payment as {payment.get('status') or 'unknown'}, not completed.")
    if cfg["location_id"] and payment.get("location_id") and payment["location_id"] != cfg["location_id"]:
        raise ValidationException("That Square payment belongs to a different location.")

    total_cents = int(((payment.get("total_money") or payment.get("amount_money") or {}).get("amount")) or 0)
    tip_cents = int(((payment.get("tip_money") or {}).get("amount")) or 0)
    if total_cents <= 0:
        raise ValidationException("Square reported a $0 payment.")

    expected = int(payload.get("c") or 0)
    notes = TAP_TO_PAY_NOTES
    warning = None
    if total_cents - tip_cents != expected:
        warning = (
            f"Square charged ${(total_cents - tip_cents) / 100:.2f} but the job showed ${expected / 100:.2f}. "
            "The actual amount was recorded — check the balance."
        )
        notes += f" (expected ${expected / 100:.2f})"
    if tip_cents:
        notes += f" (includes ${tip_cents / 100:.2f} tip)"

    amount = float(Decimal(total_cents) / 100)
    tax_amount = float(compute_tax_on_billable_parts_due(work_order))
    recorder_id = uuid.UUID(payload["u"]) if payload.get("u") else (work_order.updated_by or work_order.created_by)

    record = WorkOrderPayment(
        work_order_id=work_order.id,
        payment_number=_generate_payment_number(db),
        amount=amount,
        subtotal_amount=max(0.0, amount - tax_amount),
        tax_amount=tax_amount,
        tax_rate_snapshot=work_order.tax_rate,
        payment_method="credit_card",
        reference_number=payment_id,
        notes=notes,
        recorded_by=recorder_id,
    )
    db.add(record)
    completion = apply_payment_to_work_order(db, work_order, amount, tax_amount=tax_amount, user_id=recorder_id)
    db.flush()
    return _result(work_order, record, already=False, warning=warning, completion=completion)
