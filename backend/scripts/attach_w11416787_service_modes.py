#!/usr/bin/env python3
"""Attach W11416787 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_tl_dd_5100"

BRIDGE_STEP = {
    "id": "service_mode_before_activation",
    "type": "instruction",
    "title": "Continue to Component Activation",
    "body": (
        "You should now be in Service Mode. Use Left/Right to navigate, Select/Enter to open "
        "Service Diagnostics, then Component Activation for live load tests."
    ),
    "sourceExcerpt": "Service Mode must be active before Component Activation (Service Diagnostics menu).",
    "requiresInput": False,
}

SPLIT_ACTIVATION_PROCEDURES: dict[str, tuple[str, str]] = {
    "w11416787-test-02-valves.json": ("reconnect_j16_power", "live_test_valves"),
    "w11416787-test-03b-motor.json": ("reconnect_motor_power", "live_test_motor_spin"),
    "w11416787-test-07-drain-recirc-pump.json": ("reconnect_pump_power", "live_test_drain_pump"),
    "w11416787-test-09-load-and-go.json": ("reconnect_bulk_power", "live_test_bulk_pump"),
}

SINGLE_ENTRY_PROCEDURES: dict[str, tuple[str, str]] = {
    "w11416787-test-03-drive-system.json": ("safety_power_off", "enter_service_diag"),
    "w11416787-test-03a-shifter.json": ("safety_power_off", "shifter_component_test"),
    "w11416787-test-04-hmi.json": ("safety_power_off", "hmi_service_test"),
    "w11416787-test-05-temp-thermistor.json": ("safety_power_off", "therm_sensor_feedback"),
    "w11416787-test-06-water-level.json": ("safety_power_off", "pressure_sensor_feedback"),
    "w11416787-test-08-lid-lock.json": ("safety_power_off", "lid_lock_load_control"),
}


def split_service_modes(attach_after: str, continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": "w11416787-service-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": "service_mode_before_activation",
        },
        {
            "bundleId": "w11416787-component-activation",
            "modeKind": "load_test",
            "attachAfterStepId": "service_mode_before_activation",
            "continueToStepId": continue_to,
        },
    ]


def single_entry_mode(attach_after: str, continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": "w11416787-service-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": continue_to,
        }
    ]


def ensure_bridge_step(steps: list[dict], live_test_id: str) -> None:
    if any(step.get("id") == "service_mode_before_activation" for step in steps):
        return
    live_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == live_test_id),
        None,
    )
    if live_index is None:
        raise ValueError(f"Could not place bridge before {live_test_id}")

    bridge = {**BRIDGE_STEP, "order": steps[live_index].get("order", live_index + 1)}
    steps.insert(live_index, bridge)


def renumber_steps(steps: list[dict]) -> None:
    for index, step in enumerate(steps, start=1):
        step["order"] = index


def patch_seed(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    name = path.name

    if name in SPLIT_ACTIVATION_PROCEDURES:
        attach_after, continue_to = SPLIT_ACTIVATION_PROCEDURES[name]
        ensure_bridge_step(data["steps"], continue_to)
        data["serviceModes"] = split_service_modes(attach_after, continue_to)
        renumber_steps(data["steps"])
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return f"{name}: diagnostic entry + component activation"

    if name in SINGLE_ENTRY_PROCEDURES:
        attach_after, continue_to = SINGLE_ENTRY_PROCEDURES[name]
        data["serviceModes"] = single_entry_mode(attach_after, continue_to)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return f"{name}: diagnostic entry only"

    return f"{name}: skipped"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w11416787-test-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
