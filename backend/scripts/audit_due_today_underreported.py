"""
Read-only audit: work orders where the pre-fix due-today calc showed $0 but the
corrected compute_balance_due shows a balance still owed.

Usage (from repo root, with DATABASE_URL set):
  cd backend
  ..\\venv\\Scripts\\python.exe scripts/audit_due_today_underreported.py

Optional:
  --csv path/to/report.csv
  --limit N
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from decimal import Decimal

from sqlalchemy.orm import selectinload

# Allow `python scripts/...` from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
import app.models  # noqa: F401 — register SQLAlchemy mappers
from app.models.client import Client
from app.models.client_appliance import ClientAppliance  # noqa: F401
from app.models.client_login import ClientLogin  # noqa: F401
from app.models.work_order import WorkOrder, WorkOrderAppointment, WorkOrderService
from app.services.work_order_billing_helpers import (
    compute_balance_due,
    compute_balance_due_legacy_billable_services_only,
)

TERMINAL_WO_STATUSES = frozenset({
    "completed",
    "completed_pending_payment",
    "closed",
    "refunded",
})


def _client_label(client: Client | None) -> str:
    if not client:
        return ""
    if client.company_name:
        return client.company_name.strip()
    parts = [client.first_name or "", client.last_name or ""]
    return " ".join(p.strip() for p in parts if p and p.strip())


def _is_terminal_wo(wo: WorkOrder) -> bool:
    status = str(wo.status or "").lower()
    if status in TERMINAL_WO_STATUSES:
        return True
    if getattr(wo, "is_closed", False):
        return True
    return False


def run(limit: int | None = None) -> list[dict]:
    db = SessionLocal()
    try:
        query = (
            db.query(WorkOrder)
            .options(
                selectinload(WorkOrder.client),
                selectinload(WorkOrder.service_items).selectinload(WorkOrderService.service),
                selectinload(WorkOrder.parts),
                selectinload(WorkOrder.appointments).selectinload(WorkOrderAppointment.services),
            )
            .order_by(WorkOrder.order_number)
        )
        if limit:
            query = query.limit(limit)

        rows: list[dict] = []
        for wo in query.all():
            legacy = compute_balance_due_legacy_billable_services_only(wo)
            current = compute_balance_due(wo)
            if legacy > Decimal("0.01"):
                continue
            if current <= Decimal("0.01"):
                continue

            rows.append(
                {
                    "order_number": wo.order_number,
                    "client": _client_label(wo.client),
                    "status": str(wo.status or ""),
                    "is_closed": bool(getattr(wo, "is_closed", False)),
                    "terminal_status": _is_terminal_wo(wo),
                    "legacy_due": float(legacy),
                    "balance_due": float(current),
                    "amount_previously_paid": float(wo.amount_previously_paid or 0),
                    "work_order_id": str(wo.id),
                }
            )
        return rows
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", help="Write CSV to this path (default: stdout)")
    parser.add_argument("--limit", type=int, default=None, help="Max work orders to scan")
    args = parser.parse_args()

    findings = run(limit=args.limit)
    fieldnames = [
        "order_number",
        "client",
        "status",
        "is_closed",
        "terminal_status",
        "legacy_due",
        "balance_due",
        "amount_previously_paid",
        "work_order_id",
    ]

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(findings)
        print(f"Wrote {len(findings)} row(s) to {args.csv}")
    else:
        writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(findings)
        if not findings:
            print("# No matching work orders.", file=sys.stderr)


if __name__ == "__main__":
    main()
