#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung FlexWash washer procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_flexwash"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungflexwash-motor-circuit": "drive_motor",
    "samsungflexwash-upper-motor": "drive_motor",
    "samsungflexwash-inlet-valves": "inlet_valve",
    "samsungflexwash-drain-pump": "drain_pump",
    "samsungflexwash-door-lock": "door_lock",
    "samsungflexwash-upper-door": "door_lock",
    "samsungflexwash-water-level-sensor": "water_level_sensor",
    "samsungflexwash-communication": "main_control",
    "samsungflexwash-wifi-communication": "main_control",
    "samsungflexwash-inverter-communication": "inverter",
    "samsungflexwash-interload-communication": "main_control",
    "samsungflexwash-wash-heater": "wash_heater",
    "samsungflexwash-overflow": "water_level_sensor",
    "samsungflexwash-power-supply": "supply",
    "samsungflexwash-inverter-thermal": "inverter",
    "samsungflexwash-system-fault": "main_control",
}

KNOWLEDGE_EVIDENCE = {
    "samsungFlexWashMotorOhms": ("drive_motor", "confirm_drive_motor_ol_drive_motor_failed", "eliminate_drive_motor_ol_drive_motor_ok"),
    "samsungFlexWashInletValveOhms": ("inlet_valve", "confirm_inlet_valve_ol_inlet_valve_failed", "eliminate_inlet_valve_ol_inlet_valve_ok"),
    "samsungFlexWashDrainPumpOhms": ("drain_pump", "confirm_drain_pump_ol_drain_pump_failed", "eliminate_drain_pump_ol_drain_pump_ok"),
    "samsungFlexWashHeaterOhms": ("wash_heater", "confirm_wash_heater_ol_wash_heater_failed", "eliminate_wash_heater_ol_wash_heater_ok"),
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
    for path in sorted(SEED_DIR.glob("samsungflexwash-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
