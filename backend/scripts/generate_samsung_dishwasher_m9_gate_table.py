#!/usr/bin/env python3
"""Generate SAMSUNG-DISHWASHER-M9 overlay mapping gate table v1."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = (
    ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
    / "SAMSUNG_DISHWASHER_M9_overlay_mapping_table_v1.json"
)

INHERIT_EXACT = [
    ("map-SAMSUNG-DISHWASHER-M9-dispenser-detergent_dispenser", "dispenser", "detergent_dispenser"),
    ("map-SAMSUNG-DISHWASHER-M9-compound-door_latch", "door_latch", "door_switch"),
    ("map-SAMSUNG-DISHWASHER-M9-drain_pump-drain_pump", "drain_pump", "drain_pump"),
    ("map-SAMSUNG-DISHWASHER-M9-vent-drying_system", "vent", "drying_system"),
    (
        "map-SAMSUNG-DISHWASHER-M9-compound-dry-fan,-actuator-&-auto-door-(fc-/-dc3)",
        "§4-3: Dry Fan, Actuator & Auto Door (FC / dC3)",
        "drying_system",
    ),
    ("map-SAMSUNG-DISHWASHER-M9-inlet_valve-inlet_valve", "inlet_valve", "inlet_valve"),
    ("map-SAMSUNG-DISHWASHER-M9-heater-heat_source", "heater", "heat_source"),
    ("map-SAMSUNG-DISHWASHER-M9-compound-user_interface", "user_interface", "hmi_control"),
    ("map-SAMSUNG-DISHWASHER-M9-compound-float_switch", "float_switch", "water_level_sensor"),
    ("map-SAMSUNG-DISHWASHER-M9-thermistor-temperature_sensor", "thermistor", "temperature_sensor"),
]

INHERIT_SEMANTIC = [
    (
        "map-SAMSUNG-DISHWASHER-M9-compound-wash_motor",
        "wash_motor",
        "circulation_pump",
        "Circulation motor reuses published circulation_pump / circulation_test semantics.",
    ),
    (
        "map-SAMSUNG-DISHWASHER-M9-compound-fan_motor",
        "fan_motor",
        "drying_system",
        "Fan motor inherits vent_fan_motor implementation on drying_system — no new alias.",
    ),
]

DEFER_PROCEDURAL = [
    "map-SAMSUNG-DISHWASHER-M9-compound-circulation-pump-(3c)",
    "map-SAMSUNG-DISHWASHER-M9-compound-pba-communication-(ac-/-ac6)",
    "map-SAMSUNG-DISHWASHER-M9-detergent-dispenser-detergent_dispenser",
    "map-SAMSUNG-DISHWASHER-M9-compound-distributor-motor-(pc)",
    "map-SAMSUNG-DISHWASHER-M9-compound-door-sensing-switch",
    "map-SAMSUNG-DISHWASHER-M9-compound-drain-pump-(5c)",
    "map-SAMSUNG-DISHWASHER-M9-compound-fill-valve-&-flow-meter-(4c)",
    "map-SAMSUNG-DISHWASHER-M9-compound-heater-operation-(hc-/-hc1)",
    "map-SAMSUNG-DISHWASHER-M9-compound-touch-panel-&-sub-pba-(bc2-/-bc3)",
    "map-SAMSUNG-DISHWASHER-M9-compound-leak-sensor-(lc)",
    "map-SAMSUNG-DISHWASHER-M9-compound-overflow-sensor-(oc)",
    "map-SAMSUNG-DISHWASHER-M9-compound-water-thermistor-(tc)",
    "map-SAMSUNG-DISHWASHER-M9-compound-lower-vane-motor-(7c)",
    "map-SAMSUNG-DISHWASHER-M9-compound-abnormal-supply-voltage-(9c1-/-9c2)",
]

PROCEDURE_BINDINGS = [
    {
        "procedureId": "samsungdwm9-circulation-motor",
        "testTargetId": "circulation_test",
        "canonicalComponents": ["circulation_pump"],
        "implementationComponent": "circulation_motor",
        "semanticAnchor": "circulation_test",
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-circulation-motor-circulation_test"
        ],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-door-switch",
        "testTargetId": "door_switch_test",
        "canonicalComponents": ["door_switch"],
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-door-switch-door_switch_test"
        ],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-drain-pump",
        "testTargetId": "drain_test",
        "canonicalComponents": ["drain_pump"],
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-drain-pump-drain_test"
        ],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-fill-valve",
        "testTargetId": "fill_test",
        "canonicalComponents": ["inlet_valve"],
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-fill-valve-fill_test"
        ],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-heater",
        "testTargetId": "heater_command_test",
        "canonicalComponents": ["heat_source"],
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-heater-heater_command_test"
        ],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-dispenser",
        "testTargetId": "detergent_dispenser_test",
        "canonicalComponents": ["detergent_dispenser"],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-distributor",
        "testTargetId": "circulation_test",
        "canonicalComponents": ["circulation_pump"],
        "implementationComponent": "distributor_motor",
        "semanticAnchor": "distributor_motor→circulation_pump",
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-dry-system",
        "testTargetId": "drying_airflow_test",
        "canonicalComponents": ["drying_system"],
        "implementationComponent": "vent_fan_motor",
        "semanticAnchor": "vent_fan_motor",
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-overflow",
        "testTargetId": "water_level_test",
        "canonicalComponents": ["water_level_sensor"],
        "implementationComponent": "overflow_sensor",
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-thermistor",
        "testTargetId": "temperature_response_test",
        "canonicalComponents": ["temperature_sensor"],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-vane-motor",
        "testTargetId": "circulation_test",
        "canonicalComponents": ["circulation_pump"],
        "implementationComponent": "vane_motor",
        "gateAction": "approve_platform_delta",
        "layer": "samsung_platform_implementation",
        "note": "M9 lower vane motor (7C) — new platform component; not diverter_valve.",
    },
    {
        "procedureId": "samsungdwm9-communication",
        "testTargetId": "heater_command_test",
        "matcherOutput": "heater_command_test",
        "expectedInvestigation": "control_board communication diagnostic — no heater evidence",
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-communication-heater_command_test"
        ],
        "gateAction": "defer_carry_forward_matcher",
        "layer": "carry_forward_matcher_defect",
        "carryForwardTheme": "communication_routing",
    },
    {
        "procedureId": "samsungdwm9-power-supply",
        "testTargetId": "fill_test",
        "matcherOutput": "fill_test",
        "expectedInvestigation": "power_supply / control_board power diagnostic family",
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-power-supply-fill_test"
        ],
        "gateAction": "defer_carry_forward_matcher",
        "layer": "carry_forward_matcher_defect",
        "carryForwardTheme": "power_supply_routing",
    },
    {
        "procedureId": "samsungdwm9-voltage-abnormal",
        "testTargetId": "fill_test",
        "matcherOutput": "fill_test",
        "expectedInvestigation": "supply voltage diagnostic — not fill_test",
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-voltage-abnormal-fill_test"
        ],
        "gateAction": "defer_carry_forward_matcher",
        "layer": "carry_forward_matcher_defect",
        "carryForwardTheme": "power_supply_routing",
    },
    {
        "procedureId": "samsungdwm9-leak-sensor",
        "testTargetId": "water_level_test",
        "gateAction": "defer_procedure_binding",
        "layer": "defer_platform",
        "note": "LC leak sensor — genuine unresolved Samsung concept; deferred on M1 and M9.",
    },
    {
        "procedureId": "samsungdwm9-hmi-check",
        "testTargetId": "door_switch_test",
        "gateAction": "defer_procedure_binding",
        "layer": "defer_platform",
        "note": "HMI/touch IC diagnostics — no canonical hmi_test; defer binding.",
    },
]

MEASUREMENT_BINDINGS = [
    {
        "procedureId": "samsungdwm9-circulation-motor",
        "measurementKnowledgeId": "samsungDishwasherM9CirculationMotorOhms",
        "testTargetId": "circulation_test",
        "implementationComponent": "circulation_motor",
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-circulation-motor-meas-samsungDishwasherM9CirculationMotorOhms"
        ],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-drain-pump",
        "measurementKnowledgeId": "samsungDishwasherM9DrainPumpOhms",
        "testTargetId": "drain_test",
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-drain-pump-meas-samsungDishwasherM9DrainPumpOhms"
        ],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-fill-valve",
        "measurementKnowledgeId": "samsungDishwasherM9FillValveOhms",
        "testTargetId": "fill_test",
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-fill-valve-meas-samsungDishwasherM9FillValveOhms"
        ],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-heater",
        "measurementKnowledgeId": "samsungDishwasherM9HeaterOhms",
        "testTargetId": "heater_command_test",
        "overlayCandidateIds": [
            "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-heater-meas-samsungDishwasherM9HeaterOhms"
        ],
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-dispenser",
        "measurementKnowledgeId": "samsungDishwasherM9DispenserOhms",
        "testTargetId": "detergent_dispenser_test",
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-distributor",
        "measurementKnowledgeId": "samsungDishwasherM9DistributorMotorOhms",
        "testTargetId": "circulation_test",
        "implementationComponent": "distributor_motor",
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-dry-system",
        "measurementKnowledgeId": "samsungDishwasherM9DryFanOhms",
        "testTargetId": "drying_airflow_test",
        "implementationComponent": "vent_fan_motor",
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-dry-system",
        "measurementKnowledgeId": "samsungDishwasherM9ThermalActuatorOhms",
        "testTargetId": "drying_airflow_test",
        "implementationComponent": "thermal_actuator",
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-thermistor",
        "measurementKnowledgeId": "samsungDishwasherM9ThermistorOhms",
        "testTargetId": "temperature_response_test",
        "gateAction": "approve_mechanical",
        "layer": "mechanical_inherited_registration",
    },
    {
        "procedureId": "samsungdwm9-vane-motor",
        "measurementKnowledgeId": "samsungDishwasherM9VaneMotorOhms",
        "testTargetId": "circulation_test",
        "implementationComponent": "vane_motor",
        "gateAction": "approve_platform_delta",
        "layer": "samsung_platform_implementation",
    },
]


def main() -> int:
    mappings = []
    for cid, concept, candidate in INHERIT_EXACT:
        mappings.append(
            {
                "manualConcept": concept,
                "layer": "mechanical_inherited_registration",
                "candidate": candidate,
                "gateAction": "approve_inherit",
                "candidateIds": [cid],
                "rationale": f"Exact published Samsung alias — mechanical inheritance, not new teaching.",
            }
        )
    for cid, concept, candidate, rationale in INHERIT_SEMANTIC:
        mappings.append(
            {
                "manualConcept": concept,
                "layer": "mechanical_inherited_registration",
                "candidate": candidate,
                "gateAction": "approve_inherit_semantic",
                "candidateIds": [cid],
                "rationale": rationale,
            }
        )
    for cid in DEFER_PROCEDURAL:
        mappings.append(
            {
                "manualConcept": cid,
                "layer": "defer_procedural_title",
                "gateAction": "defer_procedural_title",
                "candidateIds": [cid],
                "rationale": "OEM §4-3 title — bind by procedureId only; not oemTermAlias promotion.",
            }
        )
    mappings.extend(
        [
            {
                "manualConcept": "main_control",
                "layer": "reject_wrong_matcher",
                "candidate": "control_board",
                "matcherDefect": "platform_overlay:samsung_fl_washer_wf6000r",
                "gateAction": "reject_mapping",
                "candidateIds": ["map-SAMSUNG-DISHWASHER-M9-main_control-control_board"],
                "rationale": "Washer overlay routing defect — alias already on published Samsung layer.",
            },
            {
                "manualConcept": "diverter_motor (seed on distributor)",
                "layer": "reject_wrong_matcher",
                "candidate": "circulation_pump",
                "gateAction": "reject_mapping",
                "candidateIds": ["map-SAMSUNG-DISHWASHER-M9-compound-diverter_motor"],
                "rationale": "Wrong seed term — Samsung distributor motor, not diverter_valve.",
            },
            {
                "manualConcept": "leak_sensor",
                "layer": "defer_platform",
                "gateAction": "defer_platform",
                "candidateIds": ["map-SAMSUNG-DISHWASHER-M9-compound-leak_sensor"],
                "rationale": "Genuine unresolved Samsung concept — LC leak sensor functional role.",
            },
            {
                "manualConcept": "supply",
                "layer": "carry_forward_matcher_defect",
                "gateAction": "defer_carry_forward_matcher",
                "candidateIds": [
                    "map-samsung-dishwasher-m9-unresolved-samsungdwm9-power-supply-supply",
                    "map-samsung-dishwasher-m9-unresolved-samsungdwm9-voltage-abnormal-supply",
                ],
                "carryForwardTheme": "power_supply_routing",
                "rationale": "Carry-forward matcher defect — same power/supply routing problem as M1.",
            },
            {
                "manualConcept": "No Power & Power Relay Check",
                "layer": "carry_forward_matcher_defect",
                "gateAction": "defer_carry_forward_matcher",
                "candidateIds": [
                    "map-SAMSUNG-DISHWASHER-M9-compound-no-power-&-power-relay-check"
                ],
                "carryForwardTheme": "power_supply_routing",
                "rationale": "Carry-forward matcher defect — power family, not fill_test.",
            },
        ]
    )

    carry_forward = [
        {
            "theme": "power_supply_routing",
            "countsAsNewTeaching": False,
            "compilerSignal": True,
            "priorManualOccurrence": "SAMSUNG-DISHWASHER",
            "m9Procedures": ["samsungdwm9-power-supply", "samsungdwm9-voltage-abnormal"],
            "matcherOutput": "fill_test",
            "expectedCorrection": "power_supply diagnostic family — not fill_test",
            "overlayCandidateIds": [
                "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-power-supply-fill_test",
                "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-voltage-abnormal-fill_test",
            ],
        },
        {
            "theme": "communication_routing",
            "countsAsNewTeaching": False,
            "compilerSignal": True,
            "priorManualOccurrence": "SAMSUNG-DISHWASHER",
            "m9Procedure": "samsungdwm9-communication",
            "matcherOutput": "heater_command_test",
            "expectedCorrection": "control_board communication diagnostic — not heater_command_test",
            "overlayCandidateIds": [
                "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-communication-heater_command_test"
            ],
        },
    ]

    table = {
        "schemaVersion": "1.0.0",
        "manualId": "SAMSUNG-DISHWASHER-M9",
        "platformId": "samsung_dishwasher_m9",
        "platformFamilyId": "samsung_dishwasher",
        "canonicalOntologyId": "dishwasher",
        "proposedOverlayFile": "samsung_dishwasher.json",
        "priorPublishedManualIds": ["SAMSUNG-DISHWASHER"],
        "status": "draft",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "pipelineManifest": (
            "frontend/components/diagnostics/knowledge/normalization/"
            "candidates/SAMSUNG-DISHWASHER-M9/pipeline_manifest.json"
        ),
        "observationArtifact": (
            "frontend/components/diagnostics/knowledge/normalization/calibration/"
            "SAMSUNG_DISHWASHER_M9_cg3_compounding_observation_v1.json"
        ),
        "gatePolicy": {
            "gateKind": "manufacturer_compounding_second_manual",
            "canonicalGraph": "dishwasher.json rev1 FROZEN — zero new canonical concepts.",
            "cohortRule": "Native SAMSUNG-DISHWASHER-M9 only (16 procedures; platformId samsung_dishwasher_m9).",
            "compoundingRule": "Additive delta on published samsung_dishwasher.json — preserve SAMSUNG-DISHWASHER semantics.",
            "isolationRule": "Do not import Whirlpool aliases, platform components, measurements, or topology.",
            "proceduralTitleRule": "§4-3 OEM procedure titles are procedure identifiers — defer, do not promote.",
            "distributorRule": "distributor_motor → circulation_pump — not diverter_valve.",
            "circulationMotorRule": "M9 circulation must route circulation_test / circulation_motor — not drive_motor / motor_output_test.",
            "teachingCostRule": "Separate genuine new knowledge from carry-forward matcher defects in gate report.",
            "publishBlocked": True,
        },
        "layerDefinitions": {
            "mechanical_inherited_registration": "Reuses published Samsung aliases/test families — no new vocabulary.",
            "samsung_platform_implementation": "New M9 platform component implements canonical function.",
            "carry_forward_matcher_defect": "Compiler routing defect recurring from prior manual — not new teaching.",
            "defer_platform": "Genuine unresolved platform concept.",
            "defer_procedural_title": "OEM § title noise.",
            "reject_wrong_matcher": "Wrong seed term or cross-template path.",
        },
        "mappings": mappings,
        "procedureBindings": PROCEDURE_BINDINGS,
        "measurementBindings": MEASUREMENT_BINDINGS,
        "rejectedOverlayBindings": [
            {
                "procedureId": "samsungdwm9-communication",
                "matcherOutput": "heater_command_test",
                "expectedCorrection": "defer — carry-forward matcher defect",
                "overlayCandidateIds": [
                    "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-communication-heater_command_test"
                ],
                "gateAction": "reject_binding",
                "carryForwardTheme": "communication_routing",
            },
            {
                "procedureId": "samsungdwm9-power-supply",
                "matcherOutput": "fill_test",
                "expectedCorrection": "reject — power_supply diagnostic, not fill_test",
                "overlayCandidateIds": [
                    "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-power-supply-fill_test"
                ],
                "gateAction": "reject_binding",
                "carryForwardTheme": "power_supply_routing",
            },
            {
                "procedureId": "samsungdwm9-voltage-abnormal",
                "matcherOutput": "fill_test",
                "expectedCorrection": "reject — supply voltage diagnostic, not fill_test",
                "overlayCandidateIds": [
                    "overlay-SAMSUNG-DISHWASHER-M9-samsungdwm9-voltage-abnormal-fill_test"
                ],
                "gateAction": "reject_binding",
                "carryForwardTheme": "power_supply_routing",
            },
        ],
        "proposedPlatformDelta": {
            "add": {
                "components": [
                    {
                        "id": "vane_motor",
                        "implementsCanonicalId": "circulation_pump",
                        "note": "M9 lower vane/cam motor (7C) — not diverter_valve.",
                    }
                ]
            },
            "deferred": ["leak_sensor"],
        },
        "carryForwardMatcherDefects": carry_forward,
        "compoundingEvidence": {
            "cohortRole": "samsung_within_manufacturer_compounding_second_manual",
            "priorManualId": "SAMSUNG-DISHWASHER",
            "priorHumanSemanticDecisions": 15,
            "genuineNewHumanSemanticDecisions": 2,
            "genuineNewKnowledgeThemes": [
                {
                    "theme": "leak_sensor",
                    "gateAction": "defer_platform",
                    "countsAsNewTeaching": True,
                },
                {
                    "theme": "vane_motor",
                    "gateAction": "approve_platform_delta",
                    "countsAsNewTeaching": True,
                },
            ],
            "carryForwardMatcherDefectThemes": 2,
            "rawProjectedTeachingUnits": 6,
            "deduplicatedTeachingThemes": 5,
            "inheritedExact": 10,
            "inheritedSemantic": 10,
            "inheritanceRate": 0.714,
            "mechanicalProcedureRegistrations": 11,
            "mechanicalMeasurementRegistrations": 10,
            "newCanonicalConcepts": 0,
            "whirlpoolImports": 0,
            "canonicalExpansion": 0,
            "fanMotorInheritance": "approve_inherit_semantic → vent_fan_motor / drying_system (no new alias)",
            "circulationMotorRouting": "samsungdwm9-circulation-motor → circulation_test / circulation_motor",
        },
        "expectedPublicationCounts": {
            "m9ProcedureBindingsAdded": 11,
            "m9MeasurementBindingsAdded": 10,
            "newAliasesAdded": 0,
            "platformComponentsAdded": 1,
            "priorManualBindingsPreserved": 10,
        },
        "hardRejects": [
            "diverter_valve",
            "Whirlpool dishwasher aliases/platforms",
            "Samsung washer provenance (samsung_fl_washer_wf6000r)",
            "drive_motor / motor_output_test for circulation motor",
            "§4-3 procedural titles as oemTermAliases",
        ],
        "expectedMechanicalReuse": [
            "published Samsung oemTermAliases",
            "published test-family bindings (circulation_test, drain_test, fill_test, etc.)",
            "published measurement semantics per test family",
            "distributor_motor → circulation_pump topology",
        ],
    }
    OUT.write_text(json.dumps(table, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
