#!/usr/bin/env python3
"""Attach ME11 sensor quick-test bundle to humidity sensor procedure."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_microwave_otr"

BRIDGE = {
    "id": "service_mode_before_sensor_test",
    "type": "instruction",
    "title": "Continue after sensor quick test",
    "body": "Sensor quick test entered (Auto Defrost + Popcorn hold). Continue with fault interpretation below.",
    "sourceExcerpt": "§4-14 SENSOR TEST (QUICK TEST) — Auto Defrost and Popcorn pads.",
    "requiresInput": False,
}

SELF_TEST_PROCEDURES: dict[str, str] = {
    "samsungotrmw-humidity-sensor.json": "quick_test_result",
}


def ensure_bridge(steps: list[dict], continue_to: str) -> None:
    if any(step.get("id") == BRIDGE["id"] for step in steps):
        return
    idx = next(i for i, step in enumerate(steps) if step.get("id") == continue_to)
    bridge = {**BRIDGE, "order": steps[idx].get("order", idx + 1), "defaultNextStepId": continue_to}
    steps.insert(idx, bridge)
    for i, step in enumerate(steps, 1):
        step["order"] = i


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in SELF_TEST_PROCEDURES:
        return f"{name}: skipped"

    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data["steps"]
    continue_to = SELF_TEST_PROCEDURES[name]
    ensure_bridge(steps, continue_to)

    if name == "samsungotrmw-humidity-sensor.json":
        data["serviceModes"] = [
            {
                "bundleId": "samsungotrmw-sensor-quick-test",
                "modeKind": "service_diagnostic_entry",
                "attachAfterStepId": "safety_power_off",
                "continueToStepId": BRIDGE["id"],
            },
        ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service mode attached" if name in SELF_TEST_PROCEDURES else f"{name}: skipped"


def main() -> None:
    for path in sorted(SEED_DIR.glob("samsungotrmw-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
