#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung TL DV50 dryer procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_tl_dryer_dv50"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungtldv50-thermistor": "exhaust_thermistor",
    "samsungtldv50-heater-electric": "heating_element",
    "samsungtldv50-motor-circuit": "drive_motor",
    "samsungtldv50-gas-valve": "gas_valve",
    "samsungtldv50-gas-ignitor": "igniter",
    "samsungtldv50-gas-flame-sensor": "flame_sensor",
}

KNOWLEDGE_EVIDENCE = {
    "samsungTlDv50DryerThermistor10KOhms": ("exhaust_thermistor", "confirm_exhaust_thermistor_ol_exhaust_thermistor_failed", "eliminate_exhaust_thermistor_ol_exhaust_thermistor_ok"),
    "samsungTlDv50DryerHeaterSingleOhms": ("heating_element", "confirm_heating_element_ol_heating_element_failed", "eliminate_heating_element_ol_heating_element_ok"),
    "samsungTlDv50DryerHeaterDualLowOhms": ("heating_element", "confirm_heating_element_ol_heating_element_failed", "eliminate_heating_element_ol_heating_element_ok"),
    "samsungTlDv50DryerHeaterDualHighOhms": ("heating_element", "confirm_heating_element_ol_heating_element_failed", "eliminate_heating_element_ol_heating_element_ok"),
    "samsungTlDv50DryerMotorWinding34Ohms": ("drive_motor", "confirm_drive_motor_ol_drive_motor_failed", "eliminate_drive_motor_ol_drive_motor_ok"),
    "samsungTlDv50DryerMotorWinding45Ohms": ("drive_motor", "confirm_drive_motor_ol_drive_motor_failed", "eliminate_drive_motor_ol_drive_motor_ok"),
    "samsungTlDv50DryerIgnitorOhms": ("igniter", "confirm_igniter_ol_igniter_failed", "eliminate_igniter_ol_igniter_ok"),
    "samsungTlDv50DryerGasValve12Ohms": ("gas_valve", "confirm_gas_valve_ol_gas_valve_failed", "eliminate_gas_valve_ol_gas_valve_ok"),
    "samsungTlDv50DryerFlameSensorOhms": ("flame_sensor", "confirm_flame_sensor_open_flame_sensor_failed", "eliminate_flame_sensor_open_flame_sensor_ok"),
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
    for path in sorted(SEED_DIR.glob("samsungtldv50-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
