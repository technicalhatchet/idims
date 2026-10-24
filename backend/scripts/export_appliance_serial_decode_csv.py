"""Export serial decode audit CSV for all active appliances."""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.models.client_appliance import ClientAppliance
from app.services.appliance_age_service import first_service_date
from app.services.appliance_serial_decode_service import decode_appliance_serial


def main() -> None:
    out_path = Path(__file__).resolve().parents[2] / "appliance_serial_decode_audit.csv"
    db = SessionLocal()
    try:
        rows = (
            db.query(ClientAppliance)
            .filter(ClientAppliance.is_active.is_(True), ClientAppliance.merged_into_id.is_(None))
            .order_by(ClientAppliance.make, ClientAppliance.model)
            .all()
        )
        with out_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "brand",
                    "model",
                    "serial",
                    "decoded_year",
                    "decoded_month",
                    "rule",
                    "confidence",
                    "first_service_date",
                ]
            )
            for appt in rows:
                fs = first_service_date(db, appt.id)
                decoded = decode_appliance_serial(
                    appt.make,
                    appt.serial,
                    first_service_date=fs,
                )
                writer.writerow(
                    [
                        appt.make or "",
                        appt.model or "",
                        appt.serial or "",
                        decoded.year if decoded else "",
                        decoded.month if decoded else "",
                        decoded.rule if decoded else "",
                        decoded.confidence if decoded else "",
                        fs.isoformat() if fs else "",
                    ]
                )
        print(f"Wrote {len(rows)} rows to {out_path}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
