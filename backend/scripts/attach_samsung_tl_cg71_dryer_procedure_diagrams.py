#!/usr/bin/env python3
"""Attach Samsung TL CG71 dryer diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_tl_dryer_cg71"
ASSET_BASE = "/images/procedures/samsung_tl_dryer_cg71"

DIAGRAMS: dict[str, dict[str, str]] = {
    "samsungtlcg71d-main-pcb": {
        "id": "samsungtlcg71d-main-pcb",
        "caption": "Main PCB assembly (§2-8 p.12)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71d-main-pcb.png",
    },
    "samsungtlcg71d-sub-pcb": {
        "id": "samsungtlcg71d-sub-pcb",
        "caption": "Sub PCB assembly (§2-9 p.13)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71d-sub-pcb.png",
    },
    "samsungtlcg71d-door-switch": {
        "id": "samsungtlcg71d-door-switch",
        "caption": "Frame front and door switch (§3-2 p.17)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71d-door-switch.png",
    },
    "samsungtlcg71d-moisture-sensor": {
        "id": "samsungtlcg71d-moisture-sensor",
        "caption": "Moisture sensor access (§3-2 p.18)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71d-moisture-sensor.png",
    },
    "samsungtlcg71d-motor": {
        "id": "samsungtlcg71d-motor",
        "caption": "Motor and blower assembly (§3-2 p.20)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71d-motor.png",
    },
    "samsungtlcg71d-burner": {
        "id": "samsungtlcg71d-burner",
        "caption": "Gas burner assembly (§3-2 p.21)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71d-burner.png",
    },
    "samsungtlcg71d-heater-thermistor": {
        "id": "samsungtlcg71d-heater-thermistor",
        "caption": "Thermistor, sensors, and heater (§3-2 p.22)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71d-heater-thermistor.png",
    },
}

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "Motor": ["samsungtlcg71d-motor", "samsungtlcg71d-main-pcb"],
    "Heater": ["samsungtlcg71d-heater-thermistor"],
    "Thermistor": ["samsungtlcg71d-heater-thermistor"],
    "Valve": ["samsungtlcg71d-burner", "samsungtlcg71d-main-pcb"],
    "Igniter 101D": ["samsungtlcg71d-burner"],
    "10RS": ["samsungtlcg71d-burner", "samsungtlcg71d-heater-thermistor"],
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
    for path in sorted(SEED_DIR.glob("samsungtlcg71d-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
