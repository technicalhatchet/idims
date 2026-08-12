"""Map work-order API payloads to cyberpunk estimate/invoice template dicts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pdf.document_presets import (
    apply_line_preset_to_rd,
    diagnostic_discount_applies,
    normalize_line_preset,
)

BILLABLE_PART_STATUSES = ("phone_payment", "paid_not_installed", "upfront_50", "installed")
NON_TAXABLE_PART_STATUSES = frozenset({"not_installed"})


def format_sales_tax_label(tax_rate: float) -> str:
    pct = tax_rate * 100
    pct_text = f"{pct:.2f}".rstrip("0").rstrip(".")
    return f"Sales Tax ({pct_text}% on parts only)"


def _taxable_parts(parts: List[dict]) -> List[dict]:
    return [
        p
        for p in (parts or [])
        if str(p.get("status") or "").lower() not in NON_TAXABLE_PART_STATUSES
    ]

COMPANY = {
    "name": "Atomic Repair",
    "address1": "641 Barclay Drive",
    "address2": "Toledo, OH 43609",
    "phone": "(419) 555-0100",
    "email": "service@atomicrepair.com",
}

PART_STATUS_LABELS = {
    "needed": "Estimated",
    "ordered": "Ordered",
    "received": "Received",
    "phone_payment": "Paid",
    "paid_not_installed": "Pending",
    "upfront_50": "Pending",
    "installed": "Installed",
    "not_installed": "Not installed",
}

SERVICE_STATUS_LABELS = {
    "billable": "Pending",
    "paid": "Paid",
    "waived": "Waived",
    "not_billable": "Estimated",
}


def _format_date(value: Optional[str] = None) -> str:
    if value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%B %d, %Y")
        except (TypeError, ValueError):
            pass
    return datetime.utcnow().strftime("%B %d, %Y")


def _customer(rd: dict) -> dict:
    client = rd.get("client_user") or {}
    name = (
        rd.get("client_name")
        or f"{client.get('first_name', '')} {client.get('last_name', '')}".strip()
        or "—"
    )
    loc = rd.get("service_location") or {}
    line1 = (loc.get("address") or "").strip()
    city_bits = [loc.get("city"), loc.get("state"), loc.get("zip")]
    line2 = ", ".join(str(p).strip() for p in city_bits if p)
    if not line1 and not line2:
        full = (loc.get("formatted") or "").strip()
        if full:
            parts = [p.strip() for p in full.split(",") if p.strip()]
            if len(parts) >= 2:
                line1, line2 = parts[0], ", ".join(parts[1:])
            else:
                line1 = full

    return {
        "name": name,
        "email": client.get("email") or "",
        "phone": client.get("phone") or "",
        "address_line1": line1,
        "address_line2": line2,
    }


def _equipment(rd: dict) -> dict:
    raw_type = (rd.get("equipment_type") or "").replace("_", " ").strip()
    subtype = (rd.get("equipment_subtype") or "").replace("_", " ").title()
    if raw_type.lower() in ("tv", "television"):
        category = "TV"
    elif raw_type:
        category = "Appliance"
    else:
        category = ""

    return {
        "category": category,
        "subtype": subtype or "—",
        "make": rd.get("equipment_make") or "—",
        "model": rd.get("equipment_model") or "—",
        "serial": rd.get("equipment_serial") or "—",
    }


def _service_status_label(status: Optional[str]) -> str:
    key = (status or "not_billable").lower()
    return SERVICE_STATUS_LABELS.get(key, key.replace("_", " ").title())


def _part_status_label(status: Optional[str]) -> str:
    key = status or ""
    return PART_STATUS_LABELS.get(key, key.replace("_", " ").title() or "Pending")


def _map_services(services: List[dict]) -> List[dict]:
    rows = []
    for svc in services or []:
        qty = svc.get("quantity") or svc.get("qty") or 1
        unit = float(svc.get("unit_price") or 0)
        total = float(svc.get("price") or svc.get("total") or unit * float(qty))
        rows.append(
            {
                "name": svc.get("name") or "—",
                "qty": qty,
                "unit_price": unit,
                "total": total,
                "billing_status": _service_status_label(svc.get("billing_status")),
            }
        )
    return rows


def _map_parts(parts: List[dict], *, billable_only: bool) -> List[dict]:
    rows = []
    for part in parts or []:
        status = part.get("status")
        if billable_only and status not in BILLABLE_PART_STATUSES:
            continue
        rows.append(
            {
                "part_number": part.get("number") or part.get("part_number") or "—",
                "description": _part_description_with_warranty(part),
                "price": float(part.get("price") or 0),
                "status": _part_status_label(status),
            }
        )
    return rows


def _part_description_with_warranty(part: dict) -> str:
    desc = part.get("description") or "—"
    if part.get("part_source") == "oem":
        return f"{desc} (OEM — 1 yr parts warranty)"
    return desc


def _billing_status_key(status: Optional[str]) -> str:
    return str(status or "").strip().lower()


def compute_totals(rd: dict, *, is_estimate: bool = False) -> dict:
    services = rd.get("services") or []
    parts = rd.get("parts") or []
    tax_rate = float(rd.get("tax_rate") or 0.0775)

    if is_estimate:
        services_for_subtotal = [
            s for s in services if _billing_status_key(s.get("billing_status")) != "waived"
        ]
    else:
        services_for_subtotal = services

    service_subtotal = round(sum(float(s.get("price") or 0) for s in services_for_subtotal), 2)
    parts_subtotal = round(sum(float(p.get("price") or 0) for p in parts), 2)
    taxable_parts = _taxable_parts(parts)
    tax = round(
        sum(float(p.get("price") or 0) for p in taxable_parts) * tax_rate,
        2,
    )
    subtotal = round(service_subtotal + parts_subtotal, 2)
    gross_total = round(subtotal + tax, 2)

    apply_discount = diagnostic_discount_applies(rd, services, for_estimate=is_estimate)
    diag_discount = float(rd.get("diagnostic_discount_amount") or 0)
    discount = round(diag_discount, 2) if apply_discount else 0.0
    if is_estimate:
        total = round(gross_total - discount, 2) if discount else gross_total
    else:
        total = round(gross_total - discount, 2) if discount else gross_total

    amount_paid = float(rd.get("amount_previously_paid") or 0)
    balance_due = max(0.0, round(total - amount_paid, 2))

    result = {
        "service_subtotal": service_subtotal,
        "parts_subtotal": parts_subtotal,
        "subtotal": subtotal,
        "tax": tax,
        "tax_rate": tax_rate,
        "tax_label": format_sales_tax_label(tax_rate),
        "gross_total": gross_total,
        "discount": discount,
        "total": total,
        "amount_paid": amount_paid,
    }
    if not is_estimate:
        result["balance_due"] = balance_due
    return result


def _technician(rd: dict) -> dict:
    tech = rd.get("technician")
    if isinstance(tech, dict):
        return {
            "name": tech.get("name") or rd.get("technician_name") or "—",
            "phone": tech.get("phone") or "",
            "email": tech.get("email") or "",
        }
    if tech is not None and hasattr(tech, "name"):
        return {
            "name": tech.name or rd.get("technician_name") or "—",
            "phone": getattr(tech, "phone", None) or "",
            "email": getattr(tech, "email", None) or "",
        }
    return {
        "name": rd.get("technician_name") or "—",
        "phone": rd.get("technician_phone") or "",
        "email": rd.get("technician_email") or "",
    }


def _service_meta(rd: dict) -> dict:
    appointments = rd.get("appointments") or []
    completed = [a for a in appointments if a.get("status") == "completed"]
    service_dates = ", ".join(
        _format_date(a.get("scheduled_start"))
        for a in completed
        if a.get("scheduled_start")
    )
    return {
        "technician": rd.get("technician_name") or "Atomic Repair Technician",
        "service_date": service_dates or _format_date(),
        "work_order": rd.get("order_number") or "—",
    }


def work_order_to_estimate(rd: dict, *, line_preset: str = "full") -> dict:
    preset = normalize_line_preset(line_preset, doc_type="estimate")
    filtered_rd = apply_line_preset_to_rd(
        rd,
        preset,
        billable_part_statuses=frozenset(BILLABLE_PART_STATUSES),
        for_estimate=True,
    )
    order_number = filtered_rd.get("order_number") or "—"
    return {
        "estimate_number": order_number,
        "date": _format_date(),
        "company": dict(COMPANY),
        "customer": _customer(filtered_rd),
        "technician": _technician(filtered_rd),
        "equipment": _equipment(filtered_rd),
        "services": _map_services(filtered_rd.get("services") or []),
        "parts": _map_parts(filtered_rd.get("parts") or [], billable_only=False),
        "totals": compute_totals(filtered_rd, is_estimate=True),
        "line_preset": preset,
    }


def work_order_to_invoice(
    rd: dict,
    notes: Optional[List[str]] = None,
    *,
    line_preset: str = "full",
) -> dict:
    preset = normalize_line_preset(line_preset, doc_type="invoice")
    filtered_rd = apply_line_preset_to_rd(rd, preset, billable_part_statuses=frozenset(BILLABLE_PART_STATUSES))
    order_number = filtered_rd.get("order_number") or "—"
    return {
        "invoice_number": order_number,
        "date": _format_date(),
        "company": dict(COMPANY),
        "customer": _customer(filtered_rd),
        "technician": _technician(filtered_rd),
        "equipment": _equipment(filtered_rd),
        "service_meta": _service_meta(filtered_rd),
        "services": _map_services(filtered_rd.get("services") or []),
        "parts": _map_parts(filtered_rd.get("parts") or [], billable_only=False),
        "notes": list(notes or []),
        "terms": None,
        "payment_instructions": f"Pay online or call {COMPANY['phone']}.",
        "totals": compute_totals(filtered_rd, is_estimate=False),
        "line_preset": preset,
    }
