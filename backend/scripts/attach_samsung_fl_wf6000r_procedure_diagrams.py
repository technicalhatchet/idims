#!/usr/bin/env python3
"""Attach Samsung WF6000R washer diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fl_washer_wf6000r"
ASSET_BASE = "/images/procedures/samsung_fl_washer_wf6000r"

DIAGRAMS: dict[str, dict[str, str]] = {
    "samsungwf6000r-rear-motor": {
        "id": "samsungwf6000r-rear-motor",
        "caption": "Rear motor — winding checkpoint Blue-White-Red (§3-2 p.15)",
        "assetPath": f"{ASSET_BASE}/samsungwf6000r-rear-motor.png",
    },
    "samsungwf6000r-main-pcb": {
        "id": "samsungwf6000r-main-pcb",
        "caption": "Main PCB connectors (§3-2 p.19)",
        "assetPath": f"{ASSET_BASE}/samsungwf6000r-main-pcb.png",
    },
    "samsungwf6000r-door-lock": {
        "id": "samsungwf6000r-door-lock",
        "caption": "Door lock switch location (§3-2 p.21)",
        "assetPath": f"{ASSET_BASE}/samsungwf6000r-door-lock.png",
    },
    "samsungwf6000r-valves-level-sensor": {
        "id": "samsungwf6000r-valves-level-sensor",
        "caption": "Inlet valves and water level sensor (§3-2 p.23)",
        "assetPath": f"{ASSET_BASE}/samsungwf6000r-valves-level-sensor.png",
    },
    "samsungwf6000r-heater-thermistor": {
        "id": "samsungwf6000r-heater-thermistor",
        "caption": "Wash heater and thermistor (§3-2 p.27)",
        "assetPath": f"{ASSET_BASE}/samsungwf6000r-heater-thermistor.png",
    },
}

MOTOR = "samsungwf6000r-rear-motor"
PCB = "samsungwf6000r-main-pcb"
DOOR = "samsungwf6000r-door-lock"
VALVES = "samsungwf6000r-valves-level-sensor"
HEATER = "samsungwf6000r-heater-thermistor"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "Motor": [MOTOR, PCB],
    "Motor hall": [PCB, MOTOR],
    "Heater": [HEATER],
    "Heater element": [HEATER],
    "Thermistor": [HEATER],
    "Door switch": [DOOR],
    "Door lock": [DOOR],
    "Lock motor": [DOOR],
    "Level sensor": [VALVES],
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
    for path in sorted(SEED_DIR.glob("samsungwf6000r-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
