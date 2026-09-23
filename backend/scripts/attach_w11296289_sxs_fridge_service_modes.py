#!/usr/bin/env python3
"""Attach W11296289 SxS service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_sxs_w11296289"

BRIDGE_STEP = {
    "id": "service_mode_after_entry",
    "type": "instruction",
    "title": "Continue in service mode",
    "body": "Service mode entered. Use Light key (SW2) to navigate to the step for this procedure.",
    "sourceExcerpt": "Use SW2 to advance steps; SW5 toggles loads.",
    "requiresInput": False,
}

THESEUS_PROCEDURES: dict[str, str] = {
    "w11296289-test-01-fc-thermistor.json": "navigate_step_1",
    "w11296289-test-03-rc-thermistor.json": "navigate_step_3",
    "w11296289-test-05-defrost-thermistor.json": "navigate_step_5",
    "w11296289-test-07-compressor-cond-fan.json": "navigate_step_7",
    "w11296289-test-09-damper-open.json": "navigate_step_9",
    "w11296289-test-11-damper-heater.json": "navigate_step_11",
    "w11296289-test-13-defrost-heater.json": "navigate_step_13",
    "w11296289-test-15-evap-fan.json": "navigate_step_15",
    "w11296289-test-19-water-valve.json": "navigate_step_19",
    "w11296289-test-21-rc-door-switch.json": "navigate_step_21",
    "w11296289-test-23-fc-door-switch.json": "navigate_step_23",
    "w11296289-test-33-im-tray-thermistor.json": "navigate_step_33",
}

ATHENA_PROCEDURES = {"w11296289-athena-fail-display.json": "enter_athena_service"}


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


def service_modes_for(name: str, bundle_id: str, continue_to: str) -> list[dict]:
    return [
        {
            "bundleId": bundle_id,
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"] if bundle_id.endswith("theseus-service-entry") else continue_to,
        }
    ]


def patch_seed(path: Path) -> str:
    name = path.name
    if name in THESEUS_PROCEDURES:
        continue_to = THESEUS_PROCEDURES[name]
        bundle_id = "w11296289-theseus-service-entry"
    elif name in ATHENA_PROCEDURES:
        continue_to = ATHENA_PROCEDURES[name]
        bundle_id = "w11296289-athena-service-entry"
    else:
        return f"{name}: skipped"

    data = json.loads(path.read_text(encoding="utf-8"))
    if bundle_id.endswith("theseus-service-entry"):
        ensure_bridge_step(data["steps"], continue_to)
    data["serviceModes"] = service_modes_for(name, bundle_id, continue_to)
    renumber_steps(data["steps"])
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: {bundle_id}"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w11296289-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
