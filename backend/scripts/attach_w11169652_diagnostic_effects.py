#!/usr/bin/env python3
"""Attach diagnosticEffects to W11169652 procedure branches that lack them."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_fl_dd"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w11169652-test-01-acu-power": "supply",
    "w11169652-test-02-hmi": "hmi_control",
    "w11169652-test-03-motor": "drive_motor",
    "w11169652-test-04-door-lock": "door_lock",
    "w11169652-test-05-drum-light": "supply",
    "w11169652-test-06-inlet-valves": "inlet_valve",
    "w11169652-test-07-water-level-sensor": "water_level_sensor",
    "w11169652-test-08-drain-pump": "drain_pump",
    "w11169652-test-09-wash-heater": "wash_heater",
    "w11169652-test-10-wash-temp-sensor": "wash_ntc",
    "w11169652-test-11a-single-dose-dispenser": "dosing_pump",
    "w11169652-test-11b-dosing-pump": "dosing_pump",
    "w11169652-test-12a-bulk-dispenser": "bulk_level_switch",
    "w11169652-test-12b-bulk-level-sensing": "bulk_level_switch",
    "w11169652-test-13-vent-fan": "vent_fan",
    "w11169652-test-14-vent-baffle": "vent_baffle",
    "w11169652-test-15-dry-heater": "dry_heater",
    "w11169652-test-16-dry-temp-sensor": "dry_ntc",
    "w11169652-test-17-dry-blower": "dry_blower",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "supply": (
        "supply",
        "confirm_supply_critical_supply_fault",
        "eliminate_supply_critical_supply_ok",
    ),
    "hmi_control": (
        "hmi_control",
        "confirm_hmi_control_5v_hmi_control_failed",
        "eliminate_hmi_control_5v_hmi_control_ok",
    ),
    "drive_motor": (
        "drive_motor",
        "confirm_drive_motor_ol_drive_motor_failed",
        "eliminate_drive_motor_ol_drive_motor_ok",
    ),
    "door_lock": (
        "door_lock",
        "confirm_door_lock_open_door_lock_failed",
        "eliminate_door_lock_open_door_lock_ok",
    ),
    "inlet_valve": (
        "inlet_valve",
        "confirm_inlet_valve_ol_inlet_valve_failed",
        "eliminate_inlet_valve_ol_inlet_valve_ok",
    ),
    "drain_pump": (
        "drain_pump",
        "confirm_drain_pump_ol_drain_pump_failed",
        "eliminate_drain_pump_ol_drain_pump_ok",
    ),
    "wash_heater": (
        "wash_heater",
        "confirm_wash_heater_ol_wash_heater_failed",
        "eliminate_wash_heater_ol_wash_heater_ok",
    ),
    "water_level_sensor": (
        "water_level_sensor",
        "confirm_water_level_sensor_5v_water_level_sensor_failed",
        "eliminate_water_level_sensor_5v_water_level_sensor_ok",
    ),
    "wash_ntc": (
        "wash_ntc",
        "confirm_wash_ntc_ol_wash_ntc_failed",
        "eliminate_wash_ntc_ol_wash_ntc_ok",
    ),
    "dosing_pump": (
        "dosing_pump",
        "confirm_dosing_pump_ol_dosing_pump_failed",
        "eliminate_dosing_pump_ol_dosing_pump_ok",
    ),
    "bulk_level_switch": (
        "bulk_level_switch",
        "confirm_bulk_level_switch_ol_bulk_level_switch_failed",
        "eliminate_bulk_level_switch_ol_bulk_level_switch_ok",
    ),
    "vent_fan": (
        "vent_fan",
        "confirm_vent_fan_ol_vent_fan_failed",
        "eliminate_vent_fan_ol_vent_fan_ok",
    ),
    "vent_baffle": (
        "vent_baffle",
        "confirm_vent_baffle_ol_vent_baffle_failed",
        "eliminate_vent_baffle_ol_vent_baffle_ok",
    ),
    "dry_heater": (
        "dry_heater",
        "confirm_dry_heater_ol_dry_heater_failed",
        "eliminate_dry_heater_ol_dry_heater_ok",
    ),
    "dry_ntc": (
        "dry_ntc",
        "confirm_dry_ntc_ol_dry_ntc_failed",
        "eliminate_dry_ntc_ol_dry_ntc_ok",
    ),
    "dry_blower": (
        "dry_blower",
        "confirm_dry_blower_ol_dry_blower_failed",
        "eliminate_dry_blower_ol_dry_blower_ok",
    ),
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "supplyVoltage120": (
        "supply",
        "confirm_supply_critical_supply_fault",
        "eliminate_supply_critical_supply_ok",
    ),
    "whirlpoolFlWasherMotorOhms": (
        "drive_motor",
        "confirm_drive_motor_ol_drive_motor_failed",
        "eliminate_drive_motor_ol_drive_motor_ok",
    ),
    "whirlpoolFlWasherInletValveOhms": (
        "inlet_valve",
        "confirm_inlet_valve_ol_inlet_valve_failed",
        "eliminate_inlet_valve_ol_inlet_valve_ok",
    ),
    "whirlpoolFlWasherDrainPumpOhms": (
        "drain_pump",
        "confirm_drain_pump_ol_drain_pump_failed",
        "eliminate_drain_pump_ol_drain_pump_ok",
    ),
    "whirlpoolFlWasherRecircPumpOhms": (
        "drain_pump",
        "confirm_drain_pump_ol_drain_pump_failed",
        "eliminate_drain_pump_ol_drain_pump_ok",
    ),
    "whirlpoolFlWasherHeaterOhms": (
        "wash_heater",
        "confirm_wash_heater_ol_wash_heater_failed",
        "eliminate_wash_heater_ol_wash_heater_ok",
    ),
    "whirlpoolFlWasherDoorLockSwitchLockedOhms": (
        "door_lock",
        "confirm_door_lock_open_door_lock_failed",
        "eliminate_door_lock_open_door_lock_ok",
    ),
    "whirlpoolFlWasherDoorLockSolenoidOhms": (
        "door_lock",
        "confirm_door_lock_open_door_lock_failed",
        "eliminate_door_lock_open_door_lock_ok",
    ),
    "whirlpoolFlWasherHmi5Vdc": (
        "hmi_control",
        "confirm_hmi_control_5v_hmi_control_failed",
        "eliminate_hmi_control_5v_hmi_control_ok",
    ),
    "whirlpoolFlWasherHmi12Vdc": (
        "hmi_control",
        "confirm_hmi_control_12v_hmi_control_failed",
        "eliminate_hmi_control_12v_hmi_control_ok",
    ),
    "whirlpoolFlWasherDrumLightVdc": (
        "supply",
        "confirm_supply_critical_supply_fault",
        "eliminate_supply_critical_supply_ok",
    ),
    "whirlpoolFlWasherAps5Vdc": (
        "water_level_sensor",
        "confirm_water_level_sensor_5v_water_level_sensor_failed",
        "eliminate_water_level_sensor_5v_water_level_sensor_ok",
    ),
    "whirlpoolFlWasherWashNtcOhms": (
        "wash_ntc",
        "confirm_wash_ntc_ol_wash_ntc_failed",
        "eliminate_wash_ntc_ol_wash_ntc_ok",
    ),
    "whirlpoolFlWasherDosingPumpOhms": (
        "dosing_pump",
        "confirm_dosing_pump_ol_dosing_pump_failed",
        "eliminate_dosing_pump_ol_dosing_pump_ok",
    ),
    "whirlpoolFlWasherBulkLevelSwitchClosedOhms": (
        "bulk_level_switch",
        "confirm_bulk_level_switch_ol_bulk_level_switch_failed",
        "eliminate_bulk_level_switch_ol_bulk_level_switch_ok",
    ),
    "whirlpoolFlWasherVentFanOhms": (
        "vent_fan",
        "confirm_vent_fan_ol_vent_fan_failed",
        "eliminate_vent_fan_ol_vent_fan_ok",
    ),
    "whirlpoolFlWasherVentBaffleSolenoidOhms": (
        "vent_baffle",
        "confirm_vent_baffle_ol_vent_baffle_failed",
        "eliminate_vent_baffle_ol_vent_baffle_ok",
    ),
    "whirlpoolFlWasherDryHeater1100WOms": (
        "dry_heater",
        "confirm_dry_heater_ol_dry_heater_failed",
        "eliminate_dry_heater_ol_dry_heater_ok",
    ),
    "whirlpoolFlWasherDryHeater450WOms": (
        "dry_heater",
        "confirm_dry_heater_ol_dry_heater_failed",
        "eliminate_dry_heater_ol_dry_heater_ok",
    ),
    "whirlpoolFlWasherDryNtcOhms": (
        "dry_ntc",
        "confirm_dry_ntc_ol_dry_ntc_failed",
        "eliminate_dry_ntc_ol_dry_ntc_ok",
    ),
    "whirlpoolFlWasherDryBlowerOhms": (
        "dry_blower",
        "confirm_dry_blower_ol_dry_blower_failed",
        "eliminate_dry_blower_ol_dry_blower_ok",
    ),
}

def evidence_for_measurement(knowledge_id: str | None, fallback_component: str) -> tuple[str, str, str]:
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        return KNOWLEDGE_EVIDENCE[knowledge_id]
    return COMPONENT_DEFAULT_EVIDENCE.get(
        fallback_component,
        (fallback_component, "", ""),
    )


def evidence_for_component(component: str) -> tuple[str, str, str]:
    return COMPONENT_DEFAULT_EVIDENCE.get(component, (component, "", ""))


def confirm_effect(component_id: str, evidence_id: str) -> dict:
    return {"type": "confirm", "componentId": component_id, "evidenceId": evidence_id}


def eliminate_effect(component_id: str, evidence_id: str) -> dict:
    return {"type": "eliminate", "componentId": component_id, "evidenceId": evidence_id}


def suspect_effect(component_id: str) -> dict:
    return {"type": "suspect", "componentId": component_id}


def is_failure_outcome(step: dict | None) -> bool:
    if not step or step.get("type") != "outcome":
        return False
    title = f"{step.get('title', '')} {step.get('oemOutcome', '')}".lower()
    return any(token in title for token in ("replace", "fault", "failed", "repair acu", "replace acu"))


def is_success_outcome(step: dict | None) -> bool:
    if not step or step.get("type") != "outcome":
        return False
    title = f"{step.get('title', '')} {step.get('oemOutcome', '')}".lower()
    return any(token in title for token in ("verified", "operates", "good", "pass", "retest"))


def attach_branch_effects(
    seed: dict,
    step: dict,
    branch: dict,
    fallback_component: str,
    steps_by_id: dict[str, dict],
) -> bool:
    if branch.get("diagnosticEffects"):
        return False

    kind = (branch.get("when") or {}).get("kind")
    next_step = steps_by_id.get(branch.get("nextStepId", ""))
    terminal = bool(branch.get("terminal")) or (
        next_step and next_step.get("type") == "outcome" and branch.get("nextStepId")
    )

    if step.get("type") == "measurement":
        component, confirm_id, eliminate_id = evidence_for_measurement(
            step.get("measurementKnowledgeId"),
            fallback_component,
        )
        if kind in FAIL_MEASUREMENT and confirm_id:
            branch["diagnosticEffects"] = [confirm_effect(component, confirm_id)]
            return True
        if kind in PASS_MEASUREMENT and eliminate_id:
            branch["diagnosticEffects"] = [eliminate_effect(component, eliminate_id)]
            return True
        return False

    if step.get("type") == "visual_check":
        component, confirm_id, eliminate_id = evidence_for_component(fallback_component)
        if kind == "checkpoint_no" and terminal and is_failure_outcome(next_step) and confirm_id:
            branch["diagnosticEffects"] = [confirm_effect(component, confirm_id)]
            return True
        if kind == "checkpoint_no" and terminal and confirm_id:
            branch["diagnosticEffects"] = [confirm_effect(component, confirm_id)]
            return True
        if kind == "checkpoint_yes" and terminal and is_success_outcome(next_step) and eliminate_id:
            branch["diagnosticEffects"] = [eliminate_effect(component, eliminate_id)]
            return True
        if kind == "checkpoint_no" and not terminal:
            branch["diagnosticEffects"] = [suspect_effect(component)]
            return True
        return False

    return False


def attach_seed(seed: dict) -> int:
    procedure_id = seed.get("id", "")
    fallback_component = PROCEDURE_COMPONENT.get(procedure_id, "")
    if not fallback_component:
        return 0

    if seed.get("componentIds") != [fallback_component]:
        seed["componentIds"] = [fallback_component]

    steps_by_id = {step["id"]: step for step in seed.get("steps", []) if "id" in step}
    attached = 0

    for step in seed.get("steps", []):
        for branch in step.get("branches", []) or []:
            if attach_branch_effects(seed, step, branch, fallback_component, steps_by_id):
                attached += 1

    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w11169652-test-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_seed(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) updated")
        total += count
    print(f"Attached diagnosticEffects on {total} branches total.")


if __name__ == "__main__":
    main()
