#!/usr/bin/env python3
"""Attach W11509412 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_ka_french_door"

BRIDGE_STEP = {
    "id": "service_mode_after_sd_entry",
    "type": "instruction",
    "title": "Continue in Service Diagnostics",
    "body": "Service Diagnostics entered at step 01. Press SW5/SW4 to navigate to the test number for this procedure.",
    "sourceExcerpt": "Press SW5 to move to the next step in the sequence. Press SW4 to back up.",
    "requiresInput": False,
}

SERVICE_TEST_PROCEDURES: dict[str, str] = {
    "w11509412-test-01-fc-thermistor.json": "select_test_01",
    "w11509412-test-02-rc-thermistor.json": "select_test_02",
    "w11509412-test-03-evap-fan-damper.json": "select_test_03",
    "w11509412-test-04-compressor.json": "select_test_04",
    "w11509412-test-06-defrost.json": "select_test_06",
    "w11509412-test-19-fill-tube-heater.json": "select_test_19",
    "w11509412-test-36-ice-box-fan.json": "select_test_36",
    "w11509412-test-37-ice-box-thermistor.json": "select_test_37",
    "w11509412-test-45-ice-water-fill.json": "harvest_first",
    "w11509412-test-56-ice-maker-errors.json": "select_test_56",
    "w11509412-test-57-ice-harvest.json": "select_test_57",
    "w11509412-test-58-ice-heater-thermistor.json": "select_test_58",
    "w11509412-test-59-ice-motor.json": "select_test_59",
}


def ensure_bridge_step(steps: list[dict], continue_to: str) -> None:
    if any(step.get("id") == BRIDGE_STEP["id"] for step in steps):
        return
    target_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == continue_to),
        None,
    )
    if target_index is None:
        raise ValueError(f"Could not place bridge before {continue_to}")
    bridge = {
        **BRIDGE_STEP,
        "order": steps[target_index].get("order", target_index + 1),
        "defaultNextStepId": continue_to,
    }
    steps.insert(target_index, bridge)


def renumber_steps(steps: list[dict]) -> None:
    for index, step in enumerate(steps, start=1):
        step["order"] = index


def service_modes_for(continue_to: str) -> list[dict]:
    return [
        {
            "bundleId": "w11509412-service-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        }
    ]


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in SERVICE_TEST_PROCEDURES:
        return f"{name}: skipped"

    continue_to = SERVICE_TEST_PROCEDURES[name]
    data = json.loads(path.read_text(encoding="utf-8"))
    ensure_bridge_step(data["steps"], continue_to)
    data["serviceModes"] = service_modes_for(continue_to)
    renumber_steps(data["steps"])
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service diagnostic entry"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w11509412-test-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
