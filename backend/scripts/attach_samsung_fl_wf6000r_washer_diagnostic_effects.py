#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung FL WF6000R washer procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fl_washer_wf6000r"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungwf6000r-motor-circuit": "drive_motor",
    "samsungwf6000r-wash-heater": "wash_heater",
    "samsungwf6000r-wash-thermistor": "wash_ntc",
    "samsungwf6000r-door-lock": "door_lock",
    "samsungwf6000r-water-level-sensor": "water_level_sensor",
    "samsungwf6000r-drain-pump": "drain_pump",
    "samsungwf6000r-inlet-valves": "inlet_valve",
    "samsungwf6000r-communication": "main_control",
    "samsungwf6000r-overflow": "water_level_sensor",
    "samsungwf6000r-power-supply": "supply",
}

KNOWLEDGE_EVIDENCE = {
    "samsungFlWf6000rWasherMotorOhms": ("drive_motor", "confirm_drive_motor_ol_drive_motor_failed", "eliminate_drive_motor_ol_drive_motor_ok"),
    "samsungFlWf6000rWasherHallSensorOhms": ("drive_motor", "confirm_drive_motor_ol_drive_motor_failed", "eliminate_drive_motor_ol_drive_motor_ok"),
    "samsungFlWf6000rWasherHeaterOhms": ("wash_heater", "confirm_wash_heater_ol_wash_heater_failed", "eliminate_wash_heater_ol_wash_heater_ok"),
    "samsungFlWf6000rWasherHeaterInCircuitOhms": ("wash_heater", "confirm_wash_heater_ol_wash_heater_failed", "eliminate_wash_heater_ol_wash_heater_ok"),
    "samsungFlWf6000rWasherThermistorOhms": ("wash_ntc", "confirm_wash_ntc_ol_wash_ntc_failed", "eliminate_wash_ntc_ol_wash_ntc_ok"),
    "samsungFlWf6000rWasherDoorSwitchOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungFlWf6000rWasherDoorLockOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungFlWf6000rWasherDoorLockMotorOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungFlWf6000rWasherWaterLevelFrequency": ("water_level_sensor", "confirm_water_level_sensor_failed", "eliminate_water_level_sensor_ok"),
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
    for path in sorted(SEED_DIR.glob("samsungwf6000r-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
