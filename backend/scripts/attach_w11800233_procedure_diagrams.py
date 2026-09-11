#!/usr/bin/env python3
"""Attach W11800233 diagram references to WTW4100 washer procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_tl_dd_4100"
ASSET_BASE = "/images/procedures/whirlpool_tl_dd_4100"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11800233-acu-pinout": {
        "id": "w11800233-acu-pinout",
        "caption": "Main control connectors & pinouts (§3 component testing)",
        "assetPath": f"{ASSET_BASE}/w11800233-acu-pinout.png",
    },
}

PINOUT = "w11800233-acu-pinout"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "J1": [PINOUT],
    "J5": [PINOUT],
    "J8": [PINOUT],
    "J4": [PINOUT],
    "J6": [PINOUT],
    "PSC motor": [PINOUT],
    "Drain pump": [PINOUT],
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
    for path in sorted(SEED_DIR.glob("w11800233-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
