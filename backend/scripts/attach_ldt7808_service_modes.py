#!/usr/bin/env python3
"""Attach LDT7808 test mode and water-supply bundles to component procedures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/lg_dishwasher_ldt7808"

BRIDGE = {
    "id": "service_mode_before_live_test",
    "type": "instruction",
    "title": "Continue after test mode entry",
    "body": "Test mode available (Power+Start, then Start 1–7 for component loads). Continue with bench checks below.",
    "sourceExcerpt": "§3-3 TEST MODE — component load verification.",
    "requiresInput": False,
}

TEST_MODE_PROCEDURES: dict[str, str] = {
    "ldt7808-inlet-valve.json": "valve_ohms",
    "ldt7808-drain-pump.json": "pump_ohms",
    "ldt7808-heater.json": "heater_ohms",
    "ldt7808-wash-motor.json": "motor_ohms",
    "ldt7808-vario-valve.json": "vario_ohms",
}

WATER_SUPPLY_PROCEDURES = {"ldt7808-inlet-valve.json", "ldt7808-hall-sensor.json"}


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
    if name not in TEST_MODE_PROCEDURES and name not in WATER_SUPPLY_PROCEDURES:
        return f"{name}: skipped"

    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data["steps"]
    service_modes: list[dict] = []

    if name in TEST_MODE_PROCEDURES:
        continue_to = TEST_MODE_PROCEDURES[name]
        ensure_bridge(steps, continue_to)
        service_modes.append(
            {
                "bundleId": "ldt7808-test-mode-entry",
                "modeKind": "service_diagnostic_entry",
                "attachAfterStepId": "safety_power_off",
                "continueToStepId": BRIDGE["id"],
            },
        )

    if name in WATER_SUPPLY_PROCEDURES:
        attach_after = "water_tap" if name == "ldt7808-inlet-valve.json" else "air_breaker"
        service_modes.append(
            {
                "bundleId": "ldt7808-water-supply-check",
                "modeKind": "load_test",
                "attachAfterStepId": attach_after,
                "continueToStepId": attach_after,
            },
        )

    data["serviceModes"] = service_modes
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: {len(service_modes)} service mode(s) attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("ldt7808-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
