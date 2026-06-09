"""
Backfill legacy work orders for SKU-first appointment flow.

1. canceled spelling on enums / text (work orders, invoices, appointments if present)
2. appointment_services_association from work_order_service.appointment_id
3. Infer missing links: WOS lines <-> visits by appointment_id, then service_type ~ appointment_type

Usage (from backend/):
  python scripts/backfill_legacy_appointment_skus.py          # dry-run
  python scripts/backfill_legacy_appointment_skus.py --execute
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

APPOINTMENT_TYPE_TO_SERVICE_TYPES: dict[str, set[str]] = {
    "diagnostic": {"diagnostic"},
    "repair": {"repair", "installation", "additional_time"},
    "follow-up": {"repair", "installation", "additional_time"},
    "inspection": {"diagnostic", "repair"},
    "maintenance": {"repair", "installation"},
}


def _normalize_type(value: str | None) -> str:
    return (value or "").strip().lower()


def fix_canceled_spelling(conn, *, execute: bool) -> None:
    print("\n=== canceled spelling ===")

    for enum_name in ("work_order_status_enum", "invoice_status_enum", "appointment_status_enum"):
        rows = conn.execute(
            text(
                "SELECT enumlabel FROM pg_enum e "
                "JOIN pg_type t ON e.enumtypid = t.oid "
                f"WHERE t.typname = :name ORDER BY enumsortorder"
            ),
            {"name": enum_name},
        ).fetchall()
        labels = [r[0] for r in rows]
        print(f"{enum_name}: {labels}")
        if "cancelled" in labels and execute:
            conn.execute(
                text(f"ALTER TYPE {enum_name} RENAME VALUE 'cancelled' TO 'canceled'")
            )
            print(f"  renamed cancelled -> canceled on {enum_name}")

    text_updates = [
        (
            "work_order_status_history",
            "UPDATE work_order_status_history SET previous_status = 'canceled' "
            "WHERE previous_status = 'cancelled'",
        ),
        (
            "work_order_status_history new",
            "UPDATE work_order_status_history SET new_status = 'canceled' "
            "WHERE new_status = 'cancelled'",
        ),
        ("quotes", "UPDATE quotes SET status = 'canceled' WHERE status = 'cancelled'"),
    ]
    for label, sql in text_updates:
        if execute:
            n = conn.execute(text(sql)).rowcount
            print(f"  {label}: {n} rows")
        else:
            count_sql = sql.replace("UPDATE ", "SELECT count(*) FROM ").split(" WHERE")[0]
            if "work_order_status_history" in sql:
                col = "previous_status" if "previous_status" in sql else "new_status"
                count_sql = (
                    "SELECT count(*) FROM work_order_status_history "
                    f"WHERE {col} = 'cancelled'"
                )
            print(f"  {label}: would update (dry-run)")


def load_assoc_pairs(conn) -> set[tuple[str, str]]:
    rows = conn.execute(
        text(
            "SELECT appointment_id::text, service_id::text "
            "FROM appointment_services_association"
        )
    ).fetchall()
    return {(r[0], r[1]) for r in rows}


def backfill_sku_links(conn, *, execute: bool) -> None:
    print("\n=== SKU / visit links ===")

    assoc = load_assoc_pairs(conn)
    inserts: list[tuple[str, str]] = []
    wos_updates: list[tuple[str, str]] = []

    # Pass 1: M2M from work_order_service.appointment_id
    wos_rows = conn.execute(
        text(
            """
            SELECT wos.id::text, wos.work_order_id::text, wos.appointment_id::text,
                   wos.service_id::text
            FROM work_order_service wos
            WHERE wos.appointment_id IS NOT NULL
            """
        )
    ).fetchall()

    for wos_id, _wo_id, appt_id, service_id in wos_rows:
        key = (appt_id, service_id)
        if key not in assoc:
            inserts.append(key)
            assoc.add(key)

    print(f"Pass 1 — M2M from work_order_service.appointment_id: {len(inserts)} new links")

    # Pass 2: set appointment_id on orphan WOS from type matching
    orphan_wos = conn.execute(
        text(
            """
            SELECT wos.id::text, wos.work_order_id::text, wos.service_id::text,
                   COALESCE(s.service_type::text, '') AS service_type,
                   wos.name
            FROM work_order_service wos
            JOIN services s ON s.id = wos.service_id
            WHERE wos.appointment_id IS NULL
            """
        )
    ).fetchall()

    appointments = conn.execute(
        text(
            """
            SELECT id::text, work_order_id::text, appointment_type, scheduled_start
            FROM work_order_appointments
            ORDER BY work_order_id, scheduled_start
            """
        )
    ).fetchall()

    appts_by_wo: dict[str, list[tuple]] = defaultdict(list)
    for row in appointments:
        appts_by_wo[row[1]].append(row)

    pass2_inserts = 0
    pass2_appt_ids = 0

    for wos_id, wo_id, service_id, service_type, _name in orphan_wos:
        st = _normalize_type(service_type)
        appts = appts_by_wo.get(wo_id, [])
        if not appts:
            continue

        target_appt_id = None
        for appt_id, _wo, appt_type, _start in appts:
            allowed = APPOINTMENT_TYPE_TO_SERVICE_TYPES.get(
                _normalize_type(appt_type), {_normalize_type(appt_type)}
            )
            if st in allowed or (st and _normalize_type(appt_type) == st):
                key = (appt_id, service_id)
                if key not in assoc:
                    target_appt_id = appt_id
                    break

        if not target_appt_id and len(appts) == 1:
            target_appt_id = appts[0][0]
            key = (target_appt_id, service_id)
            if key in assoc:
                target_appt_id = None

        if not target_appt_id:
            continue

        key = (target_appt_id, service_id)
        if key not in assoc:
            inserts.append(key)
            assoc.add(key)
            pass2_inserts += 1

        wos_updates.append((target_appt_id, wos_id))
        pass2_appt_ids += 1

    print(f"Pass 2 — inferred M2M links: {pass2_inserts}")
    print(f"Pass 2 — work_order_service.appointment_id to set: {pass2_appt_ids}")

    # Pass 3: visits with zero SKUs — attach WO lines already pointing at this visit
    appt_service_counts = conn.execute(
        text(
            """
            SELECT a.id::text, count(asa.service_id) AS n
            FROM work_order_appointments a
            LEFT JOIN appointment_services_association asa ON asa.appointment_id = a.id
            GROUP BY a.id
            HAVING count(asa.service_id) = 0
            """
        )
    ).fetchall()
    bare_appt_ids = {r[0] for r in appt_service_counts}
    print(f"Visits with no M2M SKUs before apply: {len(bare_appt_ids)}")

    if execute:
        for appt_id, service_id in inserts:
            conn.execute(
                text(
                    """
                    INSERT INTO appointment_services_association (appointment_id, service_id)
                    VALUES (CAST(:appt_id AS uuid), CAST(:service_id AS uuid))
                    ON CONFLICT DO NOTHING
                    """
                ),
                {"appt_id": appt_id, "service_id": service_id},
            )
        print(f"Inserted {len(inserts)} association rows")

        for appt_id, wos_id in wos_updates:
            conn.execute(
                text(
                    """
                    UPDATE work_order_service
                    SET appointment_id = CAST(:appt_id AS uuid)
                    WHERE id = CAST(:wos_id AS uuid) AND appointment_id IS NULL
                    """
                ),
                {"appt_id": appt_id, "wos_id": wos_id},
            )
        print(f"Updated {len(wos_updates)} work_order_service.appointment_id values")
    else:
        print(f"Would insert {len(inserts)} association rows (dry-run)")
        print(f"Would update {len(wos_updates)} work_order_service rows (dry-run)")

    if execute:
        remaining = conn.execute(
            text(
                """
                SELECT count(*) FROM work_order_appointments a
                LEFT JOIN appointment_services_association asa ON asa.appointment_id = a.id
                GROUP BY a.id
                HAVING count(asa.service_id) = 0
                """
            )
        ).fetchall()
        print(f"Visits still with no M2M SKUs after apply: {len(remaining)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill legacy appointment SKU links")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Apply changes (default is dry-run)",
    )
    args = parser.parse_args()

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    execute = args.execute
    print("Mode:", "EXECUTE" if execute else "DRY-RUN")

    engine = create_engine(url)
    with engine.begin() as conn:
        fix_canceled_spelling(conn, execute=execute)
        backfill_sku_links(conn, execute=execute)

    print("\nDone.")


if __name__ == "__main__":
    main()
