#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung FL BB8700 dryer procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fl_dryer_bb8700"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungbb8700-dryer-thermistor": "exhaust_thermistor",
    "samsungbb8700-dryer-door-switch": "door_switch",
    "samsungbb8700-dryer-heater-electric": "heating_element",
    "samsungbb8700-dryer-thermal-cutoff": "thermal_fuse",
    "samsungbb8700-dryer-motor-circuit": "drive_motor",
    "samsungbb8700-dryer-belt-cutoff": "belt_switch",
    "samsungbb8700-dryer-hmi": "user_interface",
    "samsungbb8700-dryer-power": "supply",
    "samsungbb8700-dryer-gas-valve": "gas_valve",
    "samsungbb8700-dryer-gas-ignitor": "igniter",
    "samsungbb8700-dryer-gas-flame-sensor": "flame_sensor",
}

KNOWLEDGE_EVIDENCE = {
    "samsungFlBb8700DryerHeaterOhms": ("heating_element", "confirm_heating_element_ol_heating_element_failed", "eliminate_heating_element_ol_heating_element_ok"),
    "samsungFlBb8700DryerGasValve12Ohms": ("gas_valve", "confirm_gas_valve_ol_gas_valve_failed", "eliminate_gas_valve_ol_gas_valve_ok"),
    "samsungFlBb8700DryerGasValve13Ohms": ("gas_valve", "confirm_gas_valve_ol_gas_valve_failed", "eliminate_gas_valve_ol_gas_valve_ok"),
    "samsungFlBb8700DryerGasValve45Ohms": ("gas_valve", "confirm_gas_valve_ol_gas_valve_failed", "eliminate_gas_valve_ol_gas_valve_ok"),
    "samsungFlBb8700DryerGasValve67Ohms": ("gas_valve", "confirm_gas_valve_ol_gas_valve_failed", "eliminate_gas_valve_ol_gas_valve_ok"),
    "samsungFlBb8700DryerIgnitorOhms": ("igniter", "confirm_igniter_ol_igniter_failed", "eliminate_igniter_ol_igniter_ok"),
    "samsungFlBb8700DryerHiLimitOhms": ("high_limit_thermostat", "confirm_high_limit_ol_high_limit_failed", "eliminate_high_limit_ol_high_limit_ok"),
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
            kind = branch.get("when", {}).get("kind", "")
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
    for path in sorted(SEED_DIR.glob("samsungbb8700-dryer-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")


if __name__ == "__main__":
    main()
