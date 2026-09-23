#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung NE58 electric range procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_range_ne58"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "samsungne58-power": "supply",
    "samsungne58-oven-sensor": "thermistor",
    "samsungne58-heater-relays": "main_control",
    "samsungne58-door-lock": "door_lock",
    "samsungne58-hmi-touch": "display_panel",
    "samsungne58-convection-fan": "convection_fan",
    "samsungne58-bake-element": "bake_element",
    "samsungne58-broil-element": "broil_element",
    "samsungne58-convection-element": "convection_element",
    "samsungne58-door-switch": "door_switch",
    "samsungne58-thermal-cutoff": "thermal_fuse",
    "samsungne58-surface-radiant": "surface_element",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "supplyVoltage120": ("supply", "confirm_supply_critical_supply_fault", "eliminate_supply_critical_supply_ok"),
    "samsungNx60OvenSensorOhms": ("thermistor", "confirm_temp_sensor_ol_temp_sensor_failed", "eliminate_temp_sensor_ol_temp_sensor_ok"),
    "samsungNx60ConvectionFanOhms": ("convection_fan", "confirm_convection_bad_convection_fan_failed", "eliminate_convection_bad_convection_fan_ok"),
    "samsungNx60HeaterRelayContactsOhms": ("main_control", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "samsungNx60DoorLockMotorOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "bakeElementOhms": ("bake_element", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "broilElementOhms": ("broil_element", "confirm_broil_element_ol_broil_element_failed", "eliminate_broil_element_ol_broil_element_ok"),
}


def effect_for_branch(procedure_id: str, step: dict, branch: dict) -> list[dict]:
    when = branch.get("when") or {}
    kind = when.get("kind")
    if not kind:
        return []

    knowledge_id = step.get("measurementKnowledgeId")
    component_id = PROCEDURE_COMPONENT.get(procedure_id, "")
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        comp, fail_id, pass_id = KNOWLEDGE_EVIDENCE[knowledge_id]
        if kind in FAIL_MEASUREMENT:
            return [{"type": "confirm", "componentId": comp, "evidenceId": fail_id}]
        if kind in PASS_MEASUREMENT:
            return [{"type": "eliminate", "componentId": comp, "evidenceId": pass_id}]
    return []


def attach_file(path: Path) -> None:
    proc = json.loads(path.read_text(encoding="utf-8"))
    for step in proc.get("steps", []):
        for branch in step.get("branches") or []:
            effects = effect_for_branch(proc["id"], step, branch)
            if effects:
                branch["diagnosticEffects"] = effects
    path.write_text(json.dumps(proc, indent=2) + "\n", encoding="utf-8")
    print(f"Attached effects: {path.name}")


def main() -> None:
    for path in sorted(SEED_DIR.glob("samsungne58-*.json")):
        attach_file(path)


if __name__ == "__main__":
    main()
