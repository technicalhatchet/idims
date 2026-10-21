"""Read-only estimate snapshot for portal approval (same lines/total as PDF)."""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.services.work_order_invoice_pdf_data import build_work_order_invoice_rd
from pdf.work_order_adapter import work_order_to_estimate


def _money(value) -> str:
    return f"{Decimal(str(value or 0)):.2f}"


def _canonical_lines(estimate: Dict[str, Any]) -> List[Dict[str, str]]:
    lines: List[Dict[str, str]] = []
    for svc in estimate.get("services") or []:
        lines.append(
            {
                "kind": "service",
                "name": str(svc.get("name") or ""),
                "qty": str(svc.get("quantity") or 1),
                "unit": _money(svc.get("unit_price")),
                "line_total": _money(svc.get("price")),
            }
        )
    for part in estimate.get("parts") or []:
        lines.append(
            {
                "kind": "part",
                "name": str(part.get("description") or part.get("name") or ""),
                "qty": str(part.get("quantity") or 1),
                "unit": _money(part.get("unit_price") or part.get("price")),
                "line_total": _money(part.get("price") or part.get("extended")),
            }
        )
    return lines


def build_portal_estimate_snapshot(db: Session, work_order) -> Dict[str, Any]:
    rd = build_work_order_invoice_rd(db, work_order)
    estimate = work_order_to_estimate(rd, line_preset="full")
    totals = estimate.get("totals") or {}
    total = float(totals.get("total") or 0)
    lines = _canonical_lines(estimate)
    canonical = {
        "lines": lines,
        "total": _money(total),
        "preset": estimate.get("line_preset") or "full",
    }
    content_hash = hashlib.sha256(
        json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    display_lines = []
    for line in lines:
        display_lines.append(
            {
                "kind": line["kind"],
                "name": line["name"],
                "quantity": float(line["qty"]) if "." not in line["qty"] else line["qty"],
                "unit_price": float(line["unit"]),
                "line_total": float(line["line_total"]),
            }
        )
    return {
        "lines": display_lines,
        "total": total,
        "estimate_content_hash": content_hash,
        "estimate_number": estimate.get("estimate_number"),
    }
