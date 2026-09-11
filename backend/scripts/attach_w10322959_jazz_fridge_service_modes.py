#!/usr/bin/env python3
"""Attach W10322959 Jazz service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_jazz_french_door"

BRIDGE_STEP = {
    "id": "service_mode_after_se_entry",
    "type": "instruction",
    "title": "Continue in Service Test Mode",
    "body": "Service Test Mode (S-E) entered. Use Freezer UP/DOWN to select the test number for this procedure.",
    "sourceExcerpt": "You are now in the SERVICES TEST operational mode and may use the diagnostic tests.",
    "requiresInput": False,
}

# test file -> first step after S-E entry bridge
SERVICE_TEST_PROCEDURES: dict[str, str] = {
    "w10322959-test-01-defrost.json": "select_test_1",
    "w10322959-test-02-compressor.json": "select_test_2",
    "w10322959-test-03-evap-fan.json": "select_test_3",
    "w10322959-test-04-ff-thermistor.json": "select_test_4",
    "w10322959-test-05-fz-thermistor.json": "select_test_5",
    "w10322959-test-06-damper.json": "select_test_6",
    "w10322959-test-07-ff-performance.json": "select_test_7",
    "w10322959-test-08-fz-performance.json": "select_test_8",
    "w10322959-test-09-defrost-interval.json": "select_test_9",
}

FORCED_DEFROST_PROCEDURES = {"w10322959-test-01-defrost.json"}


def ensure_bridge_step(steps: list[dict], continue_to: str) -> None:
    if any(step.get("id") == BRIDGE_STEP["id"] for step in steps):
        return
    target_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == continue_to),
        None,
    )
    if target_index is None:
        raise ValueError(f"Could not place bridge before {continue_to}")
    bridge = {**BRIDGE_STEP, "order": steps[target_index].get("order", target_index + 1), "defaultNextStepId": continue_to}
    steps.insert(target_index, bridge)


def renumber_steps(steps: list[dict]) -> None:
    for index, step in enumerate(steps, start=1):
        step["order"] = index


def service_modes_for(name: str, continue_to: str) -> list[dict]:
    modes = [
        {
            "bundleId": "w10322959-service-test-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        }
    ]
    if name in FORCED_DEFROST_PROCEDURES:
        modes.append(
            {
                "bundleId": "w10322959-forced-defrost-entry",
                "modeKind": "load_test",
                "attachAfterStepId": BRIDGE_STEP["id"],
                "continueToStepId": continue_to,
            }
        )
    return modes


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in SERVICE_TEST_PROCEDURES:
        return f"{name}: skipped"

    continue_to = SERVICE_TEST_PROCEDURES[name]
    data = json.loads(path.read_text(encoding="utf-8"))
    ensure_bridge_step(data["steps"], continue_to)
    data["serviceModes"] = service_modes_for(name, continue_to)
    renumber_steps(data["steps"])
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    extras = " + F-d" if name in FORCED_DEFROST_PROCEDURES else ""
    return f"{name}: S-E entry{extras}"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w10322959-test-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
