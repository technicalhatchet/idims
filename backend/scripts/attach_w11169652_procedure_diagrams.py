#!/usr/bin/env python3
"""Attach W11169652 diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_fl_dd"
ASSET_BASE = "/images/procedures/whirlpool_fl_dd"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11169652-rfi-filter-figure1": {
        "id": "w11169652-rfi-filter-figure1",
        "caption": "RFI filter — line in/out (Figure 1, manual p. 3-6)",
        "assetPath": f"{ASSET_BASE}/w11169652-rfi-filter-figure1.png",
    },
    "w11169652-acu-pinout-figure2": {
        "id": "w11169652-acu-pinout-figure2",
        "caption": "ACU connectors & pinouts (Figure 2, manual p. 3-7)",
        "assetPath": f"{ASSET_BASE}/w11169652-acu-pinout-figure2.png",
    },
    "w11169652-motor-j6-location": {
        "id": "w11169652-motor-j6-location",
        "caption": "Motor harness connector J6 on ACU (TEST #3)",
        "assetPath": f"{ASSET_BASE}/w11169652-motor-j6-location.png",
    },
    "w11169652-drum-light-j16-location": {
        "id": "w11169652-drum-light-j16-location",
        "caption": "Drum light connector J16 on ACU (TEST #5)",
        "assetPath": f"{ASSET_BASE}/w11169652-drum-light-j16-location.png",
    },
    "w11169652-inlet-valves-strip": {
        "id": "w11169652-inlet-valves-strip",
        "caption": "Inlet water valve strip circuit — J8 (TEST #6)",
        "assetPath": f"{ASSET_BASE}/w11169652-inlet-valves-strip.png",
    },
    "w11169652-water-level-j14": {
        "id": "w11169652-water-level-j14",
        "caption": "Water level sensor / APS — J14 (TEST #7)",
        "assetPath": f"{ASSET_BASE}/w11169652-water-level-j14.png",
    },
    "w11169652-wash-heater-j3-location": {
        "id": "w11169652-wash-heater-j3-location",
        "caption": "Wash heater & temperature sensor — J3 / J15 (TEST #9–10)",
        "assetPath": f"{ASSET_BASE}/w11169652-wash-heater-j3-location.png",
    },
    "w11169652-dosing-pump-strip": {
        "id": "w11169652-dosing-pump-strip",
        "caption": "Detergent dosing pump strip circuit — J10 (TEST #11B)",
        "assetPath": f"{ASSET_BASE}/w11169652-dosing-pump-strip.png",
    },
    "w11169652-bulk-level-strip": {
        "id": "w11169652-bulk-level-strip",
        "caption": "Bulk dispenser level sensing — J17 (TEST #12B)",
        "assetPath": f"{ASSET_BASE}/w11169652-bulk-level-strip.png",
    },
    "w11169652-vent-fan-j12-strip": {
        "id": "w11169652-vent-fan-j12-strip",
        "caption": "Vent fan / blower strip circuit — J12 (TEST #13 / #17)",
        "assetPath": f"{ASSET_BASE}/w11169652-vent-fan-j12-strip.png",
    },
    "w11169652-baffle-j9-location": {
        "id": "w11169652-baffle-j9-location",
        "caption": "Vent baffle solenoid — J9 (TEST #14)",
        "assetPath": f"{ASSET_BASE}/w11169652-baffle-j9-location.png",
    },
    "w11169652-dry-heater-j4-location": {
        "id": "w11169652-dry-heater-j4-location",
        "caption": "Dry heating element — J4 (TEST #15)",
        "assetPath": f"{ASSET_BASE}/w11169652-dry-heater-j4-location.png",
    },
    "w11169652-dry-ntc-j13-location": {
        "id": "w11169652-dry-ntc-j13-location",
        "caption": "Dry temperature sensor NTC — J13 (TEST #16)",
        "assetPath": f"{ASSET_BASE}/w11169652-dry-ntc-j13-location.png",
    },
}

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "RFI": ["w11169652-rfi-filter-figure1"],
    "J2": ["w11169652-acu-pinout-figure2"],
    "J3": ["w11169652-wash-heater-j3-location", "w11169652-acu-pinout-figure2"],
    "J4": ["w11169652-dry-heater-j4-location", "w11169652-acu-pinout-figure2"],
    "J6": ["w11169652-motor-j6-location", "w11169652-acu-pinout-figure2"],
    "J7": ["w11169652-acu-pinout-figure2"],
    "J8": ["w11169652-inlet-valves-strip", "w11169652-acu-pinout-figure2"],
    "J9": ["w11169652-baffle-j9-location", "w11169652-acu-pinout-figure2"],
    "J10": ["w11169652-dosing-pump-strip", "w11169652-acu-pinout-figure2"],
    "J11": ["w11169652-acu-pinout-figure2"],
    "J12": ["w11169652-vent-fan-j12-strip", "w11169652-acu-pinout-figure2"],
    "J13": ["w11169652-dry-ntc-j13-location", "w11169652-acu-pinout-figure2"],
    "J14": ["w11169652-water-level-j14", "w11169652-acu-pinout-figure2"],
    "J15": ["w11169652-wash-heater-j3-location", "w11169652-acu-pinout-figure2"],
    "J16": ["w11169652-drum-light-j16-location", "w11169652-acu-pinout-figure2"],
    "J17": ["w11169652-bulk-level-strip", "w11169652-acu-pinout-figure2"],
    "J19": ["w11169652-acu-pinout-figure2"],
    "Pump": ["w11169652-dosing-pump-strip"],
    "Vent fan": ["w11169652-vent-fan-j12-strip"],
    "Blower": ["w11169652-vent-fan-j12-strip"],
    "Dry NTC": ["w11169652-dry-ntc-j13-location"],
    "Wash NTC": ["w11169652-wash-heater-j3-location"],
    "Level SW": ["w11169652-bulk-level-strip"],
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
    for path in sorted(SEED_DIR.glob("w11169652-test-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
