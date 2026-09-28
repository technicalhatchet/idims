#!/usr/bin/env python3
"""Attach W11803249 diagram references to Theseus CDFD procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_theseus_cdfd"
ASSET_BASE = "/images/procedures/whirlpool_theseus_cdfd"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11803249-theseus-acu-pinout": {
        "id": "w11803249-theseus-acu-pinout",
        "caption": "Theseus ACU connector pinouts (CONTROL BOARD / CONNECTORS & PINOUTS)",
        "assetPath": f"{ASSET_BASE}/w11803249-theseus-acu-pinout.png",
    },
    "w11803249-voltage-chart": {
        "id": "w11803249-voltage-chart",
        "caption": "Theseus ACU voltage chart — P1–P70",
        "assetPath": f"{ASSET_BASE}/w11803249-voltage-chart.png",
    },
}

PINOUT = "w11803249-theseus-acu-pinout"
CHART = "w11803249-voltage-chart"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "P2": [PINOUT, CHART],
    "P5": [PINOUT, CHART],
    "P10": [PINOUT, CHART],
    "P11": [PINOUT, CHART],
    "P70": [PINOUT, CHART],
    "compressor": [PINOUT, CHART],
}


def images_for_connector(connector: str) -> list[dict[str, str]]:
    ids = CONNECTOR_DIAGRAM_IDS.get(connector, [PINOUT, CHART])
    return [DIAGRAMS[diagram_id] for diagram_id in ids if diagram_id in DIAGRAMS]


def attach_diagrams(seed: dict) -> int:
    attached = 0
    for step in seed.get("steps", []):
        if step.get("type") != "measurement":
            continue
        test_point = step.get("testPoint") or {}
        connector = test_point.get("connector")
        if not connector:
            continue
        images = images_for_connector(connector)
        if images:
            step["images"] = images
            attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w11803249-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
