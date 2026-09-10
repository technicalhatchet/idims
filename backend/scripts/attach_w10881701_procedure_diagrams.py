#!/usr/bin/env python3
"""Attach W10881701 diagram references to CCU dryer delta procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_ccu_dryer"
ASSET_BASE = "/images/procedures/whirlpool_ccu_dryer"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w10881701-acu-pinout": {
        "id": "w10881701-acu-pinout",
        "caption": "ACU connectors & pinouts — J14 thermistors (§3-7)",
        "assetPath": f"{ASSET_BASE}/w10881701-acu-pinout.png",
    },
    "w10881701-motor-strip": {
        "id": "w10881701-motor-strip",
        "caption": "Motor windings & strip circuit (TEST #3)",
        "assetPath": f"{ASSET_BASE}/w10881701-motor-strip.png",
    },
    "w10881701-thermistor-strip": {
        "id": "w10881701-thermistor-strip",
        "caption": "Exhaust/inlet thermistor strip circuit (TEST #4a)",
        "assetPath": f"{ASSET_BASE}/w10881701-thermistor-strip.png",
    },
    "w10881701-gas-valve": {
        "id": "w10881701-gas-valve",
        "caption": "Gas valve coil resistance (TEST #4d)",
        "assetPath": f"{ASSET_BASE}/w10881701-gas-valve.png",
    },
    "w10881701-water-valve-strip": {
        "id": "w10881701-water-valve-strip",
        "caption": "Steam water valve strip circuit (TEST #9)",
        "assetPath": f"{ASSET_BASE}/w10881701-water-valve-strip.png",
    },
}

PINOUT = "w10881701-acu-pinout"
MOTOR = "w10881701-motor-strip"
THERM = "w10881701-thermistor-strip"
GAS = "w10881701-gas-valve"
WATER = "w10881701-water-valve-strip"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "ACU motor path": [MOTOR, PINOUT],
    "Motor main": [MOTOR, PINOUT],
    "Motor start": [MOTOR, PINOUT],
    "Heater relays": [THERM, PINOUT],
    "J14 outlet": [PINOUT, THERM],
    "J14 inlet": [PINOUT, THERM],
    "Gas valve": [GAS, PINOUT],
    "Ignitor": [GAS, THERM],
    "ACU water valve": [WATER, PINOUT],
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
    for path in sorted(SEED_DIR.glob("w10881701-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
