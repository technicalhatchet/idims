#!/usr/bin/env python
"""Regenerate supabase_dma_error_codes_seed.sql from data/dma_error_codes_seed.json."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "data" / "dma_error_codes_seed.json"
SQL_PATH = ROOT / "database" / "supabase_dma_error_codes_seed.sql"
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def sql_literal(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def validate_rows(rows: list[dict]) -> None:
    invalid: list[str] = []
    for row in rows:
        alias_group_id = str(row.get("alias_group_id", ""))
        if not UUID_RE.match(alias_group_id):
            invalid.append(
                f"{row.get('manufacturer')} / {row.get('equipment_subtype')} / "
                f"{row.get('code_normalized')}: {alias_group_id}"
            )
    if invalid:
        print("Invalid alias_group_id UUID(s) in dma_error_codes_seed.json:", file=sys.stderr)
        for item in invalid:
            print(f"  - {item}", file=sys.stderr)
        raise SystemExit(1)


def main() -> None:
    rows = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    validate_rows(rows)
    lines = [
        "-- Generated from data/dma_error_codes_seed.json — do not edit by hand",
        "-- Run after supabase_dma_error_codes.sql",
        "",
        "TRUNCATE dma_error_code_references;",
        "",
    ]
    for row in rows:
        lines.append(
            "INSERT INTO dma_error_code_references "
            "(manufacturer, equipment_subtype, code, code_normalized, meaning, common_causes, recommended_fix, alias_group_id) VALUES ("
            f"{sql_literal(row['manufacturer'])}, "
            f"{sql_literal(row['equipment_subtype'])}, "
            f"{sql_literal(row['code'])}, "
            f"{sql_literal(row['code_normalized'])}, "
            f"{sql_literal(row['meaning'])}, "
            f"{sql_literal(row.get('common_causes', ''))}, "
            f"{sql_literal(row.get('recommended_fix', ''))}, "
            f"{sql_literal(row['alias_group_id'])}::uuid);"
        )
    SQL_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} rows to {SQL_PATH.name}")


if __name__ == "__main__":
    main()
