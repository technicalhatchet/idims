#!/usr/bin/env python3
"""Attach W11737351 component-access diagrams to whirlpool_ccu_dryer procedure steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_ccu_dryer"
ASSET_BASE = "/images/procedures/whirlpool_fl_dryer_access"

ACCESS_DIAGRAMS: dict[str, dict[str, str]] = {
    "w11737351-access-acu": {
        "id": "w11737351-access-acu",
        "caption": "Removing the ACU (W11737351 p.10)",
        "assetPath": f"{ASSET_BASE}/w11737351-access-acu.png",
    },
    "w11737351-access-top-console": {
        "id": "w11737351-access-top-console",
        "caption": "Removing top panel and console/HMI (W11737351 p.8)",
        "assetPath": f"{ASSET_BASE}/w11737351-access-top-console.png",
    },
    "w11737351-access-front-panel": {
        "id": "w11737351-access-front-panel",
        "caption": "Removing front panel and door switch (W11737351 p.11)",
        "assetPath": f"{ASSET_BASE}/w11737351-access-front-panel.png",
    },
    "w11737351-access-drum-light-moisture": {
        "id": "w11737351-access-drum-light-moisture",
        "caption": "Drum light and moisture sensor access (W11737351 p.12)",
        "assetPath": f"{ASSET_BASE}/w11737351-access-drum-light-moisture.png",
    },
    "w11737351-access-drive-motor": {
        "id": "w11737351-access-drive-motor",
        "caption": "Drive motor; thermal fuse and outlet thermistor (W11737351 p.14)",
        "assetPath": f"{ASSET_BASE}/w11737351-access-drive-motor.png",
    },
    "w11737351-access-heater-electric": {
        "id": "w11737351-access-heater-electric",
        "caption": "Heater, hi-limit, and thermal cutoff — electric (W11737351 p.15)",
        "assetPath": f"{ASSET_BASE}/w11737351-access-heater-electric.png",
    },
    "w11737351-access-gas-ignitor-flame": {
        "id": "w11737351-access-gas-ignitor-flame",
        "caption": "Ignitor, flame sensor, gas hi-limit (W11737351 p.16)",
        "assetPath": f"{ASSET_BASE}/w11737351-access-gas-ignitor-flame.png",
    },
    "w11737351-access-gas-valve-coils": {
        "id": "w11737351-access-gas-valve-coils",
        "caption": "Gas burner assembly coils (W11737351 p.17)",
        "assetPath": f"{ASSET_BASE}/w11737351-access-gas-valve-coils.png",
    },
    "w11737351-access-water-valve": {
        "id": "w11737351-access-water-valve",
        "caption": "Water valve — steam models (W11737351 p.19)",
        "assetPath": f"{ASSET_BASE}/w11737351-access-water-valve.png",
    },
}

ACU = "w11737351-access-acu"
CONSOLE = "w11737351-access-top-console"
FRONT = "w11737351-access-front-panel"
MOISTURE = "w11737351-access-drum-light-moisture"
MOTOR = "w11737351-access-drive-motor"
HEATER_E = "w11737351-access-heater-electric"
GAS_IGN = "w11737351-access-gas-ignitor-flame"
GAS_VALVE = "w11737351-access-gas-valve-coils"
WATER = "w11737351-access-water-valve"

CONNECTOR_ACCESS_IDS: dict[str, list[str]] = {
    "ACU motor path": [MOTOR, ACU],
    "Motor main": [MOTOR],
    "Motor start": [MOTOR],
    "J14 outlet": [MOTOR, ACU],
    "J14 inlet": [MOTOR, ACU],
    "Heater relays": [HEATER_E],
    "Gas valve": [GAS_VALVE, GAS_IGN],
    "Ignitor": [GAS_IGN, GAS_VALVE],
    "ACU water valve": [WATER, ACU],
}

STEP_ACCESS_IDS: dict[str, list[str]] = {
    "access_acu": [ACU, CONSOLE],
    "access_acu_motor": [ACU, MOTOR],
    "access_motor": [MOTOR],
    "access_heat": [HEATER_E],
    "access_fuse": [MOTOR],
    "access_cutoff": [HEATER_E],
    "access_gas": [GAS_VALVE, GAS_IGN],
    "access_gas_thermal": [GAS_IGN],
    "access_moisture": [MOISTURE, FRONT],
    "access_drum_led": [MOISTURE, CONSOLE],
    "access_service_leds": [CONSOLE],
    "door_wiring": [FRONT],
    "drum_light_check": [FRONT],
    "key_encoder_test": [CONSOLE],
    "acu_ui_connectors": [ACU, CONSOLE],
    "service_mode_wet_cloth": [MOISTURE],
    "bench_harness": [MOISTURE],
    "j13_harness": [MOISTURE, ACU],
    "nozzle_check": [WATER],
    "j8_1_wired": [WATER, ACU],
}

PROCEDURE_PREFIXES = ("w10881701-", "w11169659-")


def images_for_ids(diagram_ids: list[str]) -> list[dict[str, str]]:
    return [ACCESS_DIAGRAMS[diagram_id] for diagram_id in diagram_ids if diagram_id in ACCESS_DIAGRAMS]


def merge_images(existing: list[dict[str, str]] | None, new_images: list[dict[str, str]]) -> list[dict[str, str]]:
    merged = list(existing or [])
    seen = {item.get("id") for item in merged if item.get("id")}
    for image in new_images:
        image_id = image.get("id")
        if image_id and image_id not in seen:
            merged.append(image)
            seen.add(image_id)
    return merged


def attach_diagrams(seed: dict) -> int:
    attached = 0
    for step in seed.get("steps", []):
        step_id = step.get("id") or ""
        new_images: list[dict[str, str]] = []

        if step.get("type") == "measurement":
            test_point = step.get("testPoint") or {}
            connector = test_point.get("connector")
            if connector:
                new_images = images_for_ids(CONNECTOR_ACCESS_IDS.get(connector, []))

        if not new_images:
            new_images = images_for_ids(STEP_ACCESS_IDS.get(step_id, []))

        if not new_images:
            continue

        before = len(step.get("images") or [])
        step["images"] = merge_images(step.get("images"), new_images)
        if len(step["images"]) > before:
            attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w*.json")):
        if not any(path.name.startswith(prefix) for prefix in PROCEDURE_PREFIXES):
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} step(s) with access diagrams")
        total += count
    print(f"Attached W11737351 access diagrams on {total} steps total.")


if __name__ == "__main__":
    main()
