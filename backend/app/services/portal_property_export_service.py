"""CSV / print export for portal appliances (Wave 1D)."""

from __future__ import annotations

import csv
import html
import io
import re
from collections import defaultdict
from datetime import date, datetime
from typing import List, Optional, Tuple
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.frontend_site_urls import portal_frontend_origin
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
_BRAND_CYAN = "#22d3ee"
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


def _cell(value: Optional[str]) -> str:
    text = (value or "").strip()
    return html.escape(text) if text else _EM_DASH


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
    """Return (html_text, css_class)."""
    if not data.get("last_service_date"):
        return (_EM_DASH, "warranty-none")

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
        return (f"Active until {label}", "warranty-active")

    return ("Expired", "warranty-expired")


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

    def sort_key(item: Tuple[str, List]) -> str:
        title, subtitle = headers[item[0]]
        return f"{title} {subtitle}".lower()

    ordered_keys = sorted(grouped.keys(), key=sort_key)
    return [(headers[k][0], headers[k][1], grouped[k]) for k in ordered_keys]


def appliances_print_html(db: Session, client: Client, property_id: Optional[UUID] = None) -> str:
    appliances = _filter_appliances(db, client, property_id)
    sections = _build_property_sections(db, appliances)

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

    customer_name = html.escape(client.display_name)
    subtitle_parts = [customer_name]
    if filter_property_line:
        subtitle_parts.append(html.escape(filter_property_line))
    customer_line = " · ".join(subtitle_parts)

    logo_url = html.escape(
        f"{portal_frontend_origin().rstrip('/')}/atomicrepair-brand/atomic-repair-horizontal-flat.png"
    )
    prepared = html.escape(_prepared_label_eastern())
    phone = "(419) 740-0146"

    section_html = []
    for title, address, rows in sections:
        body_rows = []
        for appliance, data in rows:
            model = (data.get("model") or "").strip()
            model_html = _cell(model)
            if model != _EM_DASH and _is_staff_verified(data):
                model_html += ' <span class="verified">✓ Verified</span>'

            warranty_text, warranty_class = _warranty_cell(db, appliance, data)
            body_rows.append(
                "<tr>"
                f"<td>{_cell(_appliance_row_label(data))}</td>"
                f"<td>{_cell(data.get('make'))}</td>"
                f"<td>{model_html}</td>"
                f"<td>{_cell(data.get('serial'))}</td>"
                f"<td>{format_date_mdy_eastern(data.get('last_service_date'))}</td>"
                f'<td class="{warranty_class}">{html.escape(warranty_text)}</td>'
                "</tr>"
            )

        section_html.append(
            f'<section class="property-section">'
            f'<h2 class="property-title">{html.escape(title)}</h2>'
            + (
                f'<p class="property-address">{html.escape(address)}</p>'
                if address
                else ""
            )
            + "<table>"
            "<thead><tr>"
            "<th>Appliance</th><th>Brand</th><th>Model</th><th>Serial</th>"
            "<th>Last service</th><th>Warranty</th>"
            "</tr></thead><tbody>"
            + "".join(body_rows)
            + "</tbody></table></section>"
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Appliance Summary</title>
  <style>
    :root {{
      --cyan: {_BRAND_CYAN};
      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: #fff;
      color: var(--text);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
    }}
    .toolbar {{
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      gap: 10px;
      padding: 12px 16px;
      background: #f9fafb;
      border-bottom: 1px solid var(--border);
    }}
    .toolbar button {{
      font: inherit;
      font-size: 14px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid #d1d5db;
      background: #fff;
      cursor: pointer;
    }}
    .toolbar button.primary {{
      background: var(--cyan);
      border-color: #06b6d4;
      color: #0f172a;
      font-weight: 600;
    }}
    .doc {{
      max-width: 8.5in;
      margin: 0 auto;
      padding: 16px 20px 48px;
    }}
    .accent-bar {{
      height: 3px;
      background: var(--cyan);
      margin-bottom: 16px;
    }}
    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 12px;
    }}
    .header img {{ height: 36px; width: auto; }}
    h1 {{
      margin: 12px 0 4px;
      font-size: 22pt;
      font-weight: 700;
    }}
    .customer-line {{ color: var(--muted); margin: 0 0 8px; }}
    .summary-line {{ margin: 0 0 20px; font-size: 10pt; color: var(--muted); }}
    .header-meta {{
      text-align: right;
      font-size: 10pt;
      color: var(--muted);
      white-space: nowrap;
    }}
    .header-meta strong {{ display: block; color: var(--text); font-weight: 600; }}
    .property-section {{ margin-bottom: 22px; }}
    .property-title {{ margin: 0 0 2px; font-size: 13pt; }}
    .property-address {{ margin: 0 0 8px; color: var(--muted); font-size: 10pt; }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    thead {{ display: table-header-group; }}
    tr {{ break-inside: avoid; page-break-inside: avoid; }}
    th, td {{
      padding: 7px 6px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid var(--border);
      font-size: 10pt;
    }}
    th {{
      font-weight: 600;
      border-bottom: 2px solid var(--cyan);
      color: #374151;
    }}
    .warranty-active {{ color: #15803d; }}
    .warranty-expired {{ color: var(--muted); }}
    .warranty-none {{ color: var(--muted); }}
    .verified {{ font-size: 9pt; color: #0891b2; white-space: nowrap; }}
    @page {{
      size: letter;
      margin: 0.5in;
      @bottom-center {{
        content: "Atomic Repair · {phone} · atomicrepair419.com · Page " counter(page) " of " counter(pages);
        font-size: 9pt;
        color: #6b7280;
      }}
    }}
    @media print {{
      .no-print {{ display: none !important; }}
      .doc {{ padding: 0; max-width: none; }}
    }}
    @media (max-width: 480px) {{
      .header {{ flex-direction: column; }}
      .header-meta {{ text-align: left; white-space: normal; }}
      th, td {{ font-size: 9pt; padding: 6px 4px; }}
    }}
  </style>
</head>
<body>
  <div class="no-print toolbar">
    <button type="button" class="primary" onclick="window.print()">Print / Save as PDF</button>
    <button type="button" onclick="if (window.history.length &gt; 1) {{ window.history.back(); }} else {{ window.close(); }}">Back</button>
  </div>
  <div class="doc">
    <div class="accent-bar"></div>
    <div class="header">
      <div>
        <img src="{logo_url}" alt="Atomic Repair">
        <h1>Appliance Summary</h1>
        <p class="customer-line">{customer_line}</p>
        <p class="summary-line">{appliance_count} appliance{"s" if appliance_count != 1 else ""} across {property_count} propert{"ies" if property_count != 1 else "y"}</p>
      </div>
      <div class="header-meta">
        <strong>{prepared}</strong>
        <span>{phone}</span>
      </div>
    </div>
    {"".join(section_html) if section_html else "<p>No appliances to show.</p>"}
  </div>
</body>
</html>"""
