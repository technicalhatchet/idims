#!/usr/bin/env python3
"""Attach diagnosticEffects to W11633848 dishwasher procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_dishwasher_acu"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w11633848-acu-power": "supply",
    "w11633848-triac-fuse": "supply",
    "w11633848-door-switch": "door_gasket",
    "w11633848-fill-valve": "inlet_valve",
    "w11633848-dispenser": "inlet_valve",
    "w11633848-heater": "heater",
    "w11633848-owi-sensor": "heater",
    "w11633848-overfill-switch": "inlet_valve",
    "w11633848-diverter-motor": "circulation_pump",
    "w11633848-diverter-sensor": "circulation_pump",
    "w11633848-wash-motor": "circulation_pump",
    "w11633848-drain-motor": "drain_pump",
    "w11633848-dc-fan": "heater",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "supply": (
        "supply",
        "confirm_supply_critical_supply_fault",
        "eliminate_supply_critical_supply_ok",
    ),
    "door_gasket": (
        "door_gasket",
        "confirm_gasket_bad_door_gasket_fault",
        "eliminate_gasket_bad_door_gasket_ok",
    ),
    "inlet_valve": (
        "inlet_valve",
        "confirm_inlet_valve_ol_inlet_valve_failed",
        "eliminate_inlet_valve_ol_inlet_valve_ok",
    ),
    "heater": (
        "heater",
        "confirm_heater_ol_heater_failed",
        "eliminate_heater_ol_heater_ok",
    ),
    "circulation_pump": (
        "circulation_pump",
        "confirm_circulation_pump_ol_circulation_pump_failed",
        "eliminate_circulation_pump_ol_circulation_pump_ok",
    ),
    "drain_pump": (
        "drain_pump",
        "confirm_drain_pump_ol_drain_pump_failed",
        "eliminate_drain_pump_ol_drain_pump_ok",
    ),
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "supplyVoltage120": (
        "supply",
        "confirm_supply_critical_supply_fault",
        "eliminate_supply_critical_supply_ok",
    ),
    "dishwasherDoorLatchSwitchOhms": (
        "door_gasket",
        "confirm_gasket_bad_door_gasket_fault",
        "eliminate_gasket_bad_door_gasket_ok",
    ),
    "dishwasherFloatSwitchOhms": (
        "inlet_valve",
        "confirm_inlet_valve_ol_inlet_valve_failed",
        "eliminate_inlet_valve_ol_inlet_valve_ok",
    ),
    "whirlpoolDishwasherAcuFillValveOhms": (
        "inlet_valve",
        "confirm_inlet_valve_ol_inlet_valve_failed",
        "eliminate_inlet_valve_ol_inlet_valve_ok",
    ),
    "whirlpoolDishwasherAcuHeaterOhms": (
        "heater",
        "confirm_heater_ol_heater_failed",
        "eliminate_heater_ol_heater_ok",
    ),
    "whirlpoolDishwasherAcuOwiThermistorOhms": (
        "heater",
        "confirm_heater_ol_heater_failed",
        "eliminate_heater_ol_heater_ok",
    ),
    "whirlpoolDishwasherAcuWashMotorOhms": (
        "circulation_pump",
        "confirm_circulation_pump_ol_circulation_pump_failed",
        "eliminate_circulation_pump_ol_circulation_pump_ok",
    ),
    "whirlpoolDishwasherAcuDrainMotorOhms": (
        "drain_pump",
        "confirm_drain_pump_ol_drain_pump_failed",
        "eliminate_drain_pump_ol_drain_pump_ok",
    ),
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
    return any(token in title for token in ("replace", "fault", "failed", "suspect", "repair"))


def is_success_outcome(step: dict | None) -> bool:
    if not step or step.get("type") != "outcome":
        return False
    title = f"{step.get('title', '')} {step.get('oemOutcome', '')}".lower()
    return any(token in title for token in ("verified", "operates", "good", "pass", "retest", "within", "ok"))


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
        if kind == "checkpoint_no" and (terminal or is_failure_outcome(next_step) or branch.get("oemOutcome")):
            if confirm_id:
                branch["diagnosticEffects"] = [confirm_effect(component, confirm_id)]
                return True
        if kind == "checkpoint_yes" and (is_success_outcome(next_step) or next_step and next_step.get("id", "").endswith("_verified")):
            if eliminate_id:
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
    for path in sorted(SEED_DIR.glob("w11633848-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_seed(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) updated")
        total += count
    print(f"Attached diagnosticEffects on {total} branches total.")


if __name__ == "__main__":
    main()
