#!/usr/bin/env python3
"""Attach W8178558 service-mode bundles to motor, drain, and inlet procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_duet_sport"

BRIDGE_STEP = {
    "id": "service_mode_before_manual_test",
    "type": "instruction",
    "title": "Continue to Manual Diagnostic Test",
    "body": "You should now be in Diagnostic Test mode (error history reviewed if applicable). Continue below for Manual Diagnostic Test component exercise.",
    "sourceExcerpt": "After service history / diagnostic entry, use Manual Diagnostic Test for live component checks (§6-7).",
    "requiresInput": False,
}

SPLIT_MANUAL_TEST_PROCEDURES: dict[str, tuple[str, str]] = {
    "w8178558-motor-circuit.json": ("reconnect_motor_harness", "live_test_motor_rotation"),
    "w8178558-drain-pump.json": ("reconnect_pump_harness", "live_test_drain_pump"),
    "w8178558-inlet-valves.json": ("reconnect_valve_harness", "live_test_inlet_valves"),
}


def split_service_modes(attach_after: str, continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": "w8178558-diagnostic-history-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": "service_mode_before_manual_test",
        },
        {
            "bundleId": "w8178558-manual-diagnostic-test",
            "modeKind": "load_test",
            "attachAfterStepId": "service_mode_before_manual_test",
            "continueToStepId": continue_to,
        },
    ]


def ensure_bridge_step(steps: list[dict], reconnect_id: str, live_test_id: str) -> None:
    if any(step.get("id") == "service_mode_before_manual_test" for step in steps):
        return
    reconnect_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == reconnect_id),
        None,
    )
    live_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == live_test_id),
        None,
    )
    if reconnect_index is None or live_index is None:
        raise ValueError(f"Could not place bridge between {reconnect_id} and {live_test_id}")

    bridge = {**BRIDGE_STEP, "order": steps[live_index].get("order", live_index + 1)}
    steps.insert(live_index, bridge)


def renumber_steps(steps: list[dict]) -> None:
    for index, step in enumerate(steps, start=1):
        step["order"] = index


def patch_seed(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    name = path.name

    if name not in SPLIT_MANUAL_TEST_PROCEDURES:
        return f"{name}: skipped"

    attach_after, continue_to = SPLIT_MANUAL_TEST_PROCEDURES[name]
    ensure_bridge_step(data["steps"], attach_after, continue_to)
    data["serviceModes"] = split_service_modes(attach_after, continue_to)
    renumber_steps(data["steps"])
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: diagnostic history + manual test service modes"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w8178558-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
