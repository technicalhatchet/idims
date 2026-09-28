#!/usr/bin/env python3
"""CG-9.5 WP3 — Gate-table publisher for LG LSC27926 SxS → lg_sxs overlay."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANUAL_ID = "LG-LSC27926-SXS"
PLATFORM_ID = "lg_sxs"
PLATFORM_FAMILY_ID = "lg_sxs"
OVERLAY_FILE = "lg_sxs.json"
GATE_TABLE_ARTIFACT = "LG_LSC27926_SXS_overlay_mapping_table_v1.json"
LEDGER_ARTIFACT = "LG_LSC27926_SXS_gate_decision_ledger_v1.json"
BOUNDARY_PROBE = "LG_LSC27926_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
GATE_KIND = "sxs_production_compounding_lg"
EXPECTED_CANONICAL_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
EXPECTED_LEARNING_DECISION_IDS = frozenset(
    {
        "lg-sxs-defrost-sensor-platform",
        "lg-sxs-micom-display-platform",
        "lg-sxs-compressor-relay-platform",
        "lg-sxs-damper-stepper-platform",
        "lg-sxs-bldc-fan-platform",
        "lg-sxs-dispenser-platform",
        "lg-sxs-sealed-system-routing",
        "lg-sxs-aggregate-resurrection-blocked",
        "lg-sxs-cg9-r2-evidence-isolation",
        "lg-sxs-optichill-damper-platform",
    }
)
PRIOR_OVERLAY_LEAK_TERMS = frozenset(
    {
        "lglrmvs-",
        "linear_compressor",
        "samsungrs28-",
        "samsungrf260b-",
        "w11296289-",
        "w10322959-",
        "theseus",
        "athena",
        "inverter_board",
        "em2y60",
        "em3y60",
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
LG_LRMVS_OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays" / "lg_lrmvs.json"
)
SAMSUNG_SXS_OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays" / "samsung_sxs.json"
)
WHIRLPOOL_SXS_OVERLAY_PATH = (
    ROOT
    / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays"
    / "whirlpool_sxs_w11296289.json"
)

PLATFORM_COMPONENTS = [
    {
        "id": "defrost_sensor",
        "name": "Defrost sensor NTC",
        "aliases": ["defrost sensor", "defrost_sensor", "defrost NTC"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "note": "Defrost sensor resistance flow — platform defrost_sensor, not cabinet temperature_sensor.",
    },
    {
        "id": "damper_motor",
        "name": "Stepping motor baffle damper",
        "aliases": ["damper motor", "damper_motor", "stepping damper"],
        "systemId": "airflow",
        "type": "actuator",
        "implementsCanonicalId": "air_damper",
        "note": "Test 1 open / Test 2 closed — LG SxS air_damper implementation.",
    },
    {
        "id": "optichill_damper",
        "name": "OptiChill stepping damper",
        "aliases": ["optichill damper", "optichill_damper", "OptiChill"],
        "systemId": "airflow",
        "type": "actuator",
        "implementsCanonicalId": "air_damper",
        "instanceScope": "optichill",
        "note": "OptiChill stepping damper — LG-specific platform instance alongside main baffle.",
    },
    {
        "id": "compressor_relay",
        "name": "Compressor relay RY2",
        "aliases": ["relay", "compressor relay", "RY2"],
        "systemId": "cooling",
        "type": "actuator",
        "implementsPlatformId": "compressor_controller",
        "note": "Conventional relay-drive path — not canonical compressor.",
    },
    {
        "id": "conventional_compressor",
        "name": "Conventional AC compressor",
        "aliases": ["conventional compressor", "conventional_compressor"],
        "systemId": "cooling",
        "type": "actuator",
        "implementsConditionalConceptId": "compressor",
        "conditionalInstanceScope": "relay_drive_conventional",
        "note": "SxS compressor actuator — conditionalConcept binding, not canonical node.",
    },
    {
        "id": "water_valve",
        "name": "Water/ice dispenser inlet valve",
        "aliases": ["water valve", "water_valve"],
        "systemId": "water_dispenser",
        "type": "actuator",
        "implementsConditionalConceptId": "water_dispenser",
        "note": "RY4/RY5/RY7/RY12 dispenser relays — conditional water_dispenser implementation.",
    },
    {
        "id": "ice_maker_module",
        "name": "In-door ice maker module",
        "aliases": ["ice maker module", "ice_maker_module"],
        "systemId": "ice_maker",
        "type": "actuator",
        "implementsConditionalConceptId": "ice_maker",
        "note": "Optional ice_maker feature domain — §3 ice maker electrical.",
    },
]

CONDITIONAL_BINDINGS = [
    {
        "conditionalConceptId": "compressor",
        "instanceScope": "relay_drive_conventional",
        "procedureIds": ["lgsxs-compressor"],
    },
    {
        "conditionalConceptId": "condenser_fan",
        "procedureIds": ["lgsxs-condenser-fan"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "freezer",
        "procedureIds": ["lgsxs-freezer-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "fresh_food",
        "procedureIds": ["lgsxs-fresh-food-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "ambient",
        "procedureIds": ["lgsxs-ambient-sensor"],
    },
    {
        "conditionalConceptId": "ice_maker",
        "procedureIds": ["lgsxs-ice-maker"],
    },
    {
        "conditionalConceptId": "water_dispenser",
        "procedureIds": ["lgsxs-water-dispenser"],
    },
]

PROCEDURE_BINDINGS = [
    {
        "procedureId": "lgsxs-test-mode-entry",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "lgsxs-lcd-check",
        "canonicalComponents": ["user_interface"],
    },
    {
        "procedureId": "lgsxs-display-communication",
        "canonicalComponents": ["user_interface"],
    },
    {
        "procedureId": "lgsxs-door-switch",
        "canonicalComponents": ["door_switch"],
    },
    {
        "procedureId": "lgsxs-fz-fan",
        "canonicalComponents": ["evaporator_fan"],
    },
    {
        "procedureId": "lgsxs-damper",
        "canonicalComponents": ["air_damper"],
    },
    {
        "procedureId": "lgsxs-defrost-heater",
        "canonicalComponents": ["defrost_heater"],
    },
    {
        "procedureId": "lgsxs-compressor",
        "conditionalConcepts": ["compressor"],
        "instanceScope": "relay_drive_conventional",
    },
    {
        "procedureId": "lgsxs-condenser-fan",
        "conditionalConcepts": ["condenser_fan"],
    },
    {
        "procedureId": "lgsxs-freezer-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "lgsxs-fresh-food-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "lgsxs-ambient-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "ambient",
    },
    {
        "procedureId": "lgsxs-ice-maker",
        "conditionalConcepts": ["ice_maker"],
    },
    {
        "procedureId": "lgsxs-water-dispenser",
        "conditionalConcepts": ["water_dispenser"],
    },
]

OEM_ALIASES = {
    "micom": "control_board",
    "main pcb": "control_board",
    "test mode": "control_board",
    "test button": "control_board",
    "display micom": "user_interface",
    "lcd check": "user_interface",
    "door switch": "door_switch",
    "door switches": "door_switch",
    "f-fan": "evaporator_fan",
    "evap_fan": "evaporator_fan",
    "evaporator fan": "evaporator_fan",
    "damper_motor": "damper_motor",
    "stepping damper": "damper_motor",
    "optichill": "optichill_damper",
    "defrost heater": "defrost_heater",
    "defrost_sensor": "defrost_sensor",
    "thermistor": "temperature_sensor",
    "compressor": "compressor",
    "condenser_fan": "condenser_fan",
    "c-fan": "condenser_fan",
    "condenser fan": "condenser_fan",
    "water valve": "water_valve",
    "ice maker": "ice_maker",
    "sealed system": "sealed_system",
}

DISPLAY_TERMS = {
    "control_board": "Main PCB MICOM (Test 1/2 orchestration)",
    "user_interface": "LCD check + display MICOM communication",
    "door_switch": "Door switches A/B/C/D (Test 1 fan stop)",
    "evaporator_fan": "F-FAN BLDC freezer fan (Test 1)",
    "air_damper": "Stepping baffle + OptiChill damper (Test 1/2)",
    "defrost_heater": "Defrost heater (Test 2 forced ON)",
    "temperature_sensor": "CON7/CON8/ambient NTCs — conditional compartment scopes",
    "compressor": "RY2 conventional relay drive (conditional)",
    "condenser_fan": "C-FAN BLDC with compressor (Test 1 — conditional)",
    "defrost_sensor": "Defrost NTC — platform defrost_sensor",
    "ice_maker": "In-door ice maker (conditional, §3)",
    "water_dispenser": "Water/ice dispenser valves (§2-18 — conditional)",
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
        "manufacturer": "LG",
        "label": "LG LSC27926 side-by-side refrigerator",
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "platformFamilies": [
            {
                "platformFamilyId": PLATFORM_FAMILY_ID,
                "platformId": PLATFORM_ID,
                "manualId": MANUAL_ID,
                "label": "LG LSC27926 SxS (conventional relay, BLDC fans, OptiChill)",
                "appliesTo": {
                    "templateId": "refrigerator",
                    "manufacturers": ["LG"],
                    "modelPatterns": ["LSC27926*"],
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
                        "lg_lrmvs.json",
                        "samsung_sxs.json",
                        "whirlpool_sxs_w11296289.json",
                    ],
                    "lrmvsOverlayImportBlocked": True,
                    "samsungSxsOverlayImportBlocked": True,
                    "whirlpoolSxsOverlayImportBlocked": True,
                    "cg9BoundaryProbe": BOUNDARY_PROBE,
                    "cg9AutoApprovalBlocked": True,
                },
            }
        ],
        "status": "draft",
        "gateKind": GATE_KIND,
        "compoundingEvidence": {
            "phase": "CG-9.5",
            "workPackage": "WP3",
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
            "teachingId": "lg-sxs-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Test-mode steps decompose to members — aggregate remains dead.",
        },
        {
            "conceptId": "cooling_system",
            "teachingId": "lg-sxs-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Compressor/condenser vocabulary does not resurrect cooling_system aggregate.",
        },
        {
            "conceptId": "airflow_path",
            "teachingId": "lg-sxs-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Evap fan + damper stay under canonical members + platform instances.",
        },
        {
            "conceptId": "sealed_system",
            "teachingId": "lg-sxs-sealed-system-routing",
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
            "teachingId": "lg-sxs-r2-sensor-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "note": "R2/OptiChill sensor faults visible on LCD check — no standalone procedure seed.",
        },
        {
            "teachingId": "lg-sxs-humidity-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_not_on_manual",
        },
        {
            "teachingId": "lg-sxs-water-tank-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
            "note": "Water-tank fault on LCD check — no procedure seed; dispenser bound via water_valve.",
        },
    ]
    applied["deferredArtifacts"] = [d["teachingId"] for d in family["deferredArtifacts"]]

    assert_no_prior_overlay_leak(overlay)

    overlay["compoundingEvidence"] = {
        "phase": "CG-9.5",
        "workPackage": "WP3",
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
                "lg_lrmvs.json",
                "samsung_sxs.json",
                "whirlpool_sxs_w11296289.json",
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
