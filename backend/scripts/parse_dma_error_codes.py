#!/usr/bin/env python
"""
Parse errorcoderef/*.docx and emit structured seed data for dma_error_code_references.

Usage (from backend/):
  python scripts/parse_dma_error_codes.py

Outputs:
  data/dma_error_codes_seed.json
  database/supabase_dma_error_codes_seed.sql
"""

from __future__ import annotations

import json
import re
import uuid
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
ROOT = Path(__file__).resolve().parents[2]
DOC_DIR = ROOT / "errorcoderef"
OUT_JSON = Path(__file__).resolve().parents[1] / "data" / "dma_error_codes_seed.json"
OUT_SQL = Path(__file__).resolve().parents[1] / "database" / "supabase_dma_error_codes_seed.sql"

APPLIANCE_MAP = {
    "Washer": "washing_machine",
    "Top-Load Washer Specific": "washing_machine",
    "Dryer": "dryer",
    "Refrigerator": "refrigerator",
    "Dishwasher": "dishwasher",
    "Oven / Range": "oven",
    "Microwave": "microwave",
}

FIX_VERBS = (
    "Check",
    "Inspect",
    "Test",
    "Replace",
    "Clean",
    "Disable",
    "Run",
    "Verify",
    "Thaw",
    "Redistribute",
    "Defrost",
    "Empty",
    "Open",
    "Unplug",
    "Restart",
    "Reset",
    "Power reset",
    "Flush",
    "Dry",
    "Descale",
)


@dataclass
class ParsedCode:
    manufacturer: str
    equipment_subtype: str
    code: str
    meaning: str
    common_causes: str
    recommended_fix: str
    alias_codes: list[str] = field(default_factory=list)


def normalize_code(code: str) -> str:
    return re.sub(r"\s+", "", code.strip()).upper()


def split_code_cell(raw: str) -> list[str]:
    parts = re.split(r"\s*/\s*", raw.strip())
    return [p.strip() for p in parts if p.strip()]


def docx_blocks(path: Path) -> list[tuple[str, object]]:
    with zipfile.ZipFile(path) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
    body = root.find(W + "body")
    blocks: list[tuple[str, object]] = []
    for child in body:
        if child.tag == W + "p":
            texts = [t.text for t in child.iter(W + "t") if t.text]
            if texts:
                blocks.append(("p", "".join(texts)))
        elif child.tag == W + "tbl":
            rows = []
            for tr in child.iter(W + "tr"):
                cells = []
                for tc in tr.iter(W + "tc"):
                    texts = [t.text for t in tc.iter(W + "t") if t.text]
                    cells.append(" ".join(texts).strip())
                if any(cells):
                    rows.append(cells)
            if rows:
                blocks.append(("t", rows))
    return blocks


def parse_appliance_section(text: str, brand: str) -> str | None:
    patterns = [
        rf"^{re.escape(brand)}\s+(.+?)\s+Error Codes",
        rf"^{re.escape(brand)}\s+(.+?)\s+Specific Codes",
    ]
    for pattern in patterns:
        match = re.match(pattern, text.strip(), re.I)
        if match:
            return match.group(1).strip()
    return None


def parse_brand_docx(path: Path) -> list[ParsedCode]:
    brand = path.stem.replace(" Error Codes", "")
    blocks = docx_blocks(path)
    current_appliance: str | None = None
    records: list[ParsedCode] = []

    for kind, data in blocks:
        if kind == "p":
            section = parse_appliance_section(str(data), brand)
            if section:
                current_appliance = section
            continue
        if kind != "t" or not data:
            continue
        header = [c.lower() for c in data[0]]
        if not header or header[0] != "code":
            continue
        subtype = APPLIANCE_MAP.get(current_appliance or "")
        if not subtype:
            continue
        for row in data[1:]:
            if len(row) < 2 or not row[0].strip():
                continue
            codes = split_code_cell(row[0])
            if not codes:
                continue
            records.append(
                ParsedCode(
                    manufacturer=brand,
                    equipment_subtype=subtype,
                    code=codes[0],
                    meaning=row[1].strip(),
                    common_causes=row[2].strip() if len(row) > 2 else "",
                    recommended_fix=row[3].strip() if len(row) > 3 else "",
                    alias_codes=codes[1:],
                )
            )
    return records


def split_lg_fields(text: str) -> tuple[str, str, str]:
    fix_pattern = rf"(?=(?:{'|'.join(re.escape(v) for v in FIX_VERBS)}))"
    fix_match = re.search(fix_pattern, text)
    if not fix_match:
        return text.strip(), "", ""
    before = text[: fix_match.start()].strip()
    recommended_fix = text[fix_match.start() :].strip()
    cause_match = re.search(r"(?<=[a-z])(?=[A-Z])", before)
    if cause_match:
        meaning = before[: cause_match.start()].strip()
        common_causes = before[cause_match.start() :].strip()
        return meaning, common_causes, recommended_fix
    return before, "", recommended_fix


def parse_lg_codes_and_remainder(line: str) -> tuple[list[str], str] | None:
    slash_match = re.match(
        r"^((?:[A-Za-z0-9]{1,4}\s*/\s*)*[A-Za-z0-9]{1,4})(?=[A-Z][a-z]|\s)(.+)$",
        line,
    )
    if slash_match:
        codes = split_code_cell(slash_match.group(1))
        return codes, slash_match.group(2).strip()

    patterns = [
        r"^(ER [A-Z]{2})(.+)$",
        r"^(TE1(?:/TE2)?)(.+)$",
        r"^(CF\d+)(.+)$",
        r"^(E-\d+)(.+)$",
        r"^(OFF / O FF)(.+)$",
        r"^([A-Z]{2})([A-Z][a-z].*)$",
        r"^([a-z][A-Z])([A-Z][a-z].*)$",
        r"^([A-Za-z]{2,4})([A-Z][a-z].*)$",
        r"^(F\d{1,2})([A-Z][a-z].*)$",
        r"^(tE\d(?:/tE\d)*)([A-Z][a-z].*)$",
    ]
    for pattern in patterns:
        match = re.match(pattern, line)
        if match:
            raw_code = match.group(1).strip()
            if raw_code.startswith("ER "):
                raw_code = raw_code.replace(" ", "")
            return split_code_cell(raw_code), match.group(2).strip()
    return None


def parse_lg_docx(path: Path) -> list[ParsedCode]:
    blocks = docx_blocks(path)
    current_appliance: str | None = None
    records: list[ParsedCode] = []

    for kind, data in blocks:
        if kind != "p":
            continue
        line = str(data).strip()
        section = parse_appliance_section(line, "LG")
        if section:
            current_appliance = section
            continue
        if line in ("CodeMeaningMost Common CausesRecommended Fix",):
            continue
        if not current_appliance or current_appliance not in APPLIANCE_MAP:
            continue
        if not re.match(r"^[A-Za-z0-9]", line):
            continue
        if " among the most common" in line or line.startswith("LG "):
            continue

        parsed_codes = parse_lg_codes_and_remainder(line)
        if not parsed_codes:
            continue
        codes, remainder = parsed_codes
        meaning, causes, fix = split_lg_fields(remainder)
        if not meaning:
            continue
        records.append(
            ParsedCode(
                manufacturer="LG",
                equipment_subtype=APPLIANCE_MAP[current_appliance],
                code=codes[0],
                meaning=meaning,
                common_causes=causes,
                recommended_fix=fix,
                alias_codes=codes[1:],
            )
        )
    return records


def expand_aliases(records: list[ParsedCode]) -> list[dict]:
    rows: list[dict] = []
    for record in records:
        group_id = str(uuid.uuid4())
        all_codes = [record.code, *record.alias_codes]
        for code in all_codes:
            rows.append(
                {
                    "manufacturer": record.manufacturer,
                    "equipment_subtype": record.equipment_subtype,
                    "code": code.strip(),
                    "code_normalized": normalize_code(code),
                    "meaning": record.meaning,
                    "common_causes": record.common_causes,
                    "recommended_fix": record.recommended_fix,
                    "alias_group_id": group_id,
                    "related_codes": [normalize_code(c) for c in all_codes],
                }
            )
    return rows


def dedupe_rows(rows: list[dict]) -> list[dict]:
    seen: set[tuple[str, str, str]] = set()
    unique: list[dict] = []
    for row in rows:
        key = (
            row["manufacturer"],
            row["equipment_subtype"],
            row["code_normalized"],
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def sql_literal(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def write_sql(rows: list[dict], path: Path) -> None:
    lines = [
        "-- Generated by scripts/parse_dma_error_codes.py — do not edit by hand",
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
            f"{sql_literal(row['common_causes'])}, "
            f"{sql_literal(row['recommended_fix'])}, "
            f"{sql_literal(row['alias_group_id'])}::uuid);"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    if not DOC_DIR.is_dir():
        raise SystemExit(f"Missing doc directory: {DOC_DIR}")

    parsed: list[ParsedCode] = []
    for path in sorted(DOC_DIR.glob("*.docx")):
        if path.name.startswith("Master"):
            continue
        if path.name.startswith("LG"):
            parsed.extend(parse_lg_docx(path))
        else:
            parsed.extend(parse_brand_docx(path))

    rows = dedupe_rows(expand_aliases(parsed))
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    write_sql(rows, OUT_SQL)

    by_brand: dict[str, int] = {}
    for row in rows:
        by_brand[row["manufacturer"]] = by_brand.get(row["manufacturer"], 0) + 1
    print(f"Wrote {len(rows)} rows to {OUT_JSON.name} and {OUT_SQL.name}")
    for brand, count in sorted(by_brand.items()):
        print(f"  {brand}: {count}")


if __name__ == "__main__":
    main()
