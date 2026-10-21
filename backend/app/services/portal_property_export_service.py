"""CSV / print export for portal appliances (Wave 1D)."""

from __future__ import annotations

import csv
import io
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_appliance import ClientAppliance
from app.services import client_appliance_service as appliance_svc
from app.services.work_order_billing_helpers import compute_net_invoice_total
from app.models.work_order import WorkOrder


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


def appliances_csv(db: Session, client: Client, property_id: Optional[UUID] = None) -> str:
    rows = []
    for appliance in _filter_appliances(db, client, property_id):
        data = appliance_svc.serialize_appliance(appliance, db)
        prop = data.get("property") or {}
        rows.append(
            {
                "property_nickname": prop.get("nickname") or "",
                "property_address": prop.get("address") or "",
                "appliance": data.get("nickname") or data.get("equipment_subtype") or "",
                "brand": data.get("make") or "",
                "model": data.get("model") or "",
                "serial": data.get("serial") or "",
                "added_verified": data.get("customer_source_label_text") or "",
                "last_service_date": data.get("last_service_date") or "",
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
        rows.append(
            {
                "service_date": wo.created_at.isoformat() if wo.created_at else "",
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


def appliances_print_html(db: Session, client: Client, property_id: Optional[UUID] = None) -> str:
    appliances = _filter_appliances(db, client, property_id)
    parts = [
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>My Appliances</title>",
        "<style>body{font-family:sans-serif;padding:1.5rem;} table{border-collapse:collapse;width:100%;}",
        "th,td{border:1px solid #ccc;padding:6px;font-size:12px;}</style></head><body>",
        "<h1>My Appliances</h1><table><tr>",
        "<th>Property</th><th>Appliance</th><th>Brand</th><th>Model</th><th>Serial</th><th>Last service</th><th>Warranty</th></tr>",
    ]
    for appliance in appliances:
        data = appliance_svc.serialize_appliance(appliance, db)
        prop = data.get("property") or {}
        prop_label = prop.get("nickname") or prop.get("address") or ""
        parts.append(
            "<tr>"
            f"<td>{prop_label}</td>"
            f"<td>{data.get('nickname') or data.get('equipment_subtype') or ''}</td>"
            f"<td>{data.get('make') or ''}</td>"
            f"<td>{data.get('model') or ''}</td>"
            f"<td>{data.get('serial') or ''}</td>"
            f"<td>{data.get('last_service_date') or ''}</td>"
            f"<td>{'Active' if data.get('warranty_active') else 'Expired'}</td>"
            "</tr>"
        )
    parts.append("</table></body></html>")
    return "".join(parts)
