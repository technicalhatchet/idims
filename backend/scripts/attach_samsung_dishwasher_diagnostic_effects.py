#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung dishwasher procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_dishwasher"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungdw-power-supply": "supply",
    "samsungdw-thermistor": "thermistor",
    "samsungdw-heater": "heater",
    "samsungdw-circulation-motor": "wash_motor",
    "samsungdw-door-switch": "door_latch",
    "samsungdw-fill-valve": "inlet_valve",
    "samsungdw-drain-pump": "drain_pump",
    "samsungdw-dispenser": "dispenser",
    "samsungdw-dry-system": "fan_motor",
    "samsungdw-leak-sensor": "leak_sensor",
    "samsungdw-overflow": "float_switch",
    "samsungdw-distributor": "diverter_motor",
    "samsungdw-communication": "main_control",
    "samsungdw-hmi-check": "user_interface",
}

KNOWLEDGE_EVIDENCE = {
    "samsungDishwasherThermistorOhms": ("thermistor", "confirm_thermistor_ol_thermistor_failed", "eliminate_thermistor_ol_thermistor_ok"),
    "samsungDishwasherCirculationMotorOhms": ("wash_motor", "confirm_wash_motor_ol_wash_motor_failed", "eliminate_wash_motor_ol_wash_motor_ok"),
    "samsungDishwasherDispenserOhms": ("dispenser", "confirm_dispenser_ol_dispenser_failed", "eliminate_dispenser_ol_dispenser_ok"),
    "samsungDishwasherDryFanOhms": ("fan_motor", "confirm_fan_motor_ol_fan_motor_failed", "eliminate_fan_motor_ol_fan_motor_ok"),
    "samsungDishwasherThermalActuatorOhms": ("vent", "confirm_vent_ol_vent_failed", "eliminate_vent_ol_vent_ok"),
}


def attach_effects(data: dict) -> int:
    pid = data.get("id", "")
    component = PROCEDURE_COMPONENT.get(pid, "")
    count = 0
    for step in data.get("steps", []):
        kid = step.get("measurementKnowledgeId")
        comp, confirm, eliminate = KNOWLEDGE_EVIDENCE.get(kid, (component, "", ""))
        for branch in step.get("branches", []):
            if branch.get("diagnosticEffects"):
                continue
            when = branch.get("when", {})
            kind = when.get("kind", "")
            effects = []
            if kind in PASS_MEAS and eliminate:
                effects.append({"action": "eliminate", "evidenceId": eliminate, "componentId": comp})
            elif kind in FAIL_MEAS and confirm:
                effects.append({"action": "confirm", "evidenceId": confirm, "componentId": comp})
            elif kind == "checkpoint_no" and confirm:
                effects.append({"action": "confirm", "evidenceId": confirm, "componentId": comp})
            elif kind == "checkpoint_yes" and eliminate:
                effects.append({"action": "eliminate", "evidenceId": eliminate, "componentId": comp})
            if effects:
                branch["diagnosticEffects"] = effects
                count += 1
    return count


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("samsungdw-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
