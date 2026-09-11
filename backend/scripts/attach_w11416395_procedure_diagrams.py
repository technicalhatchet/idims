#!/usr/bin/env python3
"""Attach W11416395 diagram references to MVW6200 washer procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_mvw6200"
ASSET_BASE = "/images/procedures/whirlpool_mvw6200"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11416395-acu-pinout": {
        "id": "w11416395-acu-pinout",
        "caption": "Main control connectors & pinouts (§3-3)",
        "assetPath": f"{ASSET_BASE}/w11416395-acu-pinout.png",
    },
    "w11416395-psc-bottom-view": {
        "id": "w11416395-psc-bottom-view",
        "caption": "PSC drive area — motor, shifter, drain pump (TEST #3)",
        "assetPath": f"{ASSET_BASE}/w11416395-psc-bottom-view.png",
    },
}

PINOUT = "w11416395-acu-pinout"
BOTTOM = "w11416395-psc-bottom-view"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "J1": [PINOUT],
    "J5": [PINOUT],
    "J8": [PINOUT],
    "J4": [PINOUT],
    "J6": [PINOUT, BOTTOM],
    "PSC motor": [BOTTOM, PINOUT],
    "Drain pump": [BOTTOM, PINOUT],
}


def images_for_connector(connector: str) -> list[dict[str, str]]:
    ids = CONNECTOR_DIAGRAM_IDS.get(connector, [])
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
    for path in sorted(SEED_DIR.glob("w11416395-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
