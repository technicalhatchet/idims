#!/usr/bin/env python3
"""Attach Samsung TL CG71 washer diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_tl_washer_cg71"
ASSET_BASE = "/images/procedures/samsung_tl_washer_cg71"

DIAGRAMS: dict[str, dict[str, str]] = {
    "samsungtlcg71-main-pcb": {
        "id": "samsungtlcg71-main-pcb",
        "caption": "Sub and Main PCB — control panel (§3-1 p.16)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71-main-pcb.png",
    },
    "samsungtlcg71-water-valve": {
        "id": "samsungtlcg71-water-valve",
        "caption": "Water valve housing (§3-1 p.17)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71-water-valve.png",
    },
    "samsungtlcg71-door-switch": {
        "id": "samsungtlcg71-door-switch",
        "caption": "Top cover / door switch access (§3-1 p.18)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71-door-switch.png",
    },
    "samsungtlcg71-pressure-switch": {
        "id": "samsungtlcg71-pressure-switch",
        "caption": "Pressure switch and door switch check (§3-1 p.19)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71-pressure-switch.png",
    },
    "samsungtlcg71-drain-pump": {
        "id": "samsungtlcg71-drain-pump",
        "caption": "Drain pump and thermistor (§3-1 p.20)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71-drain-pump.png",
    },
    "samsungtlcg71-motor-clutch": {
        "id": "samsungtlcg71-motor-clutch",
        "caption": "DDM motor and clutch (§3-1 p.22)",
        "assetPath": f"{ASSET_BASE}/samsungtlcg71-motor-clutch.png",
    },
}

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "Motor": ["samsungtlcg71-motor-clutch", "samsungtlcg71-main-pcb"],
    "Inlet valve": ["samsungtlcg71-water-valve"],
    "Drain pump": ["samsungtlcg71-drain-pump"],
    "Reed SW": ["samsungtlcg71-door-switch", "samsungtlcg71-pressure-switch"],
    "Lock motor": ["samsungtlcg71-door-switch"],
    "Lock contacts": ["samsungtlcg71-door-switch"],
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
    for path in sorted(SEED_DIR.glob("samsungtlcg71-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
