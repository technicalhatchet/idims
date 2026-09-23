#!/usr/bin/env python3
"""Attach W11428632 diagram references to Multimedia Enhanced PSC washer procedure steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_tl_psc_washer"
ASSET_BASE = "/images/procedures/whirlpool_tl_psc_washer"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11428632-connector-pinout": {
        "id": "w11428632-connector-pinout",
        "caption": "ACU connector pinouts (Figure 4–5)",
        "assetPath": f"{ASSET_BASE}/w11428632-connector-pinout.png",
    },
    "w11428632-acu-strip-circuits": {
        "id": "w11428632-acu-strip-circuits",
        "caption": "Main control strip circuits (Figure 7) & PSC bottom view (Figure 8)",
        "assetPath": f"{ASSET_BASE}/w11428632-acu-strip-circuits.png",
    },
}

PINOUT = "w11428632-connector-pinout"
STRIP = "w11428632-acu-strip-circuits"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "J1": [PINOUT, STRIP],
    "J5": [PINOUT, STRIP],
    "J8": [PINOUT, STRIP],
    "J4": [PINOUT, STRIP],
    "J2": [PINOUT, STRIP],
    "J6": [PINOUT, STRIP],
    "PSC motor": [STRIP, PINOUT],
    "Drain pump": [STRIP, PINOUT],
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
    for path in sorted(SEED_DIR.glob("w11428632-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
