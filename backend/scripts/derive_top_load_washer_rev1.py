#!/usr/bin/env python3
"""Mechanically derive frozen top_load_washer rev1 from CG-6.x candidate + freeze recommendation."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CALIBRATION = (
    ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "knowledge"
    / "normalization"
    / "calibration"
)
CANONICAL_PATH = (
    ROOT / "frontend" / "components" / "diagnostics" / "knowledge" / "canonical" / "top_load_washer.json"
)
DERIVATION_PATH = CALIBRATION / "TOP_LOAD_WASHER_REV1_DERIVATION_v1.json"

CANDIDATE_PATH = CALIBRATION / "top_load_washer_cg6x_candidate_v1.json"
FREEZE_PATH = CALIBRATION / "TOP_LOAD_WASHER_CG6X_FREEZE_RECOMMENDATION_v1.json"

FROZEN_AT = "2026-09-15T19:45:00+00:00"
EVIDENCE_MANUALS = ["W10864849", "W11697231", "W11416787"]

OVERLAY_ONLY = [
    "splutch",
    "clutch",
    "gearcase",
    "capacitor",
    "stator",
    "rotor",
    "manufacturer_motor_controller",
    "mode_shifter",
    "pressure_sensor",
    "recirc_pump",
    "wash_heater",
    "bulk_level_switch",
    "motor_controller",
    "drum_bearing",
]


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def pick_components(candidate: dict, keep: list[str], conditional: list[str]) -> list[dict]:
    selected_ids = set(keep) | set(conditional)
    components: list[dict] = []
    for component in candidate["components"]:
        component_id = component["id"]
        if component_id not in selected_ids:
            continue
        item = deepcopy(component)
        if component_id == "lid_switch":
            item["pendingEvidenceGraph"] = True
            item["canonicalStatus"] = "conditional"
            item["note"] = (
                "Lid-closed cycle-start authorization — distinct from lid_lock spin-safety interlock."
            )
            item["evidenceQualification"] = {
                "rev1Status": "conditional",
                "matcherDiscoveryManuals": 0,
                "procedureRoleEvidenceManuals": EVIDENCE_MANUALS,
                "precedent": (
                    "Earned through repeated cross-manual procedure role evidence, not CG-3 matcher "
                    "convergence. Do not manufacture matcher aliases to simulate discovery."
                ),
            }
        if component_id == "lid_lock":
            item["pendingEvidenceGraph"] = True
            item["note"] = (
                "Locked/spin-safety authorization — distinct from lid_switch cycle-start sensing."
            )
        if component_id in {
            "power_supply",
            "transmission_or_shifter",
            "agitator_or_impeller",
            "spin_system",
            "drain_path",
            "tub",
            "basket",
            "suspension_system",
            "temperature_sensor",
        }:
            item["pendingEvidenceGraph"] = True
        if component_id == "transmission_or_shifter":
            item["note"] = (
                "Functional wash↔spin mode selection — splutch, clutch, gearcase, and actuator "
                "implementations remain overlay-only."
            )
        components.append(item)
    return components


def derive_relationships() -> list[dict]:
    return [
        {
            "from": "power_supply",
            "type": "supplies",
            "to": "control_board",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "hmi_control",
            "type": "communicates_with",
            "to": "control_board",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "hmi_control",
            "type": "commands",
            "to": "control_board",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "lid_switch",
            "type": "provides_feedback_to",
            "to": "control_board",
            "source": "canonical",
            "confidence": "medium",
            "note": "Cycle-start authorization — conditional rev1 concept; procedure evidence only.",
        },
        {
            "from": "lid_lock",
            "type": "provides_feedback_to",
            "to": "control_board",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "lid_lock",
            "type": "enables",
            "to": "drive_motor",
            "source": "canonical",
            "confidence": "high",
            "note": "Spin-safety authorization — distinct from lid_switch cycle-start sensing.",
        },
        {
            "from": "control_board",
            "type": "controls",
            "to": "inlet_valve",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "inlet_valve",
            "type": "supplies",
            "to": "tub",
            "source": "canonical",
            "confidence": "high",
            "note": "Functional fill delivery — hose routing belongs in overlay.",
        },
        {
            "from": "water_level_sensor",
            "type": "provides_feedback_to",
            "to": "control_board",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "control_board",
            "type": "controls",
            "to": "drain_pump",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "drain_pump",
            "type": "routed_through",
            "to": "drain_path",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "control_board",
            "type": "controls",
            "to": "drive_motor",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "control_board",
            "type": "controls",
            "to": "transmission_or_shifter",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "drive_motor",
            "type": "mechanically_drives",
            "to": "transmission_or_shifter",
            "source": "canonical",
            "confidence": "high",
            "note": "Motor output feeds mode-selection path — OEM shifter/splutch implementations are overlay.",
        },
        {
            "from": "transmission_or_shifter",
            "type": "mechanically_drives",
            "to": "agitator_or_impeller",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "transmission_or_shifter",
            "type": "mechanically_drives",
            "to": "spin_system",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "basket",
            "type": "mechanically_connected_to",
            "to": "tub",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "suspension_system",
            "type": "mechanically_connected_to",
            "to": "tub",
            "source": "canonical",
            "confidence": "high",
        },
        {
            "from": "temperature_sensor",
            "type": "provides_feedback_to",
            "to": "control_board",
            "source": "canonical",
            "confidence": "medium",
        },
        {
            "from": "drive_motor",
            "type": "provides_feedback_to",
            "to": "control_board",
            "source": "canonical",
            "confidence": "medium",
        },
    ]


def derive_functional_dependencies() -> list[dict]:
    return [
        {
            "id": "cycle_start_authorization",
            "description": "Cycle start requires power, control readiness, UI, and lid-closed authorization.",
            "requires": ["power_supply", "control_board", "hmi_control", "lid_switch"],
            "enables": ["fill_operation", "drive_operation"],
            "source": "canonical",
            "confidence": "medium",
            "note": "lid_switch is conditional rev1 — present in graph via procedure evidence, not matcher discovery.",
        },
        {
            "id": "fill_operation",
            "description": "Fill requires authorization, inlet valve operation, and level feedback.",
            "requires": ["control_board", "inlet_valve"],
            "feedback": ["water_level_sensor"],
            "enables": ["water_level_authorization"],
            "source": "canonical",
            "confidence": "high",
        },
        {
            "id": "water_level_authorization",
            "description": "Drive and spin require established water level.",
            "requires": ["control_board", "water_level_sensor"],
            "enables": ["drive_operation", "spin_authorization"],
            "source": "canonical",
            "confidence": "high",
        },
        {
            "id": "drain_operation",
            "description": "Drain requires pump and drain path function with control recognition.",
            "requires": ["control_board", "drain_pump", "drain_path"],
            "feedback": ["water_level_sensor"],
            "enables": ["drain_completion"],
            "source": "canonical",
            "confidence": "high",
        },
        {
            "id": "drain_completion",
            "description": "Drain completion requires pump/path function and acceptable resulting level state.",
            "requires": ["control_board", "drain_pump", "drain_path"],
            "feedback": ["water_level_sensor"],
            "enables": ["spin_authorization"],
            "source": "canonical",
            "confidence": "high",
        },
        {
            "id": "drive_operation",
            "description": (
                "Motor operation requires cycle authorization, spin-safety lock state, motor command path, "
                "and functional mode selection."
            ),
            "requires": ["control_board", "lid_lock", "drive_motor", "transmission_or_shifter"],
            "conditional": [
                "water_level_sensor",
                "drain_pump",
                "drain_path",
                "suspension_system",
                "agitator_or_impeller",
                "spin_system",
            ],
            "source": "canonical",
            "confidence": "high",
        },
        {
            "id": "agitation_operation",
            "description": "Agitation requires motor output routed through mode selection to agitate output.",
            "requires": ["drive_motor", "transmission_or_shifter", "agitator_or_impeller"],
            "source": "canonical",
            "confidence": "high",
        },
        {
            "id": "spin_authorization",
            "description": "High-speed spin requires locked lid, drained tub, and acceptable level state.",
            "requires": ["lid_lock", "drain_pump", "drain_path", "water_level_sensor"],
            "conditional": ["suspension_system", "drive_motor", "transmission_or_shifter", "spin_system"],
            "enables": ["spin_operation"],
            "source": "canonical",
            "confidence": "high",
        },
        {
            "id": "spin_operation",
            "description": "Spin requires motor output routed through mode selection to spin output.",
            "requires": ["drive_motor", "transmission_or_shifter", "spin_system"],
            "source": "canonical",
            "confidence": "high",
        },
    ]


def derive_failure_domains() -> list[dict]:
    return [
        {"id": "power_failure", "label": "Power / supply", "components": ["power_supply", "control_board"]},
        {"id": "control_failure", "label": "Control", "components": ["control_board"]},
        {"id": "user_interface_failure", "label": "User interface", "components": ["hmi_control"]},
        {
            "id": "lid_authorization_failure",
            "label": "Lid authorization",
            "components": ["lid_switch", "lid_lock"],
        },
        {"id": "fill_failure", "label": "Water inlet / fill", "components": ["inlet_valve", "power_supply"]},
        {
            "id": "water_level_failure",
            "label": "Water level sensing",
            "components": ["water_level_sensor"],
        },
        {"id": "drain_failure", "label": "Drain", "components": ["drain_pump", "drain_path"]},
        {
            "id": "drive_failure",
            "label": "Drive / motor / mode selection",
            "components": ["drive_motor", "transmission_or_shifter"],
        },
        {
            "id": "agitation_failure",
            "label": "Agitation output",
            "components": ["agitator_or_impeller", "transmission_or_shifter", "drive_motor"],
        },
        {
            "id": "spin_failure",
            "label": "Spin output",
            "components": ["spin_system", "transmission_or_shifter", "drive_motor", "lid_lock"],
        },
        {
            "id": "mechanical_mode_selection_failure",
            "label": "Mechanical mode selection",
            "components": ["transmission_or_shifter"],
        },
        {
            "id": "suspension_failure",
            "label": "Suspension / tub support",
            "components": ["suspension_system", "tub", "basket"],
        },
        {
            "id": "temperature_sensing_failure",
            "label": "Temperature sensing",
            "components": ["temperature_sensor"],
            "optional": True,
        },
        {
            "id": "installation_external",
            "label": "Installation / external",
            "components": ["power_supply"],
            "crossCutting": True,
        },
        {"id": "wiring_connection", "label": "Wiring / connection", "crossCutting": True},
    ]


def derive_entry_points() -> list[dict]:
    return [
        {
            "id": "wont_start",
            "symptoms": ["won't start", "pressing start does nothing", "cycle will not begin"],
            "initialDomains": [
                "user_interface_failure",
                "control_failure",
                "lid_authorization_failure",
                "power_failure",
            ],
            "activeGoals": ["cycle_start_authorization"],
        },
        {
            "id": "wont_fill",
            "symptoms": ["won't fill", "no water", "slow fill", "LF", "F20", "F8E1", "4C"],
            "initialDomains": ["fill_failure", "lid_authorization_failure", "water_level_failure", "control_failure"],
            "activeGoals": ["fill_operation"],
        },
        {
            "id": "overfills",
            "symptoms": ["overfills", "too much water", "does not stop filling", "OC", "F8E6"],
            "initialDomains": ["water_level_failure", "fill_failure", "control_failure"],
            "activeGoals": ["fill_operation", "water_level_authorization"],
        },
        {
            "id": "wont_drain",
            "symptoms": ["won't drain", "water remains", "slow drain", "F21", "F9E1", "5C", "LC"],
            "initialDomains": ["drain_failure", "water_level_failure", "control_failure"],
            "activeGoals": ["drain_operation", "drain_completion"],
        },
        {
            "id": "wont_agitate",
            "symptoms": ["won't agitate", "no agitation", "basket does not move", "F7E3", "F7E4"],
            "initialDomains": ["drive_failure", "agitation_failure", "lid_authorization_failure", "control_failure"],
            "activeGoals": ["drive_operation", "agitation_operation"],
        },
        {
            "id": "wont_spin",
            "symptoms": ["won't spin", "does not spin", "no high-speed spin", "F7E5", "F7E7", "3C"],
            "initialDomains": [
                "spin_failure",
                "drain_failure",
                "water_level_failure",
                "lid_authorization_failure",
                "suspension_failure",
                "control_failure",
            ],
            "activeGoals": ["spin_authorization", "spin_operation", "drive_operation"],
        },
        {
            "id": "stops_mid_cycle",
            "symptoms": ["stops mid cycle", "pauses unexpectedly", "cycle aborts"],
            "initialDomains": ["control_failure", "lid_authorization_failure", "water_level_failure", "drive_failure"],
        },
        {
            "id": "no_motor_operation",
            "symptoms": ["no motor", "motor does not run", "no movement"],
            "initialDomains": ["drive_failure", "lid_authorization_failure", "control_failure"],
            "activeGoals": ["drive_operation"],
        },
        {
            "id": "agitates_but_wont_spin",
            "symptoms": ["agitates but won't spin", "washes but no spin"],
            "initialDomains": ["mechanical_mode_selection_failure", "spin_failure", "lid_authorization_failure"],
            "activeGoals": ["spin_authorization", "spin_operation", "drive_operation"],
        },
        {
            "id": "spins_but_wont_agitate",
            "symptoms": ["spins but won't agitate", "spin only"],
            "initialDomains": ["mechanical_mode_selection_failure", "agitation_failure", "drive_failure"],
            "activeGoals": ["agitation_operation", "drive_operation"],
        },
        {
            "id": "loud_or_unbalanced",
            "symptoms": ["loud noise", "vibration", "walking", "unbalance", "UV", "UB", "Sd", "F7E9"],
            "initialDomains": ["suspension_failure", "drive_failure", "installation_external"],
        },
        {
            "id": "water_level_incorrect",
            "symptoms": ["water level incorrect", "too little water", "too much water"],
            "initialDomains": ["water_level_failure", "fill_failure", "drain_failure"],
            "activeGoals": ["water_level_authorization", "fill_operation"],
        },
        {
            "id": "lid_lock_issue",
            "symptoms": ["lid won't lock", "lid lock error", "F5E1", "F5E2", "F5E3", "F5E4", "dL", "lid open"],
            "initialDomains": ["lid_authorization_failure", "control_failure", "wiring_connection"],
            "activeGoals": ["spin_authorization", "cycle_start_authorization"],
        },
    ]


def derive_rev1(candidate: dict, freeze: dict) -> dict:
    keep = freeze["freeze"]["keep"]
    conditional = freeze["freeze"]["conditional"]
    remove = freeze["freeze"]["remove"]

    systems = []
    for system in candidate["systems"]:
        item = deepcopy(system)
        purposes = {
            "power": "Electrical power delivery.",
            "control": "Command, sequencing, monitoring, and decision logic.",
            "user_interface": "User input, display, status, and cycle selection.",
            "lid_authorization": "Lid-closed and spin-safety authorization.",
            "water_inlet": "Incoming water delivery and fill control.",
            "water_level": "Water-level sensing and fill termination.",
            "drain": "Water removal via drain pump and path.",
            "drive": "Motor output, mode selection, and wash/spin mechanical outputs.",
            "mechanical": "Tub, basket, and suspension structure.",
            "temperature": "Wash water temperature sensing.",
        }
        if system["id"] in purposes:
            item["purpose"] = purposes[system["id"]]
        systems.append(item)

    return {
        "schemaVersion": "1.0.0",
        "ontology": {
            "id": "top_load_washer",
            "name": "Top-Load Washer",
            "templateId": "washer",
            "variant": "top_load",
            "description": (
                "Canonical functional diagnostic ontology for top-load washing machines. "
                "Models functional relationships and diagnostic dependencies; manufacturer, platform, "
                "and model-specific implementation belongs in overlays."
            ),
            "frozen": True,
            "frozenAt": FROZEN_AT,
            "frozenRevision": "rev1",
            "frozenNote": (
                "CG-6.x canonical graph — three-manual Whirlpool TL corpus "
                "(W10864849, W11697231, W11416787). drive_system removed; "
                "transmission_or_shifter kept; lid_switch conditional."
            ),
        },
        "designPrinciples": [
            "Model functional behavior rather than physical wiring or platform-specific drive topology.",
            "Keep power, authorization, fill, level, drain, drive, mode selection, and output (agitate/spin) diagnostically distinct.",
            "lid_switch (cycle-start authorization) and lid_lock (spin-safety authorization) are separate canonical concepts when evidence supports the split.",
            "transmission_or_shifter is the canonical functional mode-selection concept — splutch, clutch, gearcase, and actuator implementations belong in overlays.",
            "drive_system was candidate-only: three manuals independently collapsed drive diagnostics to control_board -> drive_motor -> motor_output_test with zero canonical drive_system hits.",
            "agitator_or_impeller is intentionally functional — do not split agitator vs impeller at canonical layer.",
            "temperature_sensor is included conservatively; not a required dependency for ordinary wash operation.",
            "Manufacturer-specific implementations extend via overlays — they do not replace canonical function.",
            "Tests produce evidence; evidence changes component and hypothesis state (handled in procedure + intelligence layers).",
            "Do not condemn a downstream component until required upstream conditions are established.",
            "Unknown information must remain unknown — never infer good or bad without evidence.",
            "Procedure branch logic and test definitions stay in service procedure seeds, not in this file.",
        ],
        "relationshipTypes": [
            "supplies",
            "controls",
            "commands",
            "communicates_with",
            "senses",
            "provides_feedback_to",
            "mechanically_drives",
            "mechanically_connected_to",
            "routed_through",
            "depends_on",
            "enables",
            "inhibits",
            "monitors",
        ],
        "componentStateModel": {
            "description": "Component verification states for this ontology. Distinct from intelligence-engine hypothesis ranking.",
            "states": [
                "unknown",
                "unverified",
                "suspected",
                "supported",
                "conditionally_supported",
                "contradicted",
                "verified_good",
                "verified_failed",
                "not_applicable",
                "inaccessible",
            ],
            "terminalStates": ["verified_good", "verified_failed", "not_applicable"],
            "engineSeparationNote": (
                "Diagnostic ranking, candidate support, and routing effects do not constitute component "
                "verification. verified_good and verified_failed require explicit diagnostic evidence."
            ),
        },
        "systems": systems,
        "components": pick_components(candidate, keep, conditional),
        "relationships": derive_relationships(),
        "functionalDependencies": derive_functional_dependencies(),
        "establishedFactSources": [
            {
                "factId": "lid_closed_authorized",
                "label": "Lid closed for cycle start",
                "fromComponents": ["lid_switch"],
                "source": "canonical",
                "confidence": "medium",
                "note": "Conditional rev1 concept — procedure role evidence only; no matcher alias manufactured.",
            },
            {
                "factId": "lid_lock_authorized",
                "label": "Lid lock authorized for spin / drive safety",
                "fromComponents": ["lid_lock"],
                "fromBranches": ["lid_lock_verified_good", "lock_energizes_yes"],
                "source": "canonical",
                "confidence": "high",
            },
            {
                "factId": "fill_command_present",
                "label": "Fill command present",
                "fromComponents": ["control_board", "inlet_valve"],
                "source": "session",
                "confidence": "high",
            },
            {
                "factId": "water_level_reached",
                "label": "Water level reached / acceptable",
                "fromComponents": ["water_level_sensor"],
                "source": "session",
                "confidence": "high",
            },
            {
                "factId": "drain_command_present",
                "label": "Drain command present",
                "fromComponents": ["control_board", "drain_pump"],
                "source": "session",
                "confidence": "high",
            },
            {
                "factId": "drain_completion",
                "label": "Tub drain completed / water level acceptable for spin",
                "fromComponents": ["drain_pump", "drain_path"],
                "fromBranches": ["drain_verified_good"],
                "source": "canonical",
                "confidence": "high",
            },
            {
                "factId": "motor_command_present",
                "label": "Motor run command present at control output",
                "fromComponents": ["control_board", "drive_motor"],
                "fromBranches": ["motor_command_present"],
                "source": "canonical",
                "confidence": "high",
            },
            {
                "factId": "motor_output_present",
                "label": "Motor output present",
                "fromComponents": ["drive_motor"],
                "source": "session",
                "confidence": "high",
            },
            {
                "factId": "motor_output_abnormal",
                "label": "Motor load output abnormal vs specification",
                "fromComponents": ["drive_motor"],
                "fromBranches": ["motor_voltage_abnormal"],
                "source": "service_manual",
                "confidence": "high",
            },
            {
                "factId": "agitation_present",
                "label": "Agitation output observed",
                "fromComponents": ["agitator_or_impeller"],
                "source": "session",
                "confidence": "medium",
            },
            {
                "factId": "spin_present",
                "label": "Spin output observed",
                "fromComponents": ["spin_system"],
                "source": "session",
                "confidence": "medium",
            },
        ],
        "testTargets": [
            {
                "id": "lid_lock_test",
                "label": "Lid lock / spin-safety verification",
                "role": "prerequisite",
                "testAliasId": "lid_lock_test",
                "establishesFacts": ["lid_lock_authorized"],
                "forGoals": ["spin_authorization", "drive_operation", "cycle_start_authorization"],
                "source": "canonical",
                "confidence": "high",
            },
            {
                "id": "drain_test",
                "label": "Drain path verification",
                "role": "prerequisite",
                "testAliasId": "drain_test",
                "establishesFacts": ["drain_completion"],
                "forGoals": ["spin_authorization", "drive_operation", "drain_completion"],
                "source": "canonical",
                "confidence": "high",
            },
            {
                "id": "motor_command_test",
                "label": "Motor command / control authorization",
                "role": "discriminator",
                "testAliasId": "motor_command_test",
                "establishesFacts": ["motor_command_present"],
                "requires": {"facts": ["lid_lock_authorized", "drain_completion"]},
                "forGoals": ["drive_operation"],
                "source": "canonical",
                "confidence": "high",
            },
            {
                "id": "motor_output_test",
                "label": "Motor output / drive path",
                "role": "discriminator",
                "testAliasId": "motor_output_test",
                "requires": {"facts": ["lid_lock_authorized", "drain_completion", "motor_command_present"]},
                "forGoals": ["drive_operation"],
                "source": "canonical",
                "confidence": "high",
            },
            {
                "id": "motor_winding_test",
                "label": "Motor winding / load measurement",
                "role": "discriminator",
                "testAliasId": "motor_winding_test",
                "requires": {"facts": ["lid_lock_authorized", "drain_completion", "motor_command_present"]},
                "forGoals": ["drive_operation"],
                "source": "canonical",
                "confidence": "high",
            },
            {
                "id": "shifter_test",
                "label": "Mode shifter / wash-spin transition verification",
                "role": "discriminator",
                "testAliasId": "shifter_test",
                "requires": {"facts": ["lid_lock_authorized", "drain_completion", "motor_command_present"]},
                "forGoals": ["drive_operation", "agitation_operation", "spin_operation"],
                "source": "canonical",
                "confidence": "high",
                "note": "Canonical target is transmission_or_shifter; OEM shifter/splutch implementations remain overlay.",
            },
        ],
        "failureDomains": derive_failure_domains(),
        "diagnosticPrinciples": {
            "general": [
                {
                    "id": "upstream_before_downstream",
                    "rule": "Establish required upstream conditions before condemning a downstream component.",
                },
                {
                    "id": "authorization_before_drive",
                    "rule": "Establish lid authorization and drain/level prerequisites before condemning motor or mode-selection paths.",
                },
                {
                    "id": "lid_switch_vs_lid_lock",
                    "rule": "Lid-closed cycle-start authorization (lid_switch) and locked spin-safety authorization (lid_lock) are distinct roles — do not collapse because a single OEM assembly contains both switches.",
                },
                {
                    "id": "mode_selection_before_motor_condemn",
                    "rule": "On shifter platforms, verify wash↔spin mode selection before condemning motor when one direction fails.",
                },
                {
                    "id": "normal_is_not_proof",
                    "rule": "A normal measurement reduces failure likelihood without declaring the entire component verified_good.",
                },
                {
                    "id": "preserve_uncertainty",
                    "rule": "Unknown, inaccessible, and unverified states must remain distinct from verified_good.",
                },
            ]
        },
        "diagnosticEntryPoints": derive_entry_points(),
        "freezeDerivation": {
            "sourceCandidate": "top_load_washer_cg6x_candidate_v1.json",
            "freezeRecommendation": "TOP_LOAD_WASHER_CG6X_FREEZE_RECOMMENDATION_v1.json",
            "evidenceManuals": EVIDENCE_MANUALS,
            "keep": keep,
            "conditional": conditional,
            "remove": remove,
            "overlayOnly": OVERLAY_ONLY,
            "relationshipRederivation": {
                "removedNode": "drive_system",
                "replacements": [
                    "control_board -> controls -> drive_motor",
                    "drive_motor -> mechanically_drives -> transmission_or_shifter",
                    "transmission_or_shifter -> mechanically_drives -> agitator_or_impeller | spin_system",
                    "lid_lock -> enables -> drive_motor",
                ],
            },
        },
    }


def build_derivation_artifact(candidate: dict, freeze: dict, rev1: dict) -> dict:
    component_map = []
    for component in candidate["components"]:
        component_id = component["id"]
        if component_id in freeze["freeze"]["remove"]:
            status = "REMOVE"
        elif component_id in freeze["freeze"]["conditional"]:
            status = "CONDITIONAL"
        elif component_id in freeze["freeze"]["keep"]:
            status = "KEEP"
        else:
            status = "ABSENT_FROM_FREEZE"
        if status == "ABSENT_FROM_FREEZE":
            continue
        component_map.append(
            {
                "componentId": component_id,
                "freezeAction": status,
                "inRev1": component_id in {item["id"] for item in rev1["components"]},
            }
        )

    for overlay_id in OVERLAY_ONLY:
        component_map.append(
            {
                "componentId": overlay_id,
                "freezeAction": "OVERLAY_ONLY",
                "inRev1": False,
            }
        )

    return {
        "schemaVersion": "1.0.0",
        "reportType": "top_load_washer_rev1_derivation",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceArtifacts": [
            "top_load_washer_cg6x_candidate_v1.json",
            "TOP_LOAD_WASHER_CG6X_FREEZE_RECOMMENDATION_v1.json",
            "W10864849_tl_cg6x_observation_v1.json",
            "W11697231_tl_cg6x_observation_v1.json",
            "W11416787_tl_cg6x_observation_v1.json",
        ],
        "outputArtifact": "frontend/components/diagnostics/knowledge/canonical/top_load_washer.json",
        "ontology": {
            "id": "top_load_washer",
            "frozenRevision": "rev1",
            "frozenAt": FROZEN_AT,
            "componentCount": len(rev1["components"]),
            "relationshipCount": len(rev1["relationships"]),
        },
        "freezeApplication": {
            "keep": freeze["freeze"]["keep"],
            "conditional": freeze["freeze"]["conditional"],
            "remove": freeze["freeze"]["remove"],
            "overlayOnly": OVERLAY_ONLY,
        },
        "componentMap": component_map,
        "precedents": {
            "drive_system_removed": (
                "Three manuals independently produced zero drive_system matcher hits and collapsed "
                "drive diagnostics to control_board -> drive_motor -> motor_output_test."
            ),
            "transmission_or_shifter_kept": (
                "All three manuals expose dedicated shifter procedures — canonical owns functional "
                "mode selection; OEM splutch/clutch/gearcase vocabulary stays overlay-only."
            ),
            "lid_switch_conditional": (
                "Procedure role evidence in 3/3 test-08-lid-lock procedures with 0/3 matcher discovery — "
                "preserve concept without manufacturing matcher aliases."
            ),
        },
        "relationshipRederivation": rev1["freezeDerivation"]["relationshipRederivation"],
        "verdict": "rev1 derived mechanically from candidate + freeze recommendation; legacy top_load_washer.json not used as source.",
    }


def main() -> int:
    candidate = load_json(CANDIDATE_PATH)
    freeze = load_json(FREEZE_PATH)
    rev1 = derive_rev1(candidate, freeze)
    derivation = build_derivation_artifact(candidate, freeze, rev1)

    write_json(CANONICAL_PATH, rev1)
    write_json(DERIVATION_PATH, derivation)

    print(f"Wrote canonical rev1: {CANONICAL_PATH}")
    print(f"Wrote derivation artifact: {DERIVATION_PATH}")
    print(
        f"Components: {len(rev1['components'])} | Relationships: {len(rev1['relationships'])} | "
        f"Removed: {freeze['freeze']['remove']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
