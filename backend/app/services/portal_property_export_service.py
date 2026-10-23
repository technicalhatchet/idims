"""CSV / PDF export for portal appliances (Wave 1D)."""

from __future__ import annotations

import csv
import io
import re
from collections import defaultdict
from datetime import date, datetime
from typing import List, Optional, Tuple
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_appliance import ClientAppliance
from app.models.property import Property
from app.models.work_order import WorkOrder
from app.services import client_appliance_service as appliance_svc
from app.services.client_appliance_service import (
    _warranty_expires_at,
    _warranty_is_active,
    work_orders_for_appliance,
)
from app.services.work_order_billing_helpers import compute_net_invoice_total
from app.utils.datetime_utils import utcnow_naive

_EASTERN = ZoneInfo("America/New_York")
_EM_DASH = "—"


def _filter_appliances(
    db: Session,
    client: Client,
    property_id: Optional[UUID],
) -> List[ClientAppliance]:
    appliances = (
        db.query(ClientAppliance)
        .filter(ClientAppliance.client_id == client.id, ClientAppliance.is_active.is_(True))
        .all()
    )
    if property_id:
        appliances = [a for a in appliances if a.property_id == property_id]
    return appliances


def _strip_trailing_usa(value: str) -> str:
    if not value:
        return ""
    return re.sub(r",\s*USA\s*$", "", value.strip(), flags=re.IGNORECASE)


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt


def _to_eastern_date(value: Optional[str]) -> Optional[date]:
    dt = _parse_iso_datetime(value)
    if not dt:
        return None
    return dt.astimezone(_EASTERN).date()


def format_date_mdy_eastern(value: Optional[str]) -> str:
    d = _to_eastern_date(value)
    if not d:
        return _EM_DASH
    return f"{d.month}/{d.day}/{d.year}"


def format_date_csv(value: Optional[str]) -> str:
    d = _to_eastern_date(value)
    if not d:
        return ""
    return d.isoformat()


def _prepared_label_eastern() -> str:
    today = datetime.now(_EASTERN).date()
    return f"Prepared {today.strftime('%b')} {today.day}, {today.year}"


def _title_case_appliance_type(value: Optional[str]) -> str:
    if not value:
        return _EM_DASH
    cleaned = value.replace("_", " ").replace("-", " ").strip()
    return cleaned.title() if cleaned else _EM_DASH


def _appliance_row_label(data: dict) -> str:
    nick = (data.get("nickname") or "").strip()
    if nick:
        return nick
    return _title_case_appliance_type(data.get("equipment_subtype"))


def _is_staff_verified(data: dict) -> bool:
    if data.get("verified_by_staff_at"):
        return True
    return data.get("customer_source_label") == "verified_by_atomic"


def _warranty_cell(
    db: Session,
    appliance: ClientAppliance,
    data: dict,
) -> Tuple[str, str]:
    """Return (display_text, kind) where kind is active|expired|none."""
    if not data.get("last_service_date"):
        return (_EM_DASH, "none")

    now = utcnow_naive()
    work_orders = work_orders_for_appliance(db, appliance)
    active_expiry: Optional[datetime] = None
    for wo in work_orders:
        if _warranty_is_active(wo, db, now):
            exp = _warranty_expires_at(wo, db)
            if exp and (active_expiry is None or exp > active_expiry):
                active_expiry = exp

    if active_expiry:
        label = format_date_mdy_eastern(active_expiry.isoformat())
        return (f"Active until {label}", "active")

    return ("Expired", "expired")


def _property_group_key(data: dict) -> str:
    prop = data.get("property") or {}
    if prop.get("id"):
        return f"id:{prop['id']}"
    if prop.get("address"):
        return f"addr:{prop['address']}"
    if data.get("service_address"):
        return f"addr:{data['service_address']}"
    return "unassigned"


def _property_group_header(prop: Optional[dict], service_address: Optional[str]) -> Tuple[str, str]:
    if prop:
        nick = (prop.get("nickname") or "").strip()
        addr = _strip_trailing_usa(prop.get("address") or "")
        unit = (prop.get("unit_number") or "").strip()
        if unit and addr:
            addr = f"{addr} · Unit {unit}"
        if nick:
            return (nick, addr or "")
        return (addr or "Property", "")
    if service_address:
        addr = _strip_trailing_usa(service_address)
        return (addr, "")
    return ("No property assigned", "")


def appliances_csv(db: Session, client: Client, property_id: Optional[UUID] = None) -> str:
    rows = []
    for appliance in _filter_appliances(db, client, property_id):
        data = appliance_svc.serialize_appliance(appliance, db)
        prop = data.get("property") or {}
        rows.append(
            {
                "property_nickname": prop.get("nickname") or "",
                "property_address": prop.get("address") or "",
                "appliance": _appliance_row_label(data) if _appliance_row_label(data) != _EM_DASH else "",
                "brand": data.get("make") or "",
                "model": data.get("model") or "",
                "serial": data.get("serial") or "",
                "added_verified": data.get("customer_source_label_text") or "",
                "last_service_date": format_date_csv(data.get("last_service_date")),
                "warranty_status": "Active" if data.get("warranty_active") else "Expired",
            }
        )
    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=[
            "property_nickname",
            "property_address",
            "appliance",
            "brand",
            "model",
            "serial",
            "added_verified",
            "last_service_date",
            "warranty_status",
        ],
    )
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def repairs_csv(db: Session, client: Client, property_id: Optional[UUID] = None) -> str:
    query = db.query(WorkOrder).filter(WorkOrder.client_id == client.id)
    if property_id:
        query = query.filter(WorkOrder.property_id == property_id)
    work_orders = query.order_by(WorkOrder.created_at.desc()).all()

    rows = []
    for wo in work_orders:
        total = float(compute_net_invoice_total(wo))
        service_iso = wo.created_at.isoformat() if wo.created_at else ""
        rows.append(
            {
                "service_date": format_date_csv(service_iso),
                "work_order_number": wo.order_number or "",
                "appliance": " ".join(
                    p
                    for p in [
                        wo.equipment_make,
                        wo.equipment_model,
                        wo.equipment_subtype,
                    ]
                    if p
                ),
                "status": wo.status.value if hasattr(wo.status, "value") else str(wo.status),
                "invoice_total": f"{total:.2f}",
            }
        )
    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=["service_date", "work_order_number", "appliance", "status", "invoice_total"],
    )
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def _build_property_sections(
    db: Session,
    appliances: List[ClientAppliance],
) -> List[Tuple[str, str, List[Tuple[ClientAppliance, dict]]]]:
    grouped: dict[str, List[Tuple[ClientAppliance, dict]]] = defaultdict(list)
    headers: dict[str, Tuple[str, str]] = {}

    for appliance in appliances:
        data = appliance_svc.serialize_appliance(appliance, db)
        key = _property_group_key(data)
        prop = data.get("property")
        if key not in headers:
            headers[key] = _property_group_header(
                prop,
                data.get("service_address"),
            )
        grouped[key].append((appliance, data))

    def sort_key(key: str) -> str:
        title, subtitle = headers[key]
        return f"{title} {subtitle}".lower()

    ordered_keys = sorted(grouped.keys(), key=sort_key)
    return [(headers[k][0], headers[k][1], grouped[k]) for k in ordered_keys]


def _display_cell(value: Optional[str]) -> str:
    text = (value or "").strip()
    return text if text else _EM_DASH


def build_appliance_summary_document(
    db: Session,
    client: Client,
    property_id: Optional[UUID] = None,
) -> dict:
    appliances = _filter_appliances(db, client, property_id)
    sections_data = _build_property_sections(db, appliances)

    property_ids = {_property_group_key(appliance_svc.serialize_appliance(a, db)) for a in appliances}
    property_count = len(property_ids)
    appliance_count = len(appliances)

    filter_property_line = ""
    if property_id:
        prop = (
            db.query(Property)
            .filter(Property.id == property_id, Property.client_id == client.id)
            .first()
        )
        if prop:
            nick = (prop.nickname or "").strip()
            addr = _strip_trailing_usa(prop.address or "")
            filter_property_line = nick or addr

    subtitle_parts = [client.display_name]
    if filter_property_line:
        subtitle_parts.append(filter_property_line)
    customer_line = " · ".join(subtitle_parts)

    pdf_sections = []
    for title, address, rows in sections_data:
        pdf_rows = []
        for appliance, data in rows:
            model_raw = (data.get("model") or "").strip()
            warranty_text, warranty_kind = _warranty_cell(db, appliance, data)
            pdf_rows.append(
                {
                    "appliance": _display_cell(_appliance_row_label(data)),
                    "brand": _display_cell(data.get("make")),
                    "model": _display_cell(model_raw),
                    "model_verified": bool(model_raw and _is_staff_verified(data)),
                    "serial": _display_cell(data.get("serial")),
                    "last_service": format_date_mdy_eastern(data.get("last_service_date")),
                    "warranty": warranty_text,
                    "warranty_kind": warranty_kind,
                }
            )
        pdf_sections.append({"title": title, "address": address, "rows": pdf_rows})

    return {
        "customer_line": customer_line,
        "prepared_label": _prepared_label_eastern(),
        "summary_line": (
            f"{appliance_count} appliance{'s' if appliance_count != 1 else ''} across "
            f"{property_count} propert{'ies' if property_count != 1 else 'y'}"
        ),
        "sections": pdf_sections,
    }


def generate_appliances_summary_pdf(
    db: Session,
    client: Client,
    property_id: Optional[UUID] = None,
) -> bytes:
    from pdf.portal_appliance_summary_template import build_appliance_summary_pdf

    document = build_appliance_summary_document(db, client, property_id)
    return build_appliance_summary_pdf(document)
