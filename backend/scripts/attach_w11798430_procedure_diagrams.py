#!/usr/bin/env python3
"""Attach W11798430 diagram references to ACU TL dryer delta procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_acu_tl_dryer"
ASSET_BASE = "/images/procedures/whirlpool_acu_tl_dryer"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11798430-acu-pinout": {
        "id": "w11798430-acu-pinout",
        "caption": "ACU connections — J4 thermistors, J7 motor",
        "assetPath": f"{ASSET_BASE}/w11798430-acu-pinout.png",
    },
    "w11798430-motor-strip": {
        "id": "w11798430-motor-strip",
        "caption": "Motor strip circuit (TEST #3)",
        "assetPath": f"{ASSET_BASE}/w11798430-motor-strip.png",
    },
    "w11798430-heater-strip": {
        "id": "w11798430-heater-strip",
        "caption": "Heater strip circuits — electric & gas (TEST #4)",
        "assetPath": f"{ASSET_BASE}/w11798430-heater-strip.png",
    },
    "w11798430-thermistor-strip": {
        "id": "w11798430-thermistor-strip",
        "caption": "Thermistors strip circuit (TEST #4a)",
        "assetPath": f"{ASSET_BASE}/w11798430-thermistor-strip.png",
    },
    "w11798430-gas-valve": {
        "id": "w11798430-gas-valve",
        "caption": "Gas valve resistance (TEST #4d)",
        "assetPath": f"{ASSET_BASE}/w11798430-gas-valve.png",
    },
}

PINOUT = "w11798430-acu-pinout"
MOTOR = "w11798430-motor-strip"
HEATER = "w11798430-heater-strip"
THERM = "w11798430-thermistor-strip"
GAS = "w11798430-gas-valve"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "ACU motor path": [MOTOR, PINOUT],
    "Motor main": [MOTOR, PINOUT],
    "Motor start": [MOTOR, PINOUT],
    "Heater element": [HEATER, PINOUT],
    "J4 outlet": [PINOUT, THERM],
    "J4 inlet": [PINOUT, THERM],
    "Gas valve": [GAS, PINOUT, HEATER],
    "Ignitor": [GAS, HEATER],
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
    for path in sorted(SEED_DIR.glob("w11798430-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
