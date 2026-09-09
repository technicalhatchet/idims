#!/usr/bin/env python3
"""Attach W11480208 Service Diagnostics entry bundle to live-test procedures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_dishwasher_acu"

BRIDGE_STEP = {
    "id": "service_mode_before_live_test",
    "type": "instruction",
    "title": "Continue after Service Diagnostics entry",
    "body": (
        "Service Diagnostics should be available (1-2-3 entry, press Key #2, close door to start). "
        "Continue with bench checks below."
    ),
    "sourceExcerpt": "Refer to Component Testing; use Service Diagnostics Cycle for live load verification.",
    "requiresInput": False,
}

LIVE_TEST_PROCEDURES: dict[str, str] = {
    "w11480208-door-switch.json": "live_door_diag",
    "w11480208-heater.json": "live_heater_voltage",
    "w11480208-overfill-switch.json": "live_overfill_13v",
    "w11480208-diverter-motor.json": "live_diverter",
    "w11480208-drain-motor-vsm.json": "live_drain_vsm",
    "w11480208-dc-fan.json": "live_fan",
}


def service_mode_ref(continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": "w11480208-service-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": "service_mode_before_live_test",
        },
    ]


def ensure_bridge_step(steps: list[dict], live_test_id: str) -> None:
    if any(step.get("id") == "service_mode_before_live_test" for step in steps):
        return
    live_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == live_test_id),
        None,
    )
    if live_index is None:
        raise ValueError(f"Live test step {live_test_id} not found")

    bridge = {
        **BRIDGE_STEP,
        "order": steps[live_index].get("order", live_index + 1),
        "defaultNextStepId": live_test_id,
    }
    steps.insert(live_index, bridge)


def renumber_steps(steps: list[dict]) -> None:
    for index, step in enumerate(steps, start=1):
        step["order"] = index


def patch_seed(path: Path, live_test_id: str) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    ensure_bridge_step(data["steps"], live_test_id)
    data["serviceModes"] = service_mode_ref(live_test_id)
    renumber_steps(data["steps"])
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{path.name}: service diagnostic entry attached"


def main() -> None:
    for filename, live_test_id in sorted(LIVE_TEST_PROCEDURES.items()):
        path = SEED_DIR / filename
        if not path.is_file():
            print(f"{filename}: skipped (not found)")
            continue
        print(patch_seed(path, live_test_id))


if __name__ == "__main__":
    main()
