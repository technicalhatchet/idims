"""One-off: rename cancelled -> canceled in Postgres enums and text columns."""
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
url = os.environ.get("DATABASE_URL")
if not url:
    print("DATABASE_URL not set", file=sys.stderr)
    sys.exit(1)

engine = create_engine(url)


def main() -> None:
    with engine.begin() as conn:
        wo_enum = conn.execute(
            text(
                "SELECT enumlabel FROM pg_enum e "
                "JOIN pg_type t ON e.enumtypid = t.oid "
                "WHERE t.typname = 'work_order_status_enum' "
                "ORDER BY enumsortorder"
            )
        ).fetchall()
        print("work_order_status_enum before:", [r[0] for r in wo_enum])

        if any(r[0] == "cancelled" for r in wo_enum):
            conn.execute(
                text(
                    "ALTER TYPE work_order_status_enum "
                    "RENAME VALUE 'cancelled' TO 'canceled'"
                )
            )
            print("Renamed work_order_status_enum cancelled -> canceled")

        inv_enum = conn.execute(
            text(
                "SELECT enumlabel FROM pg_enum e "
                "JOIN pg_type t ON e.enumtypid = t.oid "
                "WHERE t.typname = 'invoice_status_enum' "
                "ORDER BY enumsortorder"
            )
        ).fetchall()
        print("invoice_status_enum before:", [r[0] for r in inv_enum])

        if any(r[0] == "cancelled" for r in inv_enum):
            conn.execute(
                text(
                    "ALTER TYPE invoice_status_enum "
                    "RENAME VALUE 'cancelled' TO 'canceled'"
                )
            )
            print("Renamed invoice_status_enum cancelled -> canceled")

        hist_prev = conn.execute(
            text(
                "UPDATE work_order_status_history "
                "SET previous_status = 'canceled' "
                "WHERE previous_status = 'cancelled'"
            )
        ).rowcount
        hist_new = conn.execute(
            text(
                "UPDATE work_order_status_history "
                "SET new_status = 'canceled' "
                "WHERE new_status = 'cancelled'"
            )
        ).rowcount
        print(f"work_order_status_history updated: prev={hist_prev}, new={hist_new}")

        quotes = conn.execute(
            text(
                "UPDATE quotes SET status = 'canceled' WHERE status = 'cancelled'"
            )
        ).rowcount
        print(f"quotes updated: {quotes}")

        wo_enum_after = conn.execute(
            text(
                "SELECT enumlabel FROM pg_enum e "
                "JOIN pg_type t ON e.enumtypid = t.oid "
                "WHERE t.typname = 'work_order_status_enum' "
                "ORDER BY enumsortorder"
            )
        ).fetchall()
        print("work_order_status_enum after:", [r[0] for r in wo_enum_after])

        counts = conn.execute(
            text(
                "SELECT status::text, count(*) AS n FROM work_orders "
                "WHERE status::text IN ('cancelled', 'canceled') GROUP BY 1"
            )
        ).fetchall()
        print("work_orders canceled/cancelled counts:", list(counts))


if __name__ == "__main__":
    main()
