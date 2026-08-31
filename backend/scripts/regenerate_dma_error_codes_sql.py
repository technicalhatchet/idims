#!/usr/bin/env python
"""Regenerate supabase_dma_error_codes_seed.sql from data/dma_error_codes_seed.json."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "data" / "dma_error_codes_seed.json"
SQL_PATH = ROOT / "database" / "supabase_dma_error_codes_seed.sql"


def sql_literal(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    rows = json.loads(JSON_PATH.read_text(encoding="utf-8"))
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
