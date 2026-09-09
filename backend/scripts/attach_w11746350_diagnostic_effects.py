#!/usr/bin/env python3
"""Attach diagnosticEffects to W11746350 freestanding range procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_freestanding_range"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w11746350-acu-power": "supply",
    "w11746350-hmi": "supply",
    "w11746350-oven-sensor": "temp_sensor",
    "w11746350-door-latch": "temp_sensor",
    "w11746350-vent-fan": "convection_fan",
    "w11746350-bake-element": "bake_element",
    "w11746350-broil-element": "broil_element",
    "w11746350-convect-element": "convection_fan",
    "w11746350-dsi-gas-valve": "gas_valve",
    "w11746350-surface-spark": "surface_ignition",
    "w11746350-bridge-element": "bake_element",
    "w11746350-thermal-fuse": "supply",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "supply": ("supply", "confirm_l1_l2_critical_supply_fault", "eliminate_l1_l2_critical_supply_ok"),
    "temp_sensor": ("temp_sensor", "confirm_temp_sensor_bad_temp_sensor_failed", "eliminate_temp_sensor_bad_temp_sensor_ok"),
    "bake_element": ("bake_element", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_normal_bake_element_ok"),
    "broil_element": ("broil_element", "confirm_broil_element_ol_broil_element_failed", "eliminate_broil_element_normal_broil_element_ok"),
    "convection_fan": ("convection_fan", "confirm_convection_bad_convection_fan_failed", "eliminate_convection_bad_convection_fan_ok"),
    "gas_valve": ("gas_valve", "confirm_gas_valve_ol_gas_valve_failed", "eliminate_gas_valve_ol_gas_valve_ok"),
    "surface_ignition": ("surface_ignition", "confirm_igniter_ol_igniter_failed", "eliminate_igniter_ol_igniter_ok"),
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "supplyVoltage240": COMPONENT_DEFAULT_EVIDENCE["supply"],
    "whirlpoolFreestandingRangeOvenSensorOhms": COMPONENT_DEFAULT_EVIDENCE["temp_sensor"],
    "whirlpoolFreestandingRangeDoorLatchOhms": COMPONENT_DEFAULT_EVIDENCE["temp_sensor"],
    "whirlpoolFreestandingRangeHiddenBakeOhms": COMPONENT_DEFAULT_EVIDENCE["bake_element"],
    "broilElementOhms": COMPONENT_DEFAULT_EVIDENCE["broil_element"],
    "whirlpoolFreestandingRangeConvectElementOhms": COMPONENT_DEFAULT_EVIDENCE["convection_fan"],
    "whirlpoolFreestandingRangeConvectFanOhms": COMPONENT_DEFAULT_EVIDENCE["convection_fan"],
    "whirlpoolFreestandingRangeDsiValveOhms": COMPONENT_DEFAULT_EVIDENCE["gas_valve"],
    "whirlpoolFreestandingRangeBridgeOuterOhms": COMPONENT_DEFAULT_EVIDENCE["bake_element"],
    "whirlpoolFreestandingRangeBridgeInnerOhms": COMPONENT_DEFAULT_EVIDENCE["bake_element"],
    "whirlpoolFreestandingRangeSingleElementOhms": COMPONENT_DEFAULT_EVIDENCE["bake_element"],
    "whirlpoolFreestandingRangeWarmingZoneOhms": COMPONENT_DEFAULT_EVIDENCE["bake_element"],
}


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
    return any(token in title for token in ("verified", "operates", "good", "pass", "ok", "clear"))


def evidence_for_measurement(knowledge_id: str | None, fallback: str) -> tuple[str, str, str]:
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        return KNOWLEDGE_EVIDENCE[knowledge_id]
    return COMPONENT_DEFAULT_EVIDENCE.get(fallback, (fallback, "", ""))


def evidence_for_component(component: str) -> tuple[str, str, str]:
    return COMPONENT_DEFAULT_EVIDENCE.get(component, (component, "", ""))


def attach_branch_effects(step, branch, fallback, steps_by_id) -> bool:
    if branch.get("diagnosticEffects"):
        return False
    kind = (branch.get("when") or {}).get("kind")
    next_step = steps_by_id.get(branch.get("nextStepId", ""))
    terminal = bool(branch.get("terminal")) or (next_step and next_step.get("type") == "outcome")

    if step.get("type") == "measurement":
        component, confirm_id, eliminate_id = evidence_for_measurement(step.get("measurementKnowledgeId"), fallback)
        if kind in FAIL_MEASUREMENT and confirm_id:
            branch["diagnosticEffects"] = [confirm_effect(component, confirm_id)]
            return True
        if kind in PASS_MEASUREMENT and eliminate_id:
            branch["diagnosticEffects"] = [eliminate_effect(component, eliminate_id)]
            return True
        return False

    if step.get("type") == "visual_check":
        component, confirm_id, eliminate_id = evidence_for_component(fallback)
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


def attach_seed(seed: dict) -> int:
    procedure_id = seed.get("id", "")
    fallback = PROCEDURE_COMPONENT.get(procedure_id, "")
    if not fallback:
        return 0
    if seed.get("componentIds") != [fallback]:
        seed["componentIds"] = [fallback]
    steps_by_id = {s["id"]: s for s in seed.get("steps", []) if "id" in s}
    attached = 0
    for step in seed.get("steps", []):
        for branch in step.get("branches", []) or []:
            if attach_branch_effects(step, branch, fallback, steps_by_id):
                attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w11746350-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_seed(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) updated")
        total += count
    print(f"Attached diagnosticEffects on {total} branches total.")


if __name__ == "__main__":
    main()
