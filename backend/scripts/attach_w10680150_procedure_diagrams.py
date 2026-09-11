#!/usr/bin/env python3
"""Attach W10680150 diagram references to CCU dryer procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_ccu_dryer"
ASSET_BASE = "/images/procedures/whirlpool_ccu_dryer"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w10680150-ccu-pinout-figure11": {
        "id": "w10680150-ccu-pinout-figure11",
        "caption": "CCU connectors & pinouts (Figure 11, TEST #1)",
        "assetPath": f"{ASSET_BASE}/w10680150-ccu-pinout-figure11.png",
    },
    "w10680150-motor-figure17-19": {
        "id": "w10680150-motor-figure17-19",
        "caption": "Motor windings & belt switch (Figures 17–19, TEST #3)",
        "assetPath": f"{ASSET_BASE}/w10680150-motor-figure17-19.png",
    },
    "w10680150-thermal-figure20": {
        "id": "w10680150-thermal-figure20",
        "caption": "Thermal components (Figures 20a/20b, TEST #4)",
        "assetPath": f"{ASSET_BASE}/w10680150-thermal-figure20.png",
    },
    "w10680150-strip-circuits-figure23": {
        "id": "w10680150-strip-circuits-figure23",
        "caption": "Strip circuits — motor, heater, thermistors (Figure 23)",
        "assetPath": f"{ASSET_BASE}/w10680150-strip-circuits-figure23.png",
    },
    "w10680150-gas-valve-figure21": {
        "id": "w10680150-gas-valve-figure21",
        "caption": "Gas valve coil resistance (Figure 21, TEST #4d)",
        "assetPath": f"{ASSET_BASE}/w10680150-gas-valve-figure21.png",
    },
}

PINOUT = "w10680150-ccu-pinout-figure11"
STRIP = "w10680150-strip-circuits-figure23"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "CCU motor path": ["w10680150-motor-figure17-19", PINOUT, STRIP],
    "Motor main": ["w10680150-motor-figure17-19", PINOUT, STRIP],
    "Motor start": ["w10680150-motor-figure17-19", PINOUT, STRIP],
    "Heater relays": ["w10680150-thermal-figure20", PINOUT, STRIP],
    "P14 outlet": [PINOUT, STRIP],
    "P14 inlet": [PINOUT, STRIP],
    "Gas valve": ["w10680150-gas-valve-figure21", PINOUT, STRIP],
    "Ignitor": ["w10680150-gas-valve-figure21", "w10680150-thermal-figure20"],
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
    for path in sorted(SEED_DIR.glob("w10680150-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
