#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung DW80M9 dishwasher procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_dishwasher_m9"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungdwm9-power-supply": "supply",
    "samsungdwm9-thermistor": "thermistor",
    "samsungdwm9-heater": "heater",
    "samsungdwm9-circulation-motor": "wash_motor",
    "samsungdwm9-door-switch": "door_latch",
    "samsungdwm9-fill-valve": "inlet_valve",
    "samsungdwm9-drain-pump": "drain_pump",
    "samsungdwm9-dispenser": "dispenser",
    "samsungdwm9-dry-system": "fan_motor",
    "samsungdwm9-leak-sensor": "leak_sensor",
    "samsungdwm9-overflow": "float_switch",
    "samsungdwm9-distributor": "diverter_motor",
    "samsungdwm9-vane-motor": "diverter_motor",
    "samsungdwm9-communication": "main_control",
    "samsungdwm9-hmi-check": "user_interface",
    "samsungdwm9-voltage-abnormal": "supply",
}

KNOWLEDGE_EVIDENCE = {
    "samsungDishwasherM9ThermistorOhms": ("thermistor", "confirm_thermistor_ol_thermistor_failed", "eliminate_thermistor_ol_thermistor_ok"),
    "samsungDishwasherM9CirculationMotorOhms": ("wash_motor", "confirm_wash_motor_ol_wash_motor_failed", "eliminate_wash_motor_ol_wash_motor_ok"),
    "samsungDishwasherM9FillValveOhms": ("inlet_valve", "confirm_inlet_valve_ol_inlet_valve_failed", "eliminate_inlet_valve_ol_inlet_valve_ok"),
    "samsungDishwasherM9DrainPumpOhms": ("drain_pump", "confirm_drain_pump_ol_drain_pump_failed", "eliminate_drain_pump_ol_drain_pump_ok"),
    "samsungDishwasherM9HeaterOhms": ("heater", "confirm_heater_ol_heater_failed", "eliminate_heater_ol_heater_ok"),
    "samsungDishwasherM9DispenserOhms": ("dispenser", "confirm_dispenser_ol_dispenser_failed", "eliminate_dispenser_ol_dispenser_ok"),
    "samsungDishwasherM9DryFanOhms": ("fan_motor", "confirm_fan_motor_ol_fan_motor_failed", "eliminate_fan_motor_ol_fan_motor_ok"),
    "samsungDishwasherM9ThermalActuatorOhms": ("vent", "confirm_vent_ol_vent_failed", "eliminate_vent_ol_vent_ok"),
    "samsungDishwasherM9DistributorMotorOhms": ("diverter_motor", "confirm_diverter_motor_ol_diverter_motor_failed", "eliminate_diverter_motor_ol_diverter_motor_ok"),
    "samsungDishwasherM9VaneMotorOhms": ("diverter_motor", "confirm_diverter_motor_ol_diverter_motor_failed", "eliminate_diverter_motor_ol_diverter_motor_ok"),
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
    for path in sorted(SEED_DIR.glob("samsungdwm9-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
