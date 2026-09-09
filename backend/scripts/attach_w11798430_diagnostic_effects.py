#!/usr/bin/env python3
"""Attach diagnosticEffects to W11798430 ACU top-load dryer (WED4100) procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_acu_tl_dryer"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w11798430-acu-power": "acu",
    "w11798430-supply-connections": "supply",
    "w11798430-motor-circuit": "motor",
    "w11798430-heater-electric": "heating_element",
    "w11798430-heater-gas": "gas_valve",
    "w11798430-thermistors": "exhaust_thermistor",
    "w11798430-thermal-fuse": "thermal_fuse",
    "w11798430-thermal-cutoff": "thermal_cutoff",
    "w11798430-gas-valve": "gas_valve",
    "w11798430-hmi": "user_interface",
    "w11798430-door-switch": "door_switch",
    "w11798430-drum-light": "drum_light",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "acu": ("acu", "ed_kw_f1e1_ccu", "eliminate_heater_ol_heating_element_ok"),
    "supply": ("supply", "confirm_supply_critical_supply_fault", "eliminate_supply_critical_supply_ok"),
    "user_interface": ("user_interface", "ed_kw_f2e1_ui", "eliminate_heater_ol_heating_element_ok"),
    "door_switch": ("door_switch", "confirm_door_switch_no", "eliminate_motor_ol_motor_ok"),
    "motor": ("motor", "confirm_motor_ol_motor_failed", "eliminate_motor_ol_motor_ok"),
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
    "thermal_cutoff": (
        "thermal_cutoff",
        "confirm_thermal_cutoff_open",
        "eliminate_thermal_fuse_open_thermal_fuse_ok",
    ),
    "gas_valve": (
        "gas_valve",
        "confirm_gas_valve_ol_gas_valve_failed",
        "eliminate_gas_valve_ol_gas_valve_ok",
    ),
    "drum_light": (
        "drum_light",
        "confirm_drum_light_bad",
        "eliminate_drum_light_ok",
    ),
    "steam_valve": (
        "steam_valve",
        "confirm_steam_valve_bad",
        "eliminate_steam_valve_ok",
    ),
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "dryerMotorCircuitOhms": ("motor", "confirm_motor_ol_motor_failed", "eliminate_motor_ol_motor_ok"),
    "dryerDrumMotorWindingOhms": ("motor", "confirm_motor_ol_motor_failed", "eliminate_motor_ol_motor_ok"),
    "whirlpoolAcuTlDryerHeaterOhms": (
        "heating_element",
        "confirm_heater_ol_heating_element_failed",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "dryerExhaustThermistorOhms": (
        "exhaust_thermistor",
        "confirm_exhaust_thermistor_bad",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "dryerInletThermistorOhmsElectric": (
        "inlet_thermistor",
        "confirm_inlet_thermistor_bad",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "dryerInletThermistorOhmsGas": (
        "inlet_thermistor",
        "confirm_inlet_thermistor_bad",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "gasValveCoilOhms": (
        "gas_valve",
        "confirm_gas_valve_ol_gas_valve_failed",
        "eliminate_gas_valve_ol_gas_valve_ok",
    ),
    "hotSurfaceIgniterOhms": (
        "igniter",
        "confirm_igniter_ol_igniter_failed",
        "eliminate_igniter_ol_igniter_ok",
    ),
    "whirlpoolAcuTlDryer4100MotorMainWindingOhms": ("motor", "confirm_motor_ol_motor_failed", "eliminate_motor_ol_motor_ok"),
    "whirlpoolAcuTlDryer4100MotorStartWindingOhms": ("motor", "confirm_motor_ol_motor_failed", "eliminate_motor_ol_motor_ok"),
    "whirlpoolAcuTlDryer4100IgniterOhms": (
        "igniter",
        "confirm_igniter_ol_igniter_failed",
        "eliminate_igniter_ol_igniter_ok",
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
            if branch.get("diagnosticEffects"):
                continue
            effects = effect_for_branch(procedure_id, step, branch)
            if effects:
                branch["diagnosticEffects"] = effects
                attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w11798430-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
