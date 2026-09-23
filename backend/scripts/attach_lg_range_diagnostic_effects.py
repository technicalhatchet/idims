#!/usr/bin/env python3
"""Attach diagnosticEffects to LG range procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/lg_freestanding_range"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "lg-range-oven-sensor": "temp_sensor",
    "lg-range-door-switch": "door_switch",
    "lg-range-oven-lamp": "heater",
    "lg-range-door-latch": "door_lock",
    "lg-range-bake-element": "bake_element",
    "lg-range-broil-element": "broil_element",
    "lg-range-convection-element": "convection_element",
    "lg-range-convection-motor": "convection_fan",
    "lg-range-warming-drawer": "warming_drawer",
    "lg-range-cooktop-single": "surface_element",
    "lg-range-warming-zone": "warming_zone",
    "lg-range-dual-rf-element": "surface_element",
    "lg-range-oven-igniter": "igniter",
    "lg-range-oven-gas-valve": "gas_valve",
    "lg-range-ignition-switch": "surface_ignition",
    "lg-range-no-power": "supply",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "lgRangeOvenSensorOhms": ("temp_sensor", "confirm_temp_sensor_ol_temp_sensor_failed", "eliminate_temp_sensor_ol_temp_sensor_ok"),
    "lgRangeWarmingDrawerSensorOhms": ("temp_sensor", "confirm_temp_sensor_ol_temp_sensor_failed", "eliminate_temp_sensor_ol_temp_sensor_ok"),
    "lgRangeBakeElementOhms": ("bake_element", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "lgRangeBroilElementOhms": ("broil_element", "confirm_broil_element_ol_broil_element_failed", "eliminate_broil_element_ol_broil_element_ok"),
    "lgRangeConvectionElementOhms": ("convection_element", "confirm_broil_element_ol_broil_element_failed", "eliminate_broil_element_ol_broil_element_ok"),
    "lgRangeConvectionMotorOhms": ("convection_fan", "confirm_convection_bad_convection_fan_failed", "eliminate_convection_bad_convection_fan_ok"),
    "lgRangeDoorLatchMotorOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "lgRangeMicroSwitchOhms": ("door_lock", "confirm_door_lock_open_door_lock_failed", "eliminate_door_lock_open_door_lock_ok"),
    "lgRangeCooktopElementOhms": ("surface_element", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "lgRangeWarmingZoneOhms": ("warming_zone", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "lgRangeDualSurfaceInnerOhms": ("surface_element", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "lgRangeDualSurfaceOuterOhms": ("surface_element", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "lgRangeWarmingDrawerElementOhms": ("warming_drawer", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "lgRangeOvenIgniterOhms": ("igniter", "confirm_igniter_ol_igniter_failed", "eliminate_igniter_ol_igniter_ok"),
    "lgRangeOvenGasValveOhms": ("gas_valve", "confirm_gas_valve_coil_open_gas_valve_failed", "eliminate_gas_valve_coil_open_gas_valve_ok"),
    "lgRangeOvenLampOhms": ("heater", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
    "ovenTempSensorOhms": ("temp_sensor", "confirm_temp_sensor_ol_temp_sensor_failed", "eliminate_temp_sensor_ol_temp_sensor_ok"),
    "hotSurfaceIgniterOhms": ("igniter", "confirm_igniter_ol_igniter_failed", "eliminate_igniter_ol_igniter_ok"),
    "bakeElementOhms": ("bake_element", "confirm_bake_element_ol_bake_element_failed", "eliminate_bake_element_ol_bake_element_ok"),
}


def effect_for_branch(procedure_id: str, step: dict, branch: dict) -> list[dict]:
    when = branch.get("when") or {}
    kind = when.get("kind")
    if not kind:
        return []

    knowledge_id = step.get("measurementKnowledgeId")
    component_id = PROCEDURE_COMPONENT.get(procedure_id, "")
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        comp, fail_id, pass_id = KNOWLEDGE_EVIDENCE[knowledge_id]
        component_id = comp or component_id
        if kind in FAIL_MEASUREMENT:
            return [{"effectId": fail_id, "componentId": component_id}]
        if kind in PASS_MEASUREMENT:
            return [{"effectId": pass_id, "componentId": component_id}]
    return []


def patch_seed(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    pid = data.get("id", path.stem)
    changed = 0
    for step in data.get("steps", []):
        for branch in step.get("branches", []):
            effects = effect_for_branch(pid, step, branch)
            if effects and branch.get("diagnosticEffects") != effects:
                branch["diagnosticEffects"] = effects
                changed += 1
    if changed:
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{path.name}: {changed} branch(es) updated"


def main() -> None:
    if not SEED_DIR.is_dir():
        raise SystemExit(f"Seed dir not found: {SEED_DIR}")
    for path in sorted(SEED_DIR.glob("*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
