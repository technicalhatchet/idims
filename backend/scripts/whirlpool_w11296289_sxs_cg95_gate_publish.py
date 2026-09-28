#!/usr/bin/env python3
"""CG-9.5 WP2 — Gate-table publisher for Whirlpool W11296289 SxS → whirlpool_sxs_w11296289 overlay."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANUAL_ID = "W11296289"
PLATFORM_ID = "whirlpool_sxs_w11296289"
PLATFORM_FAMILY_ID = "whirlpool_sxs_w11296289"
OVERLAY_FILE = "whirlpool_sxs_w11296289.json"
GATE_TABLE_ARTIFACT = "W11296289_SXS_overlay_mapping_table_v1.json"
LEDGER_ARTIFACT = "W11296289_SXS_gate_decision_ledger_v1.json"
BOUNDARY_PROBE = "W11296289_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
GATE_KIND = "sxs_production_compounding_whirlpool"
EXPECTED_CANONICAL_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
EXPECTED_LEARNING_DECISION_IDS = frozenset(
    {
        "whirlpool-sxs-defrost-thermistor-platform",
        "whirlpool-sxs-theseus-athena-acu-platform",
        "whirlpool-sxs-minotaur-cuda-hmi-platform",
        "whirlpool-sxs-compressor-relay-platform",
        "whirlpool-sxs-damper-stepper-platform",
        "whirlpool-sxs-idi-ice-platform",
        "whirlpool-sxs-water-valve-platform",
        "whirlpool-sxs-sealed-system-routing",
        "whirlpool-sxs-aggregate-resurrection-blocked",
        "whirlpool-sxs-cg9-r2-evidence-isolation",
    }
)
PRIOR_OVERLAY_LEAK_TERMS = frozenset(
    {
        "samsungrs28",
        "samsungrf260b",
        "samsungbespoke",
        "inverter_board",
        "inverter_pba_mediated",
        "io_expander",
        "c_fan_convertible",
        "dispenser_panel",
        "ice_pipe_heater",
        "linear_compressor",
        "lglrmvs-",
        "icing_fan",
        "w10322959-test",
        "samsung-compressor-inverter",
    }
)
CG7_DISCOVERY_LEAK_TERMS = frozenset(
    {
        "triangulationresult",
        "freezeeligible",
        "r3_triangulation",
        "cg7_fd_refrigerator_r3",
        "functional_role_triangulated",
        "french_door_refrigerator_cg7x_candidate",
    }
)

ROOT = Path(__file__).resolve().parents[2]
CALIBRATION = ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
CANONICAL_PATH = ROOT / "frontend/components/diagnostics/knowledge/canonical/french_door_refrigerator.json"
OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays" / OVERLAY_FILE
)
JAZZ_OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays"
    / "whirlpool_jazz_french_door.json"
)
RF23BB_OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays"
    / "samsung_fridge_bespoke.json"
)
LG_OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays" / "lg_lrmvs.json"
)
SAMSUNG_SXS_OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays" / "samsung_sxs.json"
)

PLATFORM_COMPONENTS = [
    {
        "id": "defrost_thermostat",
        "name": "Defrost thermistor (step 5)",
        "aliases": ["defrost thermistor", "defrost_thermostat"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "note": "Step 5 defrost NTC — platform defrost_sensor, not cabinet temperature_sensor.",
    },
    {
        "id": "damper_motor",
        "name": "12 VDC stepper damper motor",
        "aliases": ["damper motor", "damper_motor", "electric air baffle"],
        "systemId": "airflow",
        "type": "actuator",
        "implementsCanonicalId": "air_damper",
        "note": "Steps 9/11 stepper open + damper heater — Whirlpool SxS air_damper implementation.",
    },
    {
        "id": "compressor_relay",
        "name": "Compressor relay",
        "aliases": ["relay", "compressor relay"],
        "systemId": "cooling",
        "type": "actuator",
        "implementsPlatformId": "compressor_controller",
        "note": "Relay-drive path — not canonical compressor.",
    },
    {
        "id": "em3y60_compressor",
        "name": "EM3Y60/EGX60 compressor",
        "aliases": ["em3y60", "egx60", "embraco em3y60"],
        "systemId": "cooling",
        "type": "actuator",
        "implementsConditionalConceptId": "compressor",
        "conditionalInstanceScope": "relay_drive_em3y60",
        "note": "SxS compressor actuator — conditionalConcept binding, not canonical node.",
    },
    {
        "id": "water_valve",
        "name": "Water dispenser inlet valve",
        "aliases": ["water valve", "water_valve"],
        "systemId": "water_dispenser",
        "type": "actuator",
        "implementsConditionalConceptId": "water_dispenser",
        "note": "Step 19 P3 valve — conditional water_dispenser implementation.",
    },
    {
        "id": "ice_maker_module",
        "name": "IDI twist-tray ice maker",
        "aliases": ["ice maker module", "ice_maker_module", "idi ice maker"],
        "systemId": "ice_maker",
        "type": "actuator",
        "implementsConditionalConceptId": "ice_maker",
        "note": "Optional ice_maker feature domain — step 33 tray thermistor evidence.",
    },
]

CONDITIONAL_BINDINGS = [
    {
        "conditionalConceptId": "compressor",
        "instanceScope": "relay_drive_em3y60",
        "procedureIds": ["w11296289-test-07-compressor-cond-fan"],
    },
    {
        "conditionalConceptId": "condenser_fan",
        "procedureIds": ["w11296289-test-07-compressor-cond-fan"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "freezer",
        "procedureIds": ["w11296289-test-01-fc-thermistor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "fresh_food",
        "procedureIds": ["w11296289-test-03-rc-thermistor"],
    },
    {
        "conditionalConceptId": "ice_maker",
        "procedureIds": ["w11296289-test-33-im-tray-thermistor"],
    },
    {
        "conditionalConceptId": "water_dispenser",
        "procedureIds": ["w11296289-test-19-water-valve"],
    },
]

PROCEDURE_BINDINGS = [
    {
        "procedureId": "w11296289-theseus-service-entry",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "w11296289-athena-service-entry",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "w11296289-athena-fail-display",
        "canonicalComponents": ["control_board", "user_interface"],
    },
    {
        "procedureId": "w11296289-test-21-rc-door-switch",
        "canonicalComponents": ["door_switch"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "w11296289-test-23-fc-door-switch",
        "canonicalComponents": ["door_switch"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "w11296289-test-15-evap-fan",
        "canonicalComponents": ["evaporator_fan"],
    },
    {
        "procedureId": "w11296289-test-09-damper-open",
        "canonicalComponents": ["air_damper"],
    },
    {
        "procedureId": "w11296289-test-11-damper-heater",
        "canonicalComponents": ["air_damper"],
    },
    {
        "procedureId": "w11296289-test-13-defrost-heater",
        "canonicalComponents": ["defrost_heater"],
    },
    {
        "procedureId": "w11296289-test-07-compressor-cond-fan",
        "conditionalConcepts": ["compressor", "condenser_fan"],
        "instanceScope": "relay_drive_em3y60",
    },
    {
        "procedureId": "w11296289-test-01-fc-thermistor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "w11296289-test-03-rc-thermistor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "w11296289-test-33-im-tray-thermistor",
        "conditionalConcepts": ["ice_maker"],
    },
    {
        "procedureId": "w11296289-test-19-water-valve",
        "conditionalConcepts": ["water_dispenser"],
    },
]

OEM_ALIASES = {
    "theseus": "control_board",
    "athena": "control_board",
    "service mode": "control_board",
    "cuda": "user_interface",
    "minotaur": "user_interface",
    "door switch": "door_switch",
    "rc door switch": "door_switch",
    "fc door switch": "door_switch",
    "evap_fan": "evaporator_fan",
    "evaporator fan": "evaporator_fan",
    "damper_motor": "damper_motor",
    "defrost heater": "defrost_heater",
    "defrost_thermostat": "defrost_thermostat",
    "thermistor": "temperature_sensor",
    "compressor": "compressor",
    "condenser_fan": "condenser_fan",
    "condenser fan": "condenser_fan",
    "water valve": "water_valve",
    "ice maker": "ice_maker",
    "sealed system": "sealed_system",
}

DISPLAY_TERMS = {
    "control_board": "THESEUS/ATHENA ACU (service-mode orchestration)",
    "user_interface": "CUDA dispenser LEDs / ATHENA fail-display decode",
    "door_switch": "RC + FC door switches (steps 21/23)",
    "evaporator_fan": "Single evaporator fan (step 15)",
    "air_damper": "12 VDC stepper damper + heater (steps 9/11)",
    "defrost_heater": "Defrost heater (step 13, 550–650 Ω)",
    "temperature_sensor": "FC/RC compartment NTCs (steps 1/3 — conditional scopes)",
    "compressor": "EM3Y60/EGX60 via relay drive (conditional)",
    "condenser_fan": "Condenser fan with compressor (step 7 — conditional)",
    "defrost_thermostat": "Defrost NTC (step 5 — platform defrost_sensor)",
    "ice_maker": "IDI twist-tray ice maker (conditional, step 33)",
    "water_dispenser": "Water inlet valve (step 19 — conditional)",
    "sealed_system": "Sealed-system complaint routing — not canonical",
}


class GatePublishError(Exception):
    pass


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def scaffold_overlay() -> dict[str, Any]:
    return {
        "schemaVersion": "1.0.0",
        "overlayKind": "manufacturer",
        "canonicalOntologyId": "french_door_refrigerator",
        "manufacturer": "Whirlpool",
        "label": "Whirlpool/Maytag/Amana/IKEA SxS refrigerator (W11296289)",
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "platformFamilies": [
            {
                "platformFamilyId": PLATFORM_FAMILY_ID,
                "platformId": PLATFORM_ID,
                "manualId": MANUAL_ID,
                "label": "Whirlpool SxS W11296289 (WRS321/325/315/311/312, ASI2575, WRSA15)",
                "appliesTo": {
                    "templateId": "refrigerator",
                    "manufacturers": ["Whirlpool", "Maytag", "Amana", "IKEA"],
                    "modelPatterns": [
                        "WRS321*",
                        "WRS325*",
                        "WRS315*",
                        "WRS311*",
                        "WRS312*",
                        "ASI2575*",
                        "WRSA15*",
                    ],
                    "platformIds": [PLATFORM_ID],
                },
                "oemTermAliases": {},
                "displayTerms": {},
                "conditionalConceptBindings": [],
                "add": {"components": [], "relationships": []},
                "procedureBindings": [],
                "procedureRoleEvidence": [],
                "deferredArtifacts": [],
                "routingRejections": [],
                "manufacturerIsolation": {
                    "priorOverlaysBlocked": [
                        "whirlpool_jazz_french_door.json",
                        "samsung_sxs.json",
                    ],
                    "jazzOverlayImportBlocked": True,
                    "samsungSxsOverlayImportBlocked": True,
                    "cg9BoundaryProbe": BOUNDARY_PROBE,
                    "cg9AutoApprovalBlocked": True,
                },
            }
        ],
        "status": "draft",
        "gateKind": GATE_KIND,
        "compoundingEvidence": {
            "phase": "CG-9.5",
            "workPackage": "WP2",
            "isLearningEvent": True,
            "isCertification": False,
            "manualId": MANUAL_ID,
            "boundaryProbeArtifact": BOUNDARY_PROBE,
        },
    }


def _family(overlay: dict[str, Any]) -> dict[str, Any]:
    families = overlay.get("platformFamilies") or []
    if not families:
        raise GatePublishError("overlay missing platformFamilies")
    return families[0]


def extract_overlay_learning_ids(ledger: dict[str, Any]) -> frozenset[str]:
    return frozenset(
        str(entry["artifactId"])
        for entry in ledger.get("entries") or []
        if entry.get("newSemanticDecision")
    )


def assert_no_prior_overlay_leak(overlay: dict[str, Any]) -> None:
    scrubbed = json.loads(json.dumps(overlay))
    for key in ("compoundingEvidence",):
        block = scrubbed.get(key) or {}
        block.pop("boundaryProbeArtifact", None)
        scrubbed[key] = block
    family = (scrubbed.get("platformFamilies") or [{}])[0]
    family.pop("manufacturerIsolation", None)
    blob = json.dumps(scrubbed).lower()
    for term in PRIOR_OVERLAY_LEAK_TERMS | CG7_DISCOVERY_LEAK_TERMS:
        if term in blob:
            raise GatePublishError(f"Prior overlay / discovery corpus leak detected: {term}")


def apply_gate_delta(
    overlay: dict[str, Any],
    table: dict[str, Any],
    ledger: dict[str, Any],
    *,
    publish: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if table.get("status") != "gated":
        raise GatePublishError(f"gate table not gated ({table.get('status')})")

    if publish:
        canonical_hash = file_sha256(CANONICAL_PATH)
        if canonical_hash != EXPECTED_CANONICAL_HASH:
            raise GatePublishError(f"canonical hash drift: {canonical_hash}")
        learning_ids = extract_overlay_learning_ids(ledger)
        if learning_ids != EXPECTED_LEARNING_DECISION_IDS:
            raise GatePublishError(
                f"learning decision drift expected {sorted(EXPECTED_LEARNING_DECISION_IDS)} "
                f"got {sorted(learning_ids)}"
            )

    family = _family(overlay)
    applied: dict[str, list[str]] = {
        "oemAliases": [],
        "platformComponents": [],
        "conditionalBindings": [],
        "procedureBindings": [],
        "procedureRoleEvidence": [],
        "routingRejections": [],
        "deferredArtifacts": [],
    }

    aliases = family.setdefault("oemTermAliases", {})
    for term, target in OEM_ALIASES.items():
        aliases[term] = target
        applied["oemAliases"].append(term)

    family["displayTerms"] = dict(DISPLAY_TERMS)
    family["conditionalConceptBindings"] = list(CONDITIONAL_BINDINGS)
    applied["conditionalBindings"] = [b["conditionalConceptId"] for b in CONDITIONAL_BINDINGS]

    family.setdefault("add", {}).setdefault("components", []).extend(PLATFORM_COMPONENTS)
    applied["platformComponents"] = [c["id"] for c in PLATFORM_COMPONENTS]

    family["procedureBindings"] = list(PROCEDURE_BINDINGS)
    applied["procedureBindings"] = [b["procedureId"] for b in PROCEDURE_BINDINGS]

    family["procedureRoleEvidence"] = []

    family["routingRejections"] = [
        {
            "conceptId": "defrost_system",
            "teachingId": "whirlpool-sxs-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "THESEUS service steps decompose to members — aggregate remains dead.",
        },
        {
            "conceptId": "cooling_system",
            "teachingId": "whirlpool-sxs-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Compressor/condenser vocabulary does not resurrect cooling_system aggregate.",
        },
        {
            "conceptId": "airflow_path",
            "teachingId": "whirlpool-sxs-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Evap fan + damper stay under canonical members + platform instances.",
        },
        {
            "conceptId": "sealed_system",
            "teachingId": "whirlpool-sxs-sealed-system-routing",
            "verdict": "reject_canonical_promotion",
            "note": "Complaint routing only — routes to compressor + condenser_fan conditionals.",
        },
    ]
    applied["routingRejections"] = [
        "defrost_system",
        "cooling_system",
        "airflow_path",
        "sealed_system",
    ]

    family["deferredArtifacts"] = [
        {
            "teachingId": "whirlpool-sxs-idi-partial-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_partial_procedure_coverage",
            "procedureIds": ["w11296289-test-33-im-tray-thermistor"],
            "note": "IDI steps 29–32/34–35 not seeded — step 33 only for ice_maker conditional.",
        },
        {
            "teachingId": "whirlpool-sxs-dispenser-light-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "note": "Step 17 dispenser light — no procedure seed.",
        },
        {
            "teachingId": "whirlpool-sxs-paddle-feedback-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "note": "Steps 25/27 paddle feedback — HMI only, no procedure seeds.",
        },
        {
            "teachingId": "whirlpool-sxs-humidity-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_not_on_manual",
        },
    ]
    applied["deferredArtifacts"] = [d["teachingId"] for d in family["deferredArtifacts"]]

    assert_no_prior_overlay_leak(overlay)

    overlay["compoundingEvidence"] = {
        "phase": "CG-9.5",
        "workPackage": "WP2",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "isLearningEvent": True,
        "isCertification": False,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "boundaryProbeArtifact": BOUNDARY_PROBE,
        "accounting": ledger.get("accounting") or ledger.get("summary") or {},
        "headlineMetric": {"canonicalExpansion": 0},
        "publishedAt": datetime.now(timezone.utc).isoformat() if publish else None,
    }
    overlay["status"] = "published" if publish else "draft"
    overlay["gateKind"] = GATE_KIND

    plan = {
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "publishMode": "gate_table_authoritative_sxs_production_compounding",
        "applied": applied,
        "accounting": ledger.get("accounting") or {},
        "manufacturerIsolation": {
            "priorOverlaysBlocked": [
                "whirlpool_jazz_french_door.json",
                "samsung_sxs.json",
            ],
            "priorOverlayLeakTermsChecked": sorted(PRIOR_OVERLAY_LEAK_TERMS),
            "cg9AutoApprovalBlocked": True,
        },
    }
    return overlay, plan


def build_publication_plan(table: dict[str, Any], ledger: dict[str, Any]) -> dict[str, Any]:
    return {
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "publishMode": "gate_table_authoritative_sxs_production_compounding",
        "gateKind": GATE_KIND,
        "isLearningEvent": True,
        "isCertification": False,
        "accounting": ledger.get("accounting") or ledger.get("summary") or {},
        "headlineMetric": {"canonicalExpansion": 0},
        "boundaryProbeArtifact": BOUNDARY_PROBE,
    }
