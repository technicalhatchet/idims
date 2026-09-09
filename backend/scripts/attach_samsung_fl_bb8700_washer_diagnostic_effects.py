#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung FL BB8700 washer procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fl_washer_bb8700"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungbb8700-motor-circuit": "drive_motor",
    "samsungbb8700-wash-heater": "wash_heater",
    "samsungbb8700-wash-thermistor": "wash_ntc",
    "samsungbb8700-door-lock": "door_lock",
    "samsungbb8700-water-level-sensor": "water_level_sensor",
    "samsungbb8700-drain-pump": "drain_pump",
    "samsungbb8700-inlet-valves": "inlet_valve",
    "samsungbb8700-communication": "main_control",
    "samsungbb8700-overflow": "water_level_sensor",
    "samsungbb8700-power-supply": "supply",
}

KNOWLEDGE_EVIDENCE = {
    "samsungFlBb8700WasherMotorOhms": ("drive_motor", "confirm_drive_motor_ol_drive_motor_failed", "eliminate_drive_motor_ol_drive_motor_ok"),
    "samsungFlBb8700WasherHeaterOhms": ("wash_heater", "confirm_wash_heater_ol_wash_heater_failed", "eliminate_wash_heater_ol_wash_heater_ok"),
    "samsungFlBb8700WasherHeaterInCircuitOhms": ("wash_heater", "confirm_wash_heater_ol_wash_heater_failed", "eliminate_wash_heater_ol_wash_heater_ok"),
    "samsungFlBb8700WasherThermistorOhms": ("wash_ntc", "confirm_wash_ntc_ol_wash_ntc_failed", "eliminate_wash_ntc_ol_wash_ntc_ok"),
    "samsungFlBb8700WasherDoorSwitchOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungFlBb8700WasherDoorLockOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungFlBb8700WasherDoorLockMotorOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
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
    for path in sorted(SEED_DIR.glob("samsungbb8700-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
