#!/usr/bin/env python3
"""Attach Frigidaire PRMC System Diagnostic Mode bundle to sensor procedures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/frigidaire_prmc_french_door"

BRIDGE_STEP = {
    "id": "service_mode_after_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "System Diagnostic Mode entered. Navigate to the sensor test number for this procedure.",
    "sourceExcerpt": "After service mode entry, proceed with OEM sensor readout and resistance checks.",
    "requiresInput": False,
}

THERMISTOR_PROCEDURES = {
    "frigidaireprmc-fz-temp-sensor.json": "service_mode_readout",
    "frigidaireprmc-fz-defrost-sensor.json": "service_mode_readout",
    "frigidaireprmc-ff-temp-sensor.json": "service_mode_readout",
    "frigidaireprmc-ff-defrost-sensor.json": "service_mode_readout",
    "frigidaireprmc-vcz-temp-sensor.json": "service_mode_readout",
    "frigidaireprmc-ffim-tray-sensor.json": "service_mode_readout",
    "frigidaireprmc-ui-communication.json": "check_dispenser_harness",
}


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in THERMISTOR_PROCEDURES:
        return f"{name}: skipped"

    continue_to = THERMISTOR_PROCEDURES[name]
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data.get("steps", [])

    if not any(step.get("id") == BRIDGE_STEP["id"] for step in steps):
        continue_index = next(
            (index for index, step in enumerate(steps) if step.get("id") == continue_to),
            None,
        )
        if continue_index is None:
            raise ValueError(f"{name}: step {continue_to} not found")
        bridge = {
            **BRIDGE_STEP,
            "order": steps[continue_index].get("order", continue_index + 1),
            "defaultNextStepId": continue_to,
        }
        steps.insert(continue_index, bridge)
        for index, step in enumerate(steps, start=1):
            step["order"] = index

    data["serviceModes"] = [
        {
            "bundleId": "frigidaireprmc-service-mode-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service mode bundle attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("frigidaireprmc-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
