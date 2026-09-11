#!/usr/bin/env python3
"""Attach diagnosticEffects to W11697231 procedure branches that lack them."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_tl_dd"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w11697231-test-01-acu-power": "supply",
    "w11697231-test-02-valves": "inlet_valve",
    "w11697231-test-03-drive-system": "drive_motor",
    "w11697231-test-03a-shifter": "drive_motor",
    "w11697231-test-03b-motor": "drive_motor",
    "w11697231-test-04-console-indicators": "hmi_control",
    "w11697231-test-05-temp-thermistor": "wash_ntc",
    "w11697231-test-06-water-level": "water_level_sensor",
    "w11697231-test-07-drain-pump": "drain_pump",
    "w11697231-test-08-lid-lock": "door_lock",
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
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "supplyVoltage120": COMPONENT_DEFAULT_EVIDENCE["supply"],
    "whirlpoolWtw4950WasherAcu12Vdc": COMPONENT_DEFAULT_EVIDENCE["hmi_control"],
    "whirlpoolWtw4950WasherMotorWindingOhms": COMPONENT_DEFAULT_EVIDENCE["drive_motor"],
    "whirlpoolWtw4950WasherShifterOhms": COMPONENT_DEFAULT_EVIDENCE["drive_motor"],
    "whirlpoolWtw4950WasherInletValveOhms": COMPONENT_DEFAULT_EVIDENCE["inlet_valve"],
    "whirlpoolWtw4950WasherDrainPumpOhms": COMPONENT_DEFAULT_EVIDENCE["drain_pump"],
    "whirlpoolWtw4950WasherLidLockSolenoidOhms": COMPONENT_DEFAULT_EVIDENCE["door_lock"],
    "whirlpoolWtw4950WasherInletThermistorOhms": COMPONENT_DEFAULT_EVIDENCE["wash_ntc"],
}


def evidence_for_measurement(knowledge_id: str | None, fallback_component: str) -> tuple[str, str, str]:
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        return KNOWLEDGE_EVIDENCE[knowledge_id]
    return COMPONENT_DEFAULT_EVIDENCE.get(fallback_component, (fallback_component, "", ""))


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
    return any(token in title for token in ("replace", "fault", "failed", "repair"))


def is_success_outcome(step: dict | None) -> bool:
    if not step or step.get("type") != "outcome":
        return False
    title = f"{step.get('title', '')} {step.get('oemOutcome', '')}".lower()
    return any(token in title for token in ("verified", "operates", "good", "pass", "retest", "ok"))


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
    for path in sorted(SEED_DIR.glob("w11697231-test-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_seed(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) updated")
        total += count
    print(f"Attached diagnosticEffects on {total} branches total.")


if __name__ == "__main__":
    main()
