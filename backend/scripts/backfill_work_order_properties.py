"""
Link work orders missing property_id to find-or-created client properties.

Default is dry-run (no writes). Pass --apply to commit.

Usage (from backend/):
  python scripts/backfill_work_order_properties.py
  python scripts/backfill_work_order_properties.py --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Ensure backend package imports work when run as a script
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

load_dotenv()

from app.models.client import Client  # noqa: E402
from app.models.property import Property  # noqa: E402
from app.models.work_order import WorkOrder  # noqa: E402
from app.services.portal_property_service import (  # noqa: E402
    find_duplicate_property,
    normalized_address_key,
)
from app.services.work_order_property_service import (  # noqa: E402
    ensure_client_property_for_service_address,
    extract_service_address_parts,
)


def _service_location_nonempty(sl: Any) -> bool:
    street, _unit = extract_service_address_parts(sl)
    return bool(street)


def plan_client_backfill(
    db: Session,
    client: Client,
    work_orders: List[WorkOrder],
) -> Dict[str, Any]:
    """
    Build a dry-run plan for one client.

    Returns:
      {
        client_id, client_label,
        existing: [{id, address, unit}],
        would_create: [{address, unit, order_numbers}],
        would_link: [{property_id|None, address, unit, order_numbers, create: bool}],
      }
    """
    existing_props = (
        db.query(Property)
        .filter(Property.client_id == client.id)
        .order_by(Property.created_at.asc())
        .all()
    )
    existing_rows = [
        {
            "id": str(p.id),
            "address": p.address,
            "unit": p.unit_number,
        }
        for p in existing_props
    ]

    # Group WOs by normalized address key
    groups: Dict[Tuple[str, str], List[WorkOrder]] = defaultdict(list)
    for wo in work_orders:
        street, unit = extract_service_address_parts(wo.service_location)
        if not street:
            continue
        groups[normalized_address_key(street, unit)].append(wo)

    would_create: List[Dict[str, Any]] = []
    would_link: List[Dict[str, Any]] = []

    for (_addr_key, unit_key), wos in sorted(
        groups.items(),
        key=lambda item: (item[0][0], item[0][1]),
    ):
        sample = wos[0]
        street, unit = extract_service_address_parts(sample.service_location)
        order_numbers = [wo.order_number for wo in wos]
        match = find_duplicate_property(db, client.id, street, unit)
        if match:
            would_link.append(
                {
                    "property_id": str(match.id),
                    "address": match.address,
                    "unit": match.unit_number,
                    "order_numbers": order_numbers,
                    "create": False,
                }
            )
        else:
            would_create.append(
                {
                    "address": street,
                    "unit": unit,
                    "order_numbers": order_numbers,
                }
            )
            would_link.append(
                {
                    "property_id": None,
                    "address": street,
                    "unit": unit,
                    "order_numbers": order_numbers,
                    "create": True,
                }
            )

    label = f"{(client.first_name or '').strip()} {(client.last_name or '').strip()}".strip()
    if not label:
        label = client.email or str(client.id)

    return {
        "client_id": str(client.id),
        "client_label": label,
        "existing": existing_rows,
        "would_create": would_create,
        "would_link": would_link,
    }


def apply_client_backfill(
    db: Session,
    client: Client,
    work_orders: List[WorkOrder],
) -> Tuple[int, int]:
    """Find-or-create properties and link WOs. Returns (created_count, linked_count)."""
    created = 0
    linked = 0
    for wo in work_orders:
        if wo.property_id or not _service_location_nonempty(wo.service_location):
            continue
        before_ids = {
            p.id
            for p in db.query(Property).filter(Property.client_id == client.id).all()
        }
        prop = ensure_client_property_for_service_address(
            db, client.id, wo.service_location
        )
        if not prop:
            continue
        if prop.id not in before_ids:
            created += 1
            before_ids.add(prop.id)
        wo.property_id = prop.id
        linked += 1
    return created, linked


def run(*, apply: bool) -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1

    engine = create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine)
    db: Session = SessionLocal()

    try:
        rows = (
            db.query(WorkOrder, Client)
            .join(Client, Client.id == WorkOrder.client_id)
            .filter(WorkOrder.property_id.is_(None))
            .filter(Client.merged_into_client_id.is_(None))
            .order_by(Client.id, WorkOrder.created_at.asc())
            .all()
        )

        by_client: Dict[UUID, Dict[str, Any]] = {}
        for wo, client in rows:
            if not _service_location_nonempty(wo.service_location):
                continue
            bucket = by_client.setdefault(
                client.id, {"client": client, "work_orders": []}
            )
            bucket["work_orders"].append(wo)

        if not by_client:
            print("No work orders with null property_id and a service address.")
            return 0

        mode = "APPLY" if apply else "DRY-RUN"
        print(f"=== backfill_work_order_properties ({mode}) ===")
        print(f"Clients to process: {len(by_client)}")

        total_create = 0
        total_link = 0

        for client_id, bucket in by_client.items():
            client: Client = bucket["client"]
            wos: List[WorkOrder] = bucket["work_orders"]
            plan = plan_client_backfill(db, client, wos)

            print(f"\nClient: {plan['client_label']} ({plan['client_id']})")
            print(f"  Existing properties ({len(plan['existing'])}):")
            if not plan["existing"]:
                print("    (none)")
            for p in plan["existing"]:
                unit = f" / unit {p['unit']}" if p["unit"] else ""
                print(f"    - {p['id']}: {p['address']}{unit}")

            print(f"  Would create ({len(plan['would_create'])}):")
            if not plan["would_create"]:
                print("    (none)")
            for c in plan["would_create"]:
                unit = f" / unit {c['unit']}" if c["unit"] else ""
                print(
                    f"    - {c['address']}{unit} "
                    f"← WOs {', '.join(c['order_numbers'])}"
                )

            print("  Would link:")
            for link in plan["would_link"]:
                action = "CREATE+LINK" if link["create"] else "LINK existing"
                pid = link["property_id"] or "(new)"
                unit = f" / unit {link['unit']}" if link["unit"] else ""
                print(
                    f"    - [{action}] {pid}: {link['address']}{unit} "
                    f"← {', '.join(link['order_numbers'])}"
                )

            total_create += len(plan["would_create"])
            total_link += sum(len(link["order_numbers"]) for link in plan["would_link"])

            if apply:
                created, linked = apply_client_backfill(db, client, wos)
                print(f"  Applied: created={created} linked={linked}")

        print(
            f"\nSummary: would_create_properties={total_create} "
            f"would_link_work_orders={total_link}"
        )

        if apply:
            db.commit()
            print("Committed.")
        else:
            db.rollback()
            print("Dry-run only — no changes written.")

        return 0
    except Exception as exc:
        db.rollback()
        print(f"Error: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill work_order.property_id from service addresses"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes (default is dry-run)",
    )
    args = parser.parse_args()
    raise SystemExit(run(apply=args.apply))


if __name__ == "__main__":
    main()
