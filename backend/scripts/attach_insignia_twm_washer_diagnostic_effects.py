#!/usr/bin/env python3
"""Attach diagnosticEffects to Insignia TWM41/TWM35 washer procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/insignia_washer_cap"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "insigniatwmcap-inlet-valves": "inlet_valve",
    "insigniatwmcap-drain-pump": "drain_pump",
    "insigniatwmcap-lid-switch": "lid_switch",
    "insigniatwmcap-unbalance": "suspension",
    "insigniatwmcap-level-sensor": "water_level_sensor",
    "insigniatwmcap-door-lock": "door_lock",
    "insigniatwmcap-pcb-failure": "acu",
    "insigniatwmcap-load-sensing": "drive_belt",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "inlet_valve": ("inlet_valve", "confirm_inlet_valve_ol_inlet_valve_failed", "eliminate_inlet_valve_ol_inlet_valve_ok"),
    "drain_pump": ("drain_pump", "confirm_drain_pump_ol_drain_pump_failed", "eliminate_drain_pump_ol_drain_pump_ok"),
    "lid_switch": ("lid_switch", "confirm_door_switch_no", "eliminate_door_switch_open_door_switch_ok"),
    "suspension": ("suspension", "confirm_unbalance_load", "eliminate_unbalance_load_ok"),
    "water_level_sensor": (
        "water_level_sensor",
        "confirm_water_level_sensor_5v_water_level_sensor_failed",
        "eliminate_water_level_sensor_5v_water_level_sensor_ok",
    ),
    "door_lock": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "acu": ("acu", "confirm_hmi_control_5v_hmi_control_failed", "eliminate_hmi_control_5v_hmi_control_ok"),
    "drive_belt": ("drive_belt", "confirm_drive_belt_worn", "eliminate_drive_belt_worn_ok"),
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "insigniaWasherCapInletValveOhms": COMPONENT_DEFAULT_EVIDENCE["inlet_valve"],
    "insigniaWasherCapDrainPumpOhms": COMPONENT_DEFAULT_EVIDENCE["drain_pump"],
    "insigniaWasherCapDoorLockOhms": COMPONENT_DEFAULT_EVIDENCE["door_lock"],
    "insigniaWasherCapLevelSensorOhms": COMPONENT_DEFAULT_EVIDENCE["water_level_sensor"],
}


def effect_for_branch(procedure_id: str, step: dict, branch: dict) -> list[dict]:
    when = branch.get("when") or {}
    kind = when.get("kind")
    if not kind:
        return []

    knowledge_id = step.get("measurementKnowledgeId")
    component_id = PROCEDURE_COMPONENT.get(procedure_id, "")
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        component_id, confirm_id, eliminate_id = KNOWLEDGE_EVIDENCE[knowledge_id]
    elif component_id and component_id in COMPONENT_DEFAULT_EVIDENCE:
        component_id, confirm_id, eliminate_id = COMPONENT_DEFAULT_EVIDENCE[component_id]
    else:
        return []

    if kind in FAIL_MEASUREMENT or (kind == "checkpoint_no" and branch.get("terminal")):
        return [{"type": "confirm", "componentId": component_id, "evidenceId": confirm_id}]
    if kind in PASS_MEASUREMENT or (kind == "checkpoint_yes" and not branch.get("terminal")):
        if branch.get("terminal"):
            return [{"type": "eliminate", "componentId": component_id, "evidenceId": eliminate_id}]
        return []
    if kind == "checkpoint_yes" and branch.get("nextStepId"):
        return []
    if kind == "checkpoint_no" and not branch.get("terminal"):
        return [{"type": "suspect", "componentId": component_id}]
    return []


def attach_effects(seed: dict) -> int:
    attached = 0
    procedure_id = seed.get("id", "")
    for step in seed.get("steps", []):
        for branch in step.get("branches", []) or []:
            if branch.get("diagnosticEffects"):
                continue
            effects = effect_for_branch(procedure_id, step, branch)
            if effects:
                branch["diagnosticEffects"] = effects
                attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("insigniatwmcap-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) updated")
        total += count
    print(f"Attached diagnosticEffects on {total} branches total.")


if __name__ == "__main__":
    main()
