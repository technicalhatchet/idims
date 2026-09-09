#!/usr/bin/env python3
"""Attach W10881701 service mode bundles to selected procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_ccu_dryer"

BRIDGE_STEP = {
    "id": "service_mode_after_diag_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Service Diagnostics entered. Use Key Activation, fault scroll, or Service Test as needed, then continue below.",
    "sourceExcerpt": "After diagnostic entry, proceed with OEM component test steps.",
    "requiresInput": False,
}

SERVICE_TEST_BRIDGE = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue water valve test",
    "body": "Service Test Mode entered. Complete L1/L2/heater/airflow sequence or skip to step 8 for water spray verification.",
    "sourceExcerpt": "Service Test Mode chart step 8 — verify water sprayed into drum.",
    "requiresInput": False,
}

DIAG_ATTACH: dict[str, str] = {
    "w10881701-motor-circuit.json": "access_acu_motor",
    "w10881701-moisture-sensor.json": "access_moisture",
    "w10881701-thermistors.json": "disconnect_j14",
    "w10881701-button-indicator.json": "key_encoder_test",
    "w10881701-door-switch.json": "drum_light_check",
    "w10881701-dryness-adjust.json": "dryness_entry",
    "w10881701-drum-led.json": "access_drum_led",
    "w10881701-service-leds.json": "access_service_leds",
}

SERVICE_TEST_ATTACH = {
    "w10881701-water-valve.json": "service_test_spray",
}


def insert_bridge(path: Path, continue_to: str, bridge: dict) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data.get("steps", [])
    if any(step.get("id") == bridge["id"] for step in steps):
        return
    continue_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == continue_to),
        None,
    )
    if continue_index is None:
        raise ValueError(f"{path.name}: step {continue_to} not found")
    inserted = {
        **bridge,
        "order": steps[continue_index].get("order", continue_index + 1),
        "defaultNextStepId": continue_to,
    }
    steps.insert(continue_index, inserted)
    for index, step in enumerate(steps, start=1):
        step["order"] = index
    data["steps"] = steps
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def patch_diagnostic_entry(path: Path) -> str:
    name = path.name
    if name not in DIAG_ATTACH:
        return f"{name}: skipped (diagnostic entry)"
    continue_to = DIAG_ATTACH[name]
    insert_bridge(path, continue_to, BRIDGE_STEP)
    data = json.loads(path.read_text(encoding="utf-8"))
    data["serviceModes"] = [
        {
            "bundleId": "w10881701-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: diagnostic entry service mode"


def patch_service_test(path: Path) -> str:
    name = path.name
    if name not in SERVICE_TEST_ATTACH:
        return f"{name}: skipped (service test)"
    continue_to = SERVICE_TEST_ATTACH[name]
    insert_bridge(path, continue_to, SERVICE_TEST_BRIDGE)
    data = json.loads(path.read_text(encoding="utf-8"))
    existing = data.get("serviceModes") or []
    existing.append(
        {
            "bundleId": "w10881701-service-test-mode",
            "modeKind": "load_test",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": SERVICE_TEST_BRIDGE["id"],
        },
    )
    data["serviceModes"] = existing
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service test mode bundle"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w10881701-*.json")):
        print(patch_diagnostic_entry(path))
        print(patch_service_test(path))


if __name__ == "__main__":
    main()
