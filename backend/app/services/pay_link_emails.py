"""Customer emails for pay links: the invoice (PDF + Pay online button) and the payment receipt."""

from __future__ import annotations

import html
import logging
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

PHONE = "(419) 740-0146"
CYAN = "#00D4FF"
GREEN = "#34D399"


def _money(value: float) -> str:
    return f"${float(value):,.2f}"


def _shell(title: str, body_html: str) -> str:
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;padding:28px;border-radius:12px;">
      <h2 style="color:#ffffff;margin:0 0 16px;font-size:20px;">{title}</h2>
      {body_html}
      <p style="color:#6b7280;font-size:13px;margin-top:24px;">Questions? Reply to this email or call {PHONE}.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:8px;">Thank you for choosing Atomic Repair.</p>
    </div>
    """


def _button(url: str, label: str, color: str = GREEN) -> str:
    return (
        f'<p style="margin:22px 0;"><a href="{html.escape(url)}" '
        f'style="display:inline-block;background:{color};color:#0A0F1E;font-weight:bold;'
        f'text-decoration:none;padding:13px 22px;border-radius:8px;">{html.escape(label)}</a></p>'
    )


async def send_invoice_with_pay_link(db: Session, work_order) -> Dict[str, Any]:
    """Email the invoice PDF with a "Pay online" button (or a paid note when nothing is due)."""
    from app.services.email_service import EmailService
    from app.services.pay_link_service import amount_due, ensure_pay_token, pay_state, pay_url_for_token
    from app.services.work_order_invoice_pdf_data import (
        generate_work_order_document_pdf_v2,
        resolve_work_order_client_email,
    )

    to_email, name = resolve_work_order_client_email(db, work_order)
    if not to_email:
        raise ValueError("No email address on file for this client")

    token = ensure_pay_token(db, work_order)
    pay_url = pay_url_for_token(token)
    due = amount_due(work_order)
    state = pay_state(work_order, due)
    pdf = generate_work_order_document_pdf_v2(db, work_order, doc_type="invoice", variant="light")

    order_no = html.escape(str(work_order.order_number))
    hi = f'<p style="color:#9ca3af;">Hi {html.escape(name or "there")},</p>'
    if state == "due":
        body = (
            hi
            + f'<p style="color:#9ca3af;">Your invoice <strong style="color:{CYAN};">#{order_no}</strong> is attached. '
            f'The balance due is <strong style="color:#ffffff;">{_money(due)}</strong>.</p>'
            + _button(pay_url, f"Pay {_money(due)} online")
            + '<p style="color:#6b7280;font-size:13px;">You can pay by card or Apple Pay. The link shows your full invoice.</p>'
        )
    else:
        body = (
            hi
            + f'<p style="color:#9ca3af;">Your invoice <strong style="color:{CYAN};">#{order_no}</strong> is attached. '
            "Nothing is due — thank you!</p>"
        )

    sent = await EmailService.send_resend_email(
        to_email,
        f"Atomic Repair Invoice #{work_order.order_number}",
        _shell("Your Atomic Repair invoice", body),
        attachments=[{"filename": f"invoice-{work_order.order_number}.pdf", "content": pdf}],
        timeout=30.0,
    )
    if not sent:
        raise RuntimeError("Unable to send email right now. Please try again later.")
    return {"email": to_email, "pay_url": pay_url, "amount_due": round(due, 2)}


async def send_payment_receipt(
    db: Session,
    work_order,
    *,
    amount: float,
    receipt_url: Optional[str],
    pay_url: Optional[str] = None,
) -> bool:
    """Best-effort receipt after an online payment. Never raises."""
    try:
        from app.services.email_service import EmailService
        from app.services.pay_link_service import amount_due
        from app.services.work_order_invoice_pdf_data import resolve_work_order_client_email

        to_email, name = resolve_work_order_client_email(db, work_order)
        if not to_email:
            return False

        remaining = amount_due(work_order)
        order_no = html.escape(str(work_order.order_number))
        rows = [
            ("Amount paid", _money(amount)),
            ("Invoice", f"#{order_no}"),
            ("Date", datetime.now().strftime("%b %d, %Y")),
            ("Balance remaining", _money(remaining)),
        ]
        table = "".join(
            f'<tr><td style="color:#9ca3af;padding:4px 0;">{k}</td>'
            f'<td style="color:#ffffff;padding:4px 0;text-align:right;">{v}</td></tr>'
            for k, v in rows
        )
        body = (
            f'<p style="color:#9ca3af;">Hi {html.escape(name or "there")}, we received your payment. Thank you!</p>'
            f'<table style="width:100%;border-collapse:collapse;margin:12px 0;">{table}</table>'
        )
        if receipt_url:
            body += _button(receipt_url, "View card receipt", CYAN)
        if pay_url:
            body += f'<p style="color:#6b7280;font-size:13px;">Your invoice: <a href="{html.escape(pay_url)}" style="color:{CYAN};">view online</a></p>'

        return await EmailService.send_resend_email(
            to_email,
            f"Payment received — Atomic Repair #{work_order.order_number}",
            _shell(f"Payment received: {_money(amount)}", body),
        )
    except Exception as exc:  # a receipt must never break a paid charge
        logger.warning("[Pay receipt] not sent for WO %s: %s", getattr(work_order, "id", "?"), exc)
        return False
