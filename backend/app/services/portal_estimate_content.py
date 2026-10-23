"""Read-only estimate snapshot for portal approval (same lines/total as PDF)."""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.services.work_order_invoice_pdf_data import build_work_order_invoice_rd
from pdf.document_presets import apply_line_preset_to_rd
from pdf.work_order_adapter import BILLABLE_PART_STATUSES, work_order_to_estimate


def _money(value) -> str:
    return f"{Decimal(str(value or 0)):.2f}"


def _line_total_from_mapped(kind: str, row: Dict[str, Any]) -> str:
    if kind == "service":
        total = row.get("total")
        if total is None:
            total = row.get("price")
        if total is None:
            qty = float(row.get("qty") or row.get("quantity") or 1)
            unit = float(row.get("unit_price") or 0)
            total = qty * unit
        return _money(total)
    price = row.get("price") or row.get("extended")
    return _money(price)


def _service_line_total_raw(svc: Dict[str, Any]) -> str:
    price = svc.get("price")
    if price is not None:
        return _money(price)
    qty = float(svc.get("quantity") or svc.get("qty") or 1)
    unit = float(svc.get("unit_price") or 0)
    return _money(qty * unit)


def _canonical_lines_from_rd(rd: Dict[str, Any]) -> List[Dict[str, str]]:
    lines: List[Dict[str, str]] = []
    for svc in rd.get("services") or []:
        sku = svc.get("sku_code") or svc.get("service_id") or ""
        lines.append(
            {
                "kind": "service",
                "sku_id": str(sku),
                "description": str(svc.get("name") or ""),
                "qty": str(svc.get("quantity") or svc.get("qty") or 1),
                "unit_price": _money(svc.get("unit_price")),
                "line_total": _service_line_total_raw(svc),
            }
        )
    for part in rd.get("parts") or []:
        sku = part.get("part_number") or part.get("number") or part.get("id") or ""
        lines.append(
            {
                "kind": "part",
                "sku_id": str(sku),
                "description": str(part.get("description") or part.get("name") or ""),
                "qty": str(part.get("quantity") or 1),
                "unit_price": _money(part.get("unit_price") or part.get("price")),
                "line_total": _money(part.get("price") or part.get("extended")),
            }
        )
    return lines


def _canonical_lines(estimate: Dict[str, Any]) -> List[Dict[str, str]]:
    """Display lines from PDF-mapped estimate rows (totals use ``total`` field)."""
    lines: List[Dict[str, str]] = []
    for svc in estimate.get("services") or []:
        sku = svc.get("sku_code") or svc.get("service_id") or ""
        lines.append(
            {
                "kind": "service",
                "sku_id": str(sku),
                "description": str(svc.get("name") or ""),
                "qty": str(svc.get("qty") or svc.get("quantity") or 1),
                "unit_price": _money(svc.get("unit_price")),
                "line_total": _line_total_from_mapped("service", svc),
            }
        )
    for part in estimate.get("parts") or []:
        sku = part.get("part_number") or part.get("number") or part.get("id") or ""
        lines.append(
            {
                "kind": "part",
                "sku_id": str(sku),
                "description": str(part.get("description") or part.get("name") or ""),
                "qty": str(part.get("quantity") or 1),
                "unit_price": _money(part.get("unit_price") or part.get("price")),
                "line_total": _line_total_from_mapped("part", part),
            }
        )
    return lines


def build_canonical_estimate_payload(
    estimate: Dict[str, Any],
    *,
    legacy: bool = False,
) -> Dict[str, Any]:
    totals = estimate.get("totals") or {}
    total = float(totals.get("total") or 0)
    lines = _canonical_lines(estimate)
    canonical: Dict[str, Any] = {
        "lines": lines,
        "total": _money(total),
    }
    if legacy:
        canonical["preset"] = estimate.get("line_preset") or "full"
    return canonical


def hash_estimate_content(canonical: Dict[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def estimate_approval_content_changed(stored_hash: str, snapshot: Dict[str, Any]) -> bool:
    """True when customer-visible estimate content differs from the approved hash."""
    if not stored_hash:
        return False
    if stored_hash == snapshot.get("estimate_content_hash"):
        return False
    legacy_hash = snapshot.get("estimate_content_hash_legacy")
    if legacy_hash and stored_hash == legacy_hash:
        return False
    return True


def build_portal_estimate_snapshot(db: Session, work_order) -> Dict[str, Any]:
    rd = build_work_order_invoice_rd(db, work_order)
    estimate = work_order_to_estimate(rd, line_preset="full")
    totals = estimate.get("totals") or {}
    total = float(totals.get("total") or 0)
    filtered_rd = apply_line_preset_to_rd(
        rd,
        "full",
        billable_part_statuses=frozenset(BILLABLE_PART_STATUSES),
        for_estimate=True,
    )
    hash_lines = _canonical_lines_from_rd(filtered_rd)
    lines = _canonical_lines(estimate)
    canonical = {"lines": hash_lines, "total": _money(total)}
    legacy_canonical = {**canonical, "preset": estimate.get("line_preset") or "full"}
    content_hash = hash_estimate_content(canonical)
    legacy_content_hash = hash_estimate_content(legacy_canonical)
    display_lines = []
    for line in lines:
        display_lines.append(
            {
                "kind": line["kind"],
                "name": line["description"],
                "quantity": float(line["qty"]) if "." not in line["qty"] else line["qty"],
                "unit_price": float(line["unit_price"]),
                "line_total": float(line["line_total"]),
            }
        )
    return {
        "lines": display_lines,
        "total": total,
        "estimate_content_hash": content_hash,
        "estimate_content_hash_legacy": legacy_content_hash,
        "estimate_number": estimate.get("estimate_number"),
    }
