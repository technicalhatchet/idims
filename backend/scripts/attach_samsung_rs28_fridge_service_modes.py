#!/usr/bin/env python3
"""Attach Samsung RS28 service-mode bundles to selected procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_sxs"

BRIDGE_STEP = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Service mode or self-diagnostic entered. Continue with component-specific checks below.",
    "sourceExcerpt": "After test mode entry, proceed with OEM component tests.",
    "requiresInput": False,
}

ATTACH_MAP: dict[str, str] = {
    "samsungrs28-f-sensor.json": "sensor_voltage",
    "samsungrs28-r-sensor.json": "sensor_voltage",
    "samsungrs28-f-def-sensor.json": "sensor_voltage",
    "samsungrs28-ambient-sensor.json": "sensor_voltage",
    "samsungrs28-humidity-sensor.json": "sensor_voltage",
    "samsungrs28-ice-maker-sensor.json": "sensor_voltage",
    "samsungrs28-f-fan.json": "fan_voltage",
    "samsungrs28-c-fan.json": "fan_voltage",
    "samsungrs28-f-defrost-heater.json": "f_def_heater_ohms",
    "samsungrs28-damper-heater.json": "damper_heater_ohms",
    "samsungrs28-ice-pipe-heater.json": "ice_pipe_voltage",
    "samsungrs28-panel-communication.json": "check_harness",
}


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in ATTACH_MAP:
        return f"{name}: skipped"

    continue_to = ATTACH_MAP[name]
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
            "bundleId": "samsungrs28-engineer-test-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
        {
            "bundleId": "samsungrs28-led-test-mode-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
        {
            "bundleId": "samsungrs28-self-diagnostic-entry",
            "modeKind": "hmi_test",
            "attachAfterStepId": BRIDGE_STEP["id"],
            "continueToStepId": continue_to,
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service modes attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("samsungrs28-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
