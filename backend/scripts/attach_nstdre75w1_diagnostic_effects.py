#!/usr/bin/env python3
"""Attach diagnosticEffects to NS-TDRE75W1 procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/insignia_dryer_tdre"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "nstdre75w1-outlet-thermistor": "exhaust_thermistor",
    "nstdre75w1-humidity-sensor": "moisture_sensor",
    "nstdre75w1-communication": "user_interface",
    "nstdre75w1-heater-electric": "heating_element",
    "nstdre75w1-heater-gas": "gas_valve",
    "nstdre75w1-thermal-cutoff": "thermal_cutoff",
    "nstdre75w1-thermal-hi-limit": "thermal_fuse",
    "nstdre75w1-gas-ignitor": "igniter",
    "nstdre75w1-gas-valve": "gas_valve",
    "nstdre75w1-flame-sensor": "flame_sensor",
    "nstdre75w1-door-switch": "door_switch",
    "nstdre75w1-belt-safety": "motor",
    "nstdre75w1-hmi-test": "user_interface",
    "nstdre75w1-motor-circuit": "motor",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "motor": ("motor", "confirm_motor_ol_motor_failed", "eliminate_motor_ol_motor_ok"),
    "user_interface": ("user_interface", "ed_kw_f2e1_ui", "eliminate_heater_ol_heating_element_ok"),
    "door_switch": ("door_switch", "confirm_door_switch_no", "eliminate_motor_ol_motor_ok"),
    "heating_element": (
        "heating_element",
        "confirm_heater_ol_heating_element_failed",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "exhaust_thermistor": (
        "exhaust_thermistor",
        "confirm_exhaust_thermistor_bad",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "moisture_sensor": (
        "moisture_sensor",
        "confirm_moisture_sensor_bad",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "thermal_fuse": (
        "thermal_fuse",
        "confirm_thermal_fuse_open_thermal_fuse_failed",
        "eliminate_thermal_fuse_open_thermal_fuse_ok",
    ),
    "thermal_cutoff": ("thermal_cutoff", "confirm_thermal_cutoff_open", "eliminate_thermal_fuse_open_thermal_fuse_ok"),
    "igniter": ("igniter", "confirm_igniter_ol_igniter_failed", "eliminate_igniter_ol_igniter_ok"),
    "gas_valve": ("gas_valve", "confirm_gas_valve_ol_gas_valve_failed", "eliminate_gas_valve_ol_gas_valve_ok"),
    "flame_sensor": (
        "flame_sensor",
        "confirm_flame_sensor_ol",
        "eliminate_igniter_ol_igniter_ok",
    ),
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "insigniaDryerHeaterOhms": (
        "heating_element",
        "confirm_heater_ol_heating_element_failed",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "insigniaDryerOutletThermistorKohm": (
        "exhaust_thermistor",
        "confirm_exhaust_thermistor_bad",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "hotSurfaceIgniterOhms": (
        "igniter",
        "confirm_igniter_ol_igniter_failed",
        "eliminate_igniter_ol_igniter_ok",
    ),
    "gasValveCoilOhms": (
        "gas_valve",
        "confirm_gas_valve_ol_gas_valve_failed",
        "eliminate_gas_valve_ol_gas_valve_ok",
    ),
}


def effect_for_branch(procedure_id: str, step: dict, branch: dict) -> list[dict]:
    when = branch.get("when") or {}
    kind = when.get("kind")
    if not kind:
        return []

    knowledge_id = step.get("measurementKnowledgeId")
    component_id = PROCEDURE_COMPONENT.get(procedure_id)
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        component_id, confirm_id, eliminate_id = KNOWLEDGE_EVIDENCE[knowledge_id]
    elif component_id and component_id in COMPONENT_DEFAULT_EVIDENCE:
        component_id, confirm_id, eliminate_id = COMPONENT_DEFAULT_EVIDENCE[component_id]
    else:
        return []

    if kind in FAIL_MEASUREMENT or (kind == "checkpoint_no" and branch.get("terminal")):
        return [{"type": "confirm", "componentId": component_id, "evidenceId": confirm_id}]
    if kind in PASS_MEASUREMENT or kind == "checkpoint_yes":
        if branch.get("terminal"):
            return [{"type": "eliminate", "componentId": component_id, "evidenceId": eliminate_id}]
        return []
    return []


def attach_effects(seed: dict) -> int:
    attached = 0
    procedure_id = seed.get("id", "")
    for step in seed.get("steps", []):
        for branch in step.get("branches", []):
            effects = effect_for_branch(procedure_id, step, branch)
            if effects:
                branch["diagnosticEffects"] = effects
                attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("nstdre75w1-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branches")
        total += count
    print(f"Total: {total} diagnostic effects")


if __name__ == "__main__":
    main()
