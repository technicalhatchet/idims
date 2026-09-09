#!/usr/bin/env python3
"""Attach Samsung RF260B test mode bundles to selected procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_sxs"

BRIDGE_STEP = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Test mode or self-diagnostic entered. Continue with component-specific checks below.",
    "sourceExcerpt": "After §4-1-1 test mode entry, proceed with OEM component tests.",
    "requiresInput": False,
}

ATTACH_MAP: dict[str, str] = {
    "samsungrf260b-fz-sensor.json": "sensor_voltage",
    "samsungrf260b-ff-sensor.json": "sensor_voltage",
    "samsungrf260b-fz-def-sensor.json": "sensor_voltage",
    "samsungrf260b-ff-def-sensor.json": "sensor_voltage",
    "samsungrf260b-fz-fan.json": "fan_voltage",
    "samsungrf260b-ff-fan.json": "fan_voltage",
    "samsungrf260b-c-fan.json": "fan_voltage",
    "samsungrf260b-fz-defrost-heater.json": "fz_heater_ohms",
    "samsungrf260b-ff-defrost-heater.json": "ff_heater_ohms",
    "samsungrf260b-panel-communication.json": "check_harness",
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
            "bundleId": "samsungrf260b-test-mode-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
        {
            "bundleId": "samsungrf260b-self-diagnostic-entry",
            "modeKind": "hmi_test",
            "attachAfterStepId": BRIDGE_STEP["id"],
            "continueToStepId": continue_to,
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: test mode + self-diagnostic attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("samsungrf260b-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
