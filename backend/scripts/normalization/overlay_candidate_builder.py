from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .paths import (
    CANONICAL_DISHWASHER_PATH,
    CANONICAL_DRYER_PATH,
    WHIRLPOOL_OVERLAY_PATH,
)
from .range_matcher_scope import (
    is_range_template,
    resolve_range_canonical_path,
)
from .washer_matcher_scope import (
    is_top_load_washer_platform,
    remap_test_target_for_platform,
    resolve_washer_canonical_path,
)
from .provenance import build_provenance

WASHER_COMPONENT_TO_TEST_TARGET: dict[str, str] = {
    "door_lock": "door_lock_test",
    "drain_pump": "drain_test",
    "drive_motor": "motor_output_test",
    "motor_controller": "motor_command_test",
    "control_board": "motor_command_test",
    "water_level_sensor": "drain_test",
}

TOP_LOAD_WASHER_COMPONENT_TO_TEST_TARGET: dict[str, str] = {
    "lid_lock": "lid_lock_test",
    "door_lock": "lid_lock_test",
    "drain_pump": "drain_test",
    "drive_motor": "motor_output_test",
    "motor_controller": "motor_command_test",
    "control_board": "motor_command_test",
    "water_level_sensor": "drain_test",
    "power_supply": "motor_command_test",
    "supply": "motor_command_test",
}

RANGE_COMPONENT_TO_TEST_TARGET: dict[str, str] = {
    "power_supply": "supply_test",
    "supply": "supply_test",
    "control_board": "display_communication_test",
    "main_control": "display_communication_test",
    "user_interface": "display_communication_test",
    "display_panel": "display_communication_test",
    "temperature_sensor": "oven_sensor_test",
    "thermistor": "oven_sensor_test",
    "surface_heating_system": "surface_heat_test",
    "surface_element": "surface_heat_test",
    "bake_heating_element": "oven_sensor_test",
    "bake_element": "oven_sensor_test",
    "broil_heating_element": "oven_sensor_test",
    "broil_element": "oven_sensor_test",
    "convection_heating_element": "oven_sensor_test",
    "convection_fan": "oven_sensor_test",
    "oven_door_switch": "display_communication_test",
    "door_lock": "display_communication_test",
}

DISHWASHER_COMPONENT_TO_TEST_TARGET: dict[str, str] = {
    "door_switch": "door_switch_test",
    "door_gasket": "door_switch_test",
    "inlet_valve": "fill_test",
    "water_level_sensor": "water_level_test",
    "circulation_pump": "circulation_test",
    "wash_motor": "circulation_test",
    "drain_pump": "drain_test",
    "heat_source": "heater_command_test",
    "heater": "heater_command_test",
    "temperature_sensor": "temperature_response_test",
    "drying_system": "drying_airflow_test",
    "detergent_dispenser": "detergent_dispenser_test",
    "thermal_protection": "thermal_protection_test",
    "main_control": "heater_command_test",
    "supply": "fill_test",
}

APPROVED_PROCEDURE_BINDINGS: dict[str, dict[str, str]] = {}


def _load_approved_bindings() -> None:
    if not WHIRLPOOL_OVERLAY_PATH.is_file():
        return
    overlay = json.loads(WHIRLPOOL_OVERLAY_PATH.read_text(encoding="utf-8"))
    for family in overlay.get("platformFamilies", []):
        for binding in family.get("procedureBindings") or []:
            proc_id = binding.get("procedureId")
            target = binding.get("testTargetId")
            if proc_id and target:
                APPROVED_PROCEDURE_BINDINGS[proc_id] = {
                    "testTargetId": target,
                    "source": "approved_overlay",
                }


_load_approved_bindings()


def _ontology_path_for_template(template_id: str, platform_id: str | None = None) -> Path | None:
    washer_path = resolve_washer_canonical_path(template_id, platform_id)
    if washer_path is not None:
        return washer_path
    range_path = resolve_range_canonical_path(template_id, platform_id)
    if range_path is not None:
        return range_path
    if template_id == "dishwasher" and CANONICAL_DISHWASHER_PATH.is_file():
        return CANONICAL_DISHWASHER_PATH
    if template_id in {"electric_dryer", "gas_dryer"} and CANONICAL_DRYER_PATH.is_file():
        return CANONICAL_DRYER_PATH
    return None


def _load_canonical_test_targets(template_id: str, platform_id: str | None = None) -> set[str]:
    ontology_path = _ontology_path_for_template(template_id, platform_id)
    if ontology_path is None:
        return set()
    ontology = json.loads(ontology_path.read_text(encoding="utf-8"))
    return {target["id"] for target in ontology.get("testTargets") or [] if target.get("id")}


def _component_to_test_target(template_id: str, platform_id: str | None = None) -> dict[str, str]:
    if is_range_template(template_id):
        return RANGE_COMPONENT_TO_TEST_TARGET
    if template_id == "dishwasher":
        return DISHWASHER_COMPONENT_TO_TEST_TARGET
    if is_top_load_washer_platform(platform_id):
        return TOP_LOAD_WASHER_COMPONENT_TO_TEST_TARGET
    return WASHER_COMPONENT_TO_TEST_TARGET


def infer_test_target(
    procedure: dict[str, Any],
    template_id: str = "washer",
    platform_id: str | None = None,
) -> str | None:
    procedure_id = procedure.get("procedureId")
    if procedure_id in APPROVED_PROCEDURE_BINDINGS:
        return APPROVED_PROCEDURE_BINDINGS[procedure_id]["testTargetId"]

    tags = {str(tag).lower() for tag in procedure.get("tags") or []}
    if is_range_template(template_id):
        if "no_power" in tags:
            return "supply_test"
        if "hmi_check" in tags or "door_lock_check" in tags:
            return "display_communication_test"
        if "no_bake" in tags or "sensor_check" in tags:
            return "oven_sensor_test"
        if "surface_burner" in tags or "igbt_check" in tags or "long_bake" in tags:
            return "surface_heat_test"
    elif template_id == "dishwasher":
        if "door_lock_check" in tags or "door_switch_check" in tags:
            return "door_switch_test"
        if "wont_drain" in tags or "drain_issue" in tags:
            return "drain_test"
        if "fill_issue" in tags or "wont_fill" in tags:
            return "fill_test"
        if "no_heat" in tags or "heating_element_check" in tags:
            return "heater_command_test"
        if "wash_issue" in tags or "pump_check" in tags:
            return "circulation_test"
    else:
        if "door_lock_check" in tags or "door_lock" in tags:
            if is_top_load_washer_platform(platform_id):
                return "lid_lock_test"
            return "door_lock_test"
        if "wont_drain" in tags or "drain" in tags:
            return "drain_test"
        if "wont_spin" in tags or "motor_check" in tags:
            return "motor_output_test"

    component_map = _component_to_test_target(template_id, platform_id)
    for component_id in procedure.get("componentIds") or []:
        if component_id in component_map:
            return component_map[component_id]
    return None


def build_overlay_candidates(
    procedures: list[dict[str, Any]],
    manual_entry: dict[str, Any],
    template_id: str,
) -> list[dict[str, Any]]:
    manual_id = str(manual_entry.get("manualId"))
    platform_id = str(manual_entry.get("platformId"))
    valid_targets = _load_canonical_test_targets(template_id, platform_id)
    candidates: list[dict[str, Any]] = []

    for procedure in procedures:
        procedure_id = procedure.get("procedureId")
        pages = (procedure.get("source") or {}).get("pages") or []
        test_target = infer_test_target(procedure, template_id, platform_id)
        test_target = remap_test_target_for_platform(test_target or "", platform_id) if test_target else None
        if not test_target:
            continue

        confidence = 0.92
        if procedure_id in APPROVED_PROCEDURE_BINDINGS:
            confidence = 0.99

        if valid_targets and test_target not in valid_targets:
            candidates.append(
                {
                    "id": f"overlay-{manual_id}-{procedure_id}-unmapped-target",
                    "status": "UNRESOLVED_TERM",
                    "candidateType": "procedureTestBinding",
                    "procedureId": procedure_id,
                    "canonicalTestTarget": test_target,
                    "confidence": 0.0,
                    "provenance": build_provenance(
                        manual_id=manual_id,
                        platform_id=platform_id,
                        procedure_id=procedure_id,
                        pages=pages,
                    ),
                },
            )
            continue

        candidates.append(
            {
                "id": f"overlay-{manual_id}-{procedure_id}-{test_target}",
                "status": "candidate",
                "candidateType": "procedureTestBinding",
                "procedureId": procedure_id,
                "canonicalTestTarget": test_target,
                "confidence": confidence,
                "displayTitle": procedure.get("title"),
                "componentIds": procedure.get("componentIds") or [],
                "provenance": build_provenance(
                    manual_id=manual_id,
                    platform_id=platform_id,
                    procedure_id=procedure_id,
                    pages=pages,
                    extraction_doc=manual_entry.get("extractionDoc"),
                ),
            },
        )

        for measurement in procedure.get("measurements") or []:
            knowledge_id = measurement.get("measurementKnowledgeId")
            if not knowledge_id:
                continue
            candidates.append(
                {
                    "id": f"overlay-{manual_id}-{procedure_id}-meas-{knowledge_id}",
                    "status": "candidate",
                    "candidateType": "measurementBinding",
                    "procedureId": procedure_id,
                    "measurementKnowledgeId": knowledge_id,
                    "canonicalTestTarget": test_target,
                    "confidence": 0.94,
                    "provenance": build_provenance(
                        manual_id=manual_id,
                        platform_id=platform_id,
                        procedure_id=procedure_id,
                        pages=pages,
                        extra=[
                            {
                                "type": "measurement",
                                "measurementKnowledgeId": knowledge_id,
                                "stepTitle": measurement.get("title"),
                            },
                        ],
                    ),
                },
            )

    return candidates
