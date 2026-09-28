#!/usr/bin/env python3
"""Attach Samsung DW80M9 dishwasher diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_dishwasher_m9"
ASSET_BASE = "/images/procedures/samsung_dishwasher_m9"

DIAGRAMS: dict[str, dict[str, str]] = {
    "samsungdwm9-main-pcb-layout": {
        "id": "samsungdwm9-main-pcb-layout",
        "caption": "Main PCB connector map (§5-1)",
        "assetPath": f"{ASSET_BASE}/samsungdwm9-main-pcb-layout.png",
    },
    "samsungdwm9-main-pcb-pinout": {
        "id": "samsungdwm9-main-pcb-pinout",
        "caption": "CN101/CN401/CN503/CN802 pinout (§5-2)",
        "assetPath": f"{ASSET_BASE}/samsungdwm9-main-pcb-pinout.png",
    },
}

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "CN101": ["samsungdwm9-main-pcb-layout", "samsungdwm9-main-pcb-pinout"],
    "CN401": ["samsungdwm9-main-pcb-layout", "samsungdwm9-main-pcb-pinout"],
    "CN403": ["samsungdwm9-main-pcb-pinout"],
    "CN501": ["samsungdwm9-main-pcb-pinout"],
    "CN503": ["samsungdwm9-main-pcb-layout", "samsungdwm9-main-pcb-pinout"],
    "CN802": ["samsungdwm9-main-pcb-pinout"],
    "CN901": ["samsungdwm9-main-pcb-layout"],
    "CN902": ["samsungdwm9-main-pcb-layout"],
    "Heater": ["samsungdwm9-main-pcb-pinout"],
    "Drain pump": ["samsungdwm9-main-pcb-pinout"],
    "Vane motor": ["samsungdwm9-main-pcb-pinout"],
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
    for path in sorted(SEED_DIR.glob("samsungdwm9-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_diagrams(data)
        if n:
            path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} steps")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
