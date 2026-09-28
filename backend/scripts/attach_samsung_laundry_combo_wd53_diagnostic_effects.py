#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung WD53 laundry combo procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_laundry_combo"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungwd53-motor-circuit": "drive_motor",
    "samsungwd53-wash-heater": "wash_heater",
    "samsungwd53-wash-thermistor": "wash_ntc",
    "samsungwd53-door-lock": "door_lock",
    "samsungwd53-water-level-sensor": "water_level_sensor",
    "samsungwd53-drain-pump": "drain_pump",
    "samsungwd53-inlet-valves": "inlet_valve",
    "samsungwd53-communication": "main_control",
    "samsungwd53-overflow": "water_level_sensor",
    "samsungwd53-power-supply": "supply",
    "samsungwd53-heat-pump-thermistors": "compressor",
    "samsungwd53-dry-heater": "heating_element",
    "samsungwd53-compressor": "compressor",
}

KNOWLEDGE_EVIDENCE = {
    "samsungLaundryComboMotorOhms": ("drive_motor", "confirm_drive_motor_ol_drive_motor_failed", "eliminate_drive_motor_ol_drive_motor_ok"),
    "samsungLaundryComboWashHeaterOhms": ("wash_heater", "confirm_wash_heater_ol_wash_heater_failed", "eliminate_wash_heater_ol_wash_heater_ok"),
    "samsungLaundryComboWashHeaterInCircuitOhms": ("wash_heater", "confirm_wash_heater_ol_wash_heater_failed", "eliminate_wash_heater_ol_wash_heater_ok"),
    "samsungLaundryComboWashThermistorOhms": ("wash_ntc", "confirm_wash_ntc_ol_wash_ntc_failed", "eliminate_wash_ntc_ol_wash_ntc_ok"),
    "samsungLaundryComboDoorSwitchOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungLaundryComboDoorLockOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungLaundryComboWaterLevelFrequency": ("water_level_sensor", "confirm_water_level_sensor_failed", "eliminate_water_level_sensor_ok"),
    "samsungLaundryComboDrainPumpOhms": ("drain_pump", "confirm_drain_pump_ol_drain_pump_failed", "eliminate_drain_pump_ol_drain_pump_ok"),
    "samsungLaundryComboDuctThermistorOhms": ("condenser", "confirm_condenser_failed", "eliminate_condenser_ok"),
    "samsungLaundryComboEvaThermistorOhms": ("compressor", "confirm_compressor_failed", "eliminate_compressor_ok"),
    "samsungLaundryComboCompTopThermistorOhms": ("compressor", "confirm_compressor_failed", "eliminate_compressor_ok"),
    "samsungLaundryComboHeaterThermistorOhms": ("heating_element", "confirm_heating_element_failed", "eliminate_heating_element_ok"),
    "samsungLaundryComboDryHeaterOhms": ("heating_element", "confirm_heating_element_failed", "eliminate_heating_element_ok"),
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
    for path in sorted(SEED_DIR.glob("samsungwd53-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
