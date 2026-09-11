#!/usr/bin/env python3
"""Attach diagnosticEffects to NS-DWR3SS1 dishwasher procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/insignia_dishwasher"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "nsdwr3ss1-inlet-fill": "inlet_valve",
    "nsdwr3ss1-fill-valve": "inlet_valve",
    "nsdwr3ss1-drain-pump": "drain_pump",
    "nsdwr3ss1-heater": "heater",
    "nsdwr3ss1-tub-thermistor": "heater",
    "nsdwr3ss1-overflow": "drain_pump",
    "nsdwr3ss1-diverter": "circulation_pump",
    "nsdwr3ss1-control-panel": "user_interface",
    "nsdwr3ss1-display-comm": "user_interface",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
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
    "user_interface": (
        "user_interface",
        "ed_kw_f2e1_ui",
        "eliminate_heater_ol_heating_element_ok",
    ),
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "insigniaDishwasherFillValveOhms": (
        "inlet_valve",
        "confirm_inlet_valve_ol_inlet_valve_failed",
        "eliminate_inlet_valve_ol_inlet_valve_ok",
    ),
    "insigniaDishwasherDrainPumpOhms": (
        "drain_pump",
        "confirm_drain_pump_ol_drain_pump_failed",
        "eliminate_drain_pump_ol_drain_pump_ok",
    ),
    "insigniaDishwasherHeaterOhms": (
        "heater",
        "confirm_heater_ol_heater_failed",
        "eliminate_heater_ol_heater_ok",
    ),
    "insigniaDishwasherTubThermistorOhms": (
        "heater",
        "confirm_heater_ol_heater_failed",
        "eliminate_heater_ol_heater_ok",
    ),
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
    return any(token in title for token in ("replace", "fault", "failed", "repair", "service"))


def is_success_outcome(step: dict | None) -> bool:
    if not step or step.get("type") != "outcome":
        return False
    title = f"{step.get('title', '')} {step.get('oemOutcome', '')}".lower()
    return any(token in title for token in ("verified", "operates", "ok", "checked", "retest"))


def attach_branch_effects(
    procedure_id: str,
    step: dict,
    branch: dict,
    fallback_component: str,
    steps_by_id: dict[str, dict],
) -> bool:
    if branch.get("diagnosticEffects"):
        return False

    kind = (branch.get("when") or {}).get("kind")
    next_step = steps_by_id.get(branch.get("nextStepId", ""))

    if step.get("type") == "measurement":
        knowledge_id = step.get("measurementKnowledgeId")
        if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
            component, confirm_id, eliminate_id = KNOWLEDGE_EVIDENCE[knowledge_id]
        else:
            component, confirm_id, eliminate_id = COMPONENT_DEFAULT_EVIDENCE.get(
                fallback_component, (fallback_component, "", "")
            )
        if kind in FAIL_MEASUREMENT and confirm_id:
            branch["diagnosticEffects"] = [confirm_effect(component, confirm_id)]
            return True
        if kind in PASS_MEASUREMENT and eliminate_id:
            branch["diagnosticEffects"] = [eliminate_effect(component, eliminate_id)]
            return True
        return False

    if step.get("type") == "visual_check":
        component, confirm_id, eliminate_id = COMPONENT_DEFAULT_EVIDENCE.get(
            fallback_component, (fallback_component, "", "")
        )
        if kind == "checkpoint_no" and (
            branch.get("terminal") or branch.get("oemOutcome") or is_failure_outcome(next_step)
        ):
            if confirm_id:
                branch["diagnosticEffects"] = [confirm_effect(component, confirm_id)]
                return True
        if kind == "checkpoint_yes" and (
            is_success_outcome(next_step) or (next_step and str(next_step.get("id", "")).endswith("_verified"))
        ):
            if eliminate_id:
                branch["diagnosticEffects"] = [eliminate_effect(component, eliminate_id)]
                return True
        if kind == "checkpoint_no" and not branch.get("terminal"):
            branch["diagnosticEffects"] = [suspect_effect(component)]
            return True
        return False

    return False


def attach_seed(seed: dict) -> int:
    procedure_id = seed.get("id", "")
    fallback_component = PROCEDURE_COMPONENT.get(procedure_id, "")
    if not fallback_component:
        return 0

    steps_by_id = {step["id"]: step for step in seed.get("steps", []) if "id" in step}
    attached = 0
    for step in seed.get("steps", []):
        for branch in step.get("branches", []) or []:
            if attach_branch_effects(procedure_id, step, branch, fallback_component, steps_by_id):
                attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("nsdwr3ss1-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_seed(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) updated")
        total += count
    print(f"Attached diagnosticEffects on {total} branches total.")


if __name__ == "__main__":
    main()
