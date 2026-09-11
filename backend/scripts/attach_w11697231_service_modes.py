#!/usr/bin/env python3
"""Attach W11697231 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_tl_dd"

BRIDGE_STEP = {
    "id": "service_mode_before_test",
    "type": "instruction",
    "title": "Continue to Manual Test Mode",
    "body": "You should now be in Service Diagnostic mode. Turn cycle selector to Spin + Done LEDs, then press START for Manual Test Mode load commands.",
    "sourceExcerpt": "Service Diagnostic mode must be active before Manual Test Mode (Spin + Done, START).",
    "requiresInput": False,
}

SPLIT_MANUAL_TEST_PROCEDURES: dict[str, tuple[str, str]] = {
    "w11697231-test-02-valves.json": ("valve_live_precheck", "live_test_valves"),
    "w11697231-test-07-drain-pump.json": ("reconnect_pump_power", "live_test_drain_pump"),
}

SINGLE_ENTRY_PROCEDURES: dict[str, tuple[str, str]] = {
    "w11697231-test-03-drive-system.json": ("safety_power_off", "enter_service_diag"),
    "w11697231-test-03a-shifter.json": ("safety_power_off", "shifter_service_test"),
    "w11697231-test-03b-motor.json": ("safety_power_off", "motor_agitate_spin_test"),
    "w11697231-test-04-console-indicators.json": ("safety_power_off", "ui_test_mode"),
    "w11697231-test-05-temp-thermistor.json": ("safety_power_off", "cold_valve_test"),
    "w11697231-test-06-water-level.json": ("safety_power_off", "small_load_fill"),
    "w11697231-test-08-lid-lock.json": ("safety_power_off", "lid_lock_service_test"),
}


def split_service_modes(attach_after: str, continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": "w11697231-service-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": "service_mode_before_test",
        },
        {
            "bundleId": "w11697231-manual-test-mode",
            "modeKind": "load_test",
            "attachAfterStepId": "service_mode_before_test",
            "continueToStepId": continue_to,
        },
    ]


def single_entry_mode(attach_after: str, continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": "w11697231-service-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": continue_to,
        }
    ]


def ensure_bridge_step(steps: list[dict], reconnect_id: str, live_test_id: str) -> None:
    if any(step.get("id") == "service_mode_before_test" for step in steps):
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

    if name in SPLIT_MANUAL_TEST_PROCEDURES:
        attach_after, continue_to = SPLIT_MANUAL_TEST_PROCEDURES[name]
        ensure_bridge_step(data["steps"], attach_after, continue_to)
        data["serviceModes"] = split_service_modes(attach_after, continue_to)
        renumber_steps(data["steps"])
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return f"{name}: diagnostic entry + manual test mode"

    if name in SINGLE_ENTRY_PROCEDURES:
        attach_after, continue_to = SINGLE_ENTRY_PROCEDURES[name]
        data["serviceModes"] = single_entry_mode(attach_after, continue_to)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return f"{name}: service diagnostic entry only"

    return f"{name}: skipped"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w11697231-test-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
