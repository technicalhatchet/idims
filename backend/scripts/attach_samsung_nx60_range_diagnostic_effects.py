#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung NX60 range procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_range_nx60"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "samsungnx60-power": "supply",
    "samsungnx60-oven-sensor": "thermistor",
    "samsungnx60-heater-relays": "main_control",
    "samsungnx60-door-lock": "door_lock",
    "samsungnx60-touch-comm": "display_panel",
    "samsungnx60-cooling-fan": "convection_fan",
    "samsungnx60-bake-ignitor": "igniter",
    "samsungnx60-broil-ignitor": "igniter",
    "samsungnx60-safety-valve": "gas_valve",
    "samsungnx60-convection-fan": "convection_fan",
    "samsungnx60-oven-lamp": "heater",
    "samsungnx60-hmi-touch": "display_panel",
    "samsungnx60-spark-module": "surface_ignition",
    "samsungnx60-bake-element": "bake_element",
    "samsungnx60-broil-element": "broil_element",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "supplyVoltage120": ("supply", "confirm_supply_critical_supply_fault", "eliminate_supply_critical_supply_ok"),
    "samsungNx60OvenSensorOhms": ("thermistor", "confirm_temp_sensor_ol_temp_sensor_failed", "eliminate_temp_sensor_ol_temp_sensor_ok"),
    "ovenTempSensorOhms": ("thermistor", "confirm_temp_sensor_ol_temp_sensor_failed", "eliminate_temp_sensor_ol_temp_sensor_ok"),
    "samsungNx60OvenIgnitorOhms": ("igniter", "confirm_igniter_ol_igniter_failed", "eliminate_igniter_ol_igniter_ok"),
    "hotSurfaceIgniterOhms": ("igniter", "confirm_igniter_ol_igniter_failed", "eliminate_igniter_ol_igniter_ok"),
    "samsungNx60GasSafetyValveAmps": ("gas_valve", "confirm_gas_valve_coil_open_gas_valve_failed", "eliminate_gas_valve_coil_open_gas_valve_ok"),
    "samsungNx60DoorLockMotorOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungNx60ConvectionFanOhms": ("convection_fan", "confirm_convection_bad_convection_fan_failed", "eliminate_convection_bad_convection_fan_ok"),
    "samsungNx60HeaterRelayContactsOhms": ("main_control", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "bakeElementOhms": ("bake_element", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "broilElementOhms": ("broil_element", "confirm_broil_element_ol_broil_element_failed", "eliminate_broil_element_ol_broil_element_ok"),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "display_panel": ("display_panel", "gr_ms_011_no_oven_heat_supply_critical", "eliminate_supply_critical_supply_ok"),
    "surface_ignition": ("surface_ignition", "confirm_igniter_ol_igniter_failed", "eliminate_igniter_ol_igniter_ok"),
}


def effect_for_branch(procedure_id: str, step: dict, branch: dict) -> list[dict]:
    when = branch.get("when") or {}
    kind = when.get("kind")
    if not kind:
        return []

    knowledge_id = step.get("measurementKnowledgeId")
    component_id = PROCEDURE_COMPONENT.get(procedure_id, "")
    confirm_id = ""
    eliminate_id = ""

    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        component_id, confirm_id, eliminate_id = KNOWLEDGE_EVIDENCE[knowledge_id]
    elif component_id and component_id in CHECKPOINT_EVIDENCE:
        component_id, confirm_id, eliminate_id = CHECKPOINT_EVIDENCE[component_id]

    if not confirm_id:
        return []

    if kind in FAIL_MEASUREMENT or (kind == "checkpoint_no" and branch.get("terminal")):
        return [{"type": "confirm", "componentId": component_id, "evidenceId": confirm_id}]
    if kind in PASS_MEASUREMENT and branch.get("terminal"):
        return [{"type": "eliminate", "componentId": component_id, "evidenceId": eliminate_id}]
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
    for path in sorted(SEED_DIR.glob("samsungnx60-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
