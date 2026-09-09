#!/usr/bin/env python3
"""Attach W10674984 ADC defrost test mode bundle to WRT311 procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_wrt311_adc"

BRIDGE_STEP = {
    "id": "adc_test_after_entry",
    "type": "instruction",
    "title": "ADC defrost test mode active",
    "body": "Relay click confirms ADC defrost test entry. Heater may run up to 18 minutes or until bi-metal opens.",
    "sourceExcerpt": "In test mode: defrost heater on up to 18 min or until bi-metal opens.",
    "requiresInput": False,
}

ADC_TEST_PROCEDURES: dict[str, str] = {
    "w10674984-defrost-heater.json": "access_heater",
    "w10674984-adc-heater-voltage.json": "restore_power_adc",
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
            "bundleId": "w10674984-adc-defrost-test-entry",
            "modeKind": "load_test",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        }
    ]


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in ADC_TEST_PROCEDURES:
        return f"{name}: skipped"

    data = json.loads(path.read_text(encoding="utf-8"))
    continue_to = ADC_TEST_PROCEDURES[name]
    steps = data.get("steps", [])
    ensure_bridge_step(steps, continue_to)
    renumber_steps(steps)
    data["steps"] = steps
    data["serviceModes"] = service_modes_for(continue_to)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: attached adc-defrost-test-entry -> {continue_to}"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w10674984-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
