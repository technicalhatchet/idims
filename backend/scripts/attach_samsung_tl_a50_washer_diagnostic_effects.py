#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung TL A50 washer procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_tl_washer_a50"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungtla50-motor-circuit": "drive_motor",
    "samsungtla50-inlet-valves": "inlet_valve",
    "samsungtla50-drain-pump": "drain_pump",
    "samsungtla50-door-lock": "door_lock",
    "samsungtla50-water-level-sensor": "water_level_sensor",
    "samsungtla50-communication": "main_control",
    "samsungtla50-overflow": "water_level_sensor",
    "samsungtla50-power-supply": "supply",
}

KNOWLEDGE_EVIDENCE = {
    "samsungTlA50WasherMotorOhms": ("drive_motor", "confirm_drive_motor_ol_drive_motor_failed", "eliminate_drive_motor_ol_drive_motor_ok"),
    "samsungTlA50WasherInletValveOhms": ("inlet_valve", "confirm_inlet_valve_ol_inlet_valve_failed", "eliminate_inlet_valve_ol_inlet_valve_ok"),
    "samsungTlA50WasherDrainPumpOhms": ("drain_pump", "confirm_drain_pump_ol_drain_pump_failed", "eliminate_drain_pump_ol_drain_pump_ok"),
    "samsungTlA50WasherDoorReedOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungTlA50WasherDoorLockMotorOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "samsungTlA50WasherDoorLockContactOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
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
    for path in sorted(SEED_DIR.glob("samsungtla50-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
