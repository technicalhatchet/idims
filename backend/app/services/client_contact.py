"""Client contact merge rules for public booking and staff updates."""

from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.client import Client
from app.utils.us_phone import (
    client_sms_destination,
    normalize_phone_field,
    normalize_us_phone_e164,
    phones_equal,
)


def find_client_by_contact(
    db: Session,
    *,
    mobile: Optional[str],
    other_phone: Optional[str],
    email: Optional[str],
) -> Optional[Client]:
    mobile_n = normalize_us_phone_e164(mobile) or (mobile.strip() if mobile and mobile.strip() else None)
    other_n = normalize_us_phone_e164(other_phone) or (
        other_phone.strip() if other_phone and other_phone.strip() else None
    )
    email_n = (email or "").strip().lower() or None

    if email_n:
        match = db.query(Client).filter(Client.email == email_n).first()
        if match:
            return match

    exact_values = [v for v in (mobile_n, other_n) if v]
    if exact_values:
        match = (
            db.query(Client)
            .filter(
                or_(
                    Client.mobile.in_(exact_values),
                    Client.phone.in_(exact_values),
                )
            )
            .first()
        )
        if match:
            return match

    if not mobile_n and not other_n:
        return None

    candidates = (
        db.query(Client)
        .filter(or_(Client.mobile.isnot(None), Client.phone.isnot(None)))
        .all()
    )
    for client in candidates:
        if mobile_n and (
            phones_equal(client.mobile, mobile_n) or phones_equal(client.phone, mobile_n)
        ):
            return client
        if other_n and (
            phones_equal(client.phone, other_n) or phones_equal(client.mobile, other_n)
        ):
            return client
    return None


def _fill_or_note(
    notes: List[str],
    label: str,
    existing: Optional[str],
    submitted: Optional[str],
) -> Optional[str]:
    sub = (submitted or "").strip()
    if not sub:
        return existing
    ex = (existing or "").strip()
    if not ex:
        return submitted
    if phones_equal(ex, sub) or ex == sub:
        return existing
    notes.append(f"Customer entered different {label}: {sub} (on file: {ex})")
    return existing


def apply_booking_contact_to_client(
    client: Client,
    *,
    first_name: str,
    last_name: Optional[str],
    mobile: Optional[str],
    other_phone: Optional[str],
    email: Optional[str],
    address_json: Optional[dict],
) -> List[str]:
    """
    Fill empty contact fields only; never overwrite existing values.
    Returns work-order note lines for mismatches.
    """
    notes: List[str] = []

    if first_name and first_name.strip():
        client.first_name = first_name.strip()
    if last_name and last_name.strip():
        client.last_name = last_name.strip()

    norm_mobile = normalize_phone_field(mobile)
    norm_other = normalize_phone_field(other_phone)
    norm_email = (email or "").strip().lower() or None

    client.mobile = _fill_or_note(notes, "cell", client.mobile, norm_mobile)
    client.phone = _fill_or_note(notes, "other phone", client.phone, norm_other)

    if norm_email:
        ex_email = (client.email or "").strip()
        if not ex_email or "@noreply.atomicrepair419.com" in ex_email.lower():
            client.email = norm_email
        elif ex_email.lower() != norm_email:
            notes.append(f"Customer entered different email: {norm_email} (on file: {ex_email})")

    if address_json and not client.address:
        client.address = address_json

    return notes


def apply_normalized_phones_to_client(client: Client, mobile: Optional[str], other_phone: Optional[str]) -> None:
    if mobile is not None:
        client.mobile = normalize_phone_field(mobile)
    if other_phone is not None:
        client.phone = normalize_phone_field(other_phone)


def set_sms_consent(
    client: Client,
    *,
    consent: bool,
    source: str,
    at,
) -> None:
    client.sms_consent = bool(consent)
    if consent:
        client.sms_consent_at = at
        client.sms_consent_source = source
    else:
        client.sms_consent_at = None
        client.sms_consent_source = None


def client_automated_sms_allowed(client: Client) -> bool:
    """Portal batch SMS (narrowing, same-day): needs opt-in and a cell number."""
    return bool(getattr(client, "sms_consent", False) and client_sms_destination(client.mobile))
