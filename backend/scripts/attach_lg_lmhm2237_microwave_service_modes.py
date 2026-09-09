#!/usr/bin/env python3
"""Attach LMHM2237 self-test bundle to thermistor and humidity procedures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/lg_microwave_otr"

BRIDGE = {
    "id": "service_mode_before_self_test",
    "type": "instruction",
    "title": "Continue after self-test entry",
    "body": "Self-test mode entered (Defrost weight/time 2 sec → TEST). Continue with fault interpretation below.",
    "sourceExcerpt": "§6-3 Self diagnosis — humidity sensor and PCB thermistor check.",
    "requiresInput": False,
}

SELF_TEST_PROCEDURES: dict[str, str] = {
    "lgotrmw-pcb-thermistor.json": "self_test_result",
    "lgotrmw-humidity-sensor.json": "humidity_test",
    "lgotrmw-no-heat.json": "door_cycle",
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

    data["serviceModes"] = [
        {
            "bundleId": "lgotrmw-self-test-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: self-test service mode attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("lgotrmw-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
