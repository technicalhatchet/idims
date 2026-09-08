#!/usr/bin/env python3
"""Attach W8178558 diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_duet_sport"
ASSET_BASE = "/images/procedures/whirlpool_duet_sport"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w8178558-ccu-pinout-figure4-5": {
        "id": "w8178558-ccu-pinout-figure4-5",
        "caption": "CCU connector callouts (§4-5, manual p. 43)",
        "assetPath": f"{ASSET_BASE}/w8178558-ccu-pinout-figure4-5.png",
    },
    "w8178558-inlet-valves-vch7": {
        "id": "w8178558-inlet-valves-vch7",
        "caption": "Inlet valve solenoids — VCH7 (§5-1)",
        "assetPath": f"{ASSET_BASE}/w8178558-inlet-valves-vch7.png",
    },
    "w8178558-pressure-switch-pr6": {
        "id": "w8178558-pressure-switch-pr6",
        "caption": "Pressure switch — PR6 (§5-2)",
        "assetPath": f"{ASSET_BASE}/w8178558-pressure-switch-pr6.png",
    },
    "w8178558-dispenser-di6": {
        "id": "w8178558-dispenser-di6",
        "caption": "Detergent dispenser — DI6 (§5-4)",
        "assetPath": f"{ASSET_BASE}/w8178558-dispenser-di6.png",
    },
    "w8178558-door-dl3-ds2": {
        "id": "w8178558-door-dl3-ds2",
        "caption": "Door lock DL3 & door switch DS2 (§5-5)",
        "assetPath": f"{ASSET_BASE}/w8178558-door-dl3-ds2.png",
    },
    "w8178558-drain-pump-dp2": {
        "id": "w8178558-drain-pump-dp2",
        "caption": "Drain pump — DP2 (§5-6)",
        "assetPath": f"{ASSET_BASE}/w8178558-drain-pump-dp2.png",
    },
    "w8178558-heater-th2": {
        "id": "w8178558-heater-th2",
        "caption": "Wash heater HE2 & temp sensor TH2 (§5-7)",
        "assetPath": f"{ASSET_BASE}/w8178558-heater-th2.png",
    },
    "w8178558-motor-ms2-interlock": {
        "id": "w8178558-motor-ms2-interlock",
        "caption": "Drive motor MS2 & interlock switch (§5-8)",
        "assetPath": f"{ASSET_BASE}/w8178558-motor-ms2-interlock.png",
    },
}

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "Motor": ["w8178558-motor-ms2-interlock", "w8178558-ccu-pinout-figure4-5"],
    "MS2": ["w8178558-motor-ms2-interlock", "w8178558-ccu-pinout-figure4-5"],
    "Drain pump": ["w8178558-drain-pump-dp2", "w8178558-ccu-pinout-figure4-5"],
    "DP2": ["w8178558-drain-pump-dp2", "w8178558-ccu-pinout-figure4-5"],
    "Inlet valve": ["w8178558-inlet-valves-vch7", "w8178558-ccu-pinout-figure4-5"],
    "VCH7": ["w8178558-inlet-valves-vch7", "w8178558-ccu-pinout-figure4-5"],
    "Heater": ["w8178558-heater-th2", "w8178558-ccu-pinout-figure4-5"],
    "HE2": ["w8178558-heater-th2", "w8178558-ccu-pinout-figure4-5"],
    "Wash NTC": ["w8178558-heater-th2", "w8178558-ccu-pinout-figure4-5"],
    "TH2": ["w8178558-heater-th2", "w8178558-ccu-pinout-figure4-5"],
    "DL3": ["w8178558-door-dl3-ds2", "w8178558-ccu-pinout-figure4-5"],
    "DS2": ["w8178558-door-dl3-ds2", "w8178558-ccu-pinout-figure4-5"],
    "Dispenser motor": ["w8178558-dispenser-di6", "w8178558-ccu-pinout-figure4-5"],
    "DI6": ["w8178558-dispenser-di6", "w8178558-ccu-pinout-figure4-5"],
    "PR6": ["w8178558-pressure-switch-pr6", "w8178558-ccu-pinout-figure4-5"],
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
    for path in sorted(SEED_DIR.glob("w8178558-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
