#!/usr/bin/env python3
"""CG-9.5 WP4 — Gate-table publisher for Midea/Insignia NS-RSS26 SxS → midea_rss overlay."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANUAL_ID = "MIDEA-RSS-FRIDGE"
PLATFORM_ID = "midea_rss"
PLATFORM_FAMILY_ID = "midea_rss"
OVERLAY_FILE = "midea_rss.json"
GATE_TABLE_ARTIFACT = "MIDEA_RSS_SXS_overlay_mapping_table_v1.json"
LEDGER_ARTIFACT = "MIDEA_RSS_SXS_gate_decision_ledger_v1.json"
BOUNDARY_PROBE = "MIDEA_RSS_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
GATE_KIND = "sxs_production_compounding_midea"
EXPECTED_CANONICAL_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
EXPECTED_LEARNING_DECISION_IDS = frozenset(
    {
        "midearss-rc-defrost-sensor-platform",
        "midearss-fz-defrost-sensor-platform",
        "midearss-display-cn9-platform",
        "midearss-vfd-inverter-platform",
        "midearss-b3839-ntc-platform",
        "midearss-mandatory-mode-platform",
        "midearss-high-temp-routing",
        "midearss-ice-maker-sensor-platform",
        "midearss-aggregate-resurrection-blocked",
        "midearss-cg9-r2-evidence-isolation",
    }
)
PRIOR_OVERLAY_LEAK_TERMS = frozenset(
    {
        "lgsxs-",
        "lglrmvs-",
        "linear_compressor",
        "samsungrs28-",
        "samsungrf260b-",
        "w11296289-",
        "w10322959-",
        "theseus",
        "athena",
        "em2y60",
        "em3y60",
        "io_expander",
        "optichill",
        "compressor_relay",
        "conventional_compressor",
        "damper_motor",
        "c_fan_convertible",
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
LG_SXS_OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays" / "lg_sxs.json"
)

PLATFORM_COMPONENTS = [
    {
        "id": "inverter_board",
        "name": "VFD inverter board",
        "aliases": ["inverter board", "inverter_board", "VFD board", "variable frequency driver"],
        "systemId": "cooling",
        "type": "controller",
        "implementsPlatformId": "compressor_controller",
        "note": "§11.2 VFD fault LED — platform layer, not canonical compressor.",
    },
    {
        "id": "main_control",
        "name": "Main control board",
        "aliases": ["main control", "main_control", "main board"],
        "systemId": "control",
        "type": "controller",
        "implementsCanonicalId": "control_board",
        "note": "Mandatory mode orchestration — canonical control_board implementation.",
    },
    {
        "id": "display_panel",
        "name": "Display panel",
        "aliases": ["display panel", "display_panel"],
        "systemId": "control",
        "type": "controller",
        "implementsCanonicalId": "user_interface",
        "note": "CN9 display↔main communication — canonical user_interface implementation.",
    },
    {
        "id": "rc_defrost_ntc",
        "name": "RC defrost NTC (E4)",
        "aliases": ["rc defrost sensor", "rc_defrost_ntc", "E4 defrost sensor"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "instanceScope": "fresh_food",
        "note": "Platform defrost_sensor — not cabinet temperature_sensor conditional.",
    },
    {
        "id": "fz_defrost_ntc",
        "name": "FZ defrost NTC (E5)",
        "aliases": ["fz defrost sensor", "fz_defrost_ntc", "E5 defrost sensor"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "instanceScope": "freezer",
        "note": "Platform defrost_sensor vocabulary for freezer defrost circuit.",
    },
    {
        "id": "b3839_ntc",
        "name": "B3839 NTC thermistor",
        "aliases": ["b3839 ntc", "b3839_ntc", "B3839 thermistor"],
        "systemId": "sensing",
        "type": "sensor",
        "implementsConditionalConceptId": "temperature_sensor",
        "note": "~2.0 kΩ @ 25°C (mideaB3839ThermistorKohm) — cabinet/ambient NTC platform spec.",
    },
    {
        "id": "ice_maker_module",
        "name": "Ice maker module",
        "aliases": ["ice maker module", "ice_maker_module"],
        "systemId": "ice_maker",
        "type": "actuator",
        "implementsConditionalConceptId": "ice_maker",
        "note": "E0/EE ice maker feature domain — conditionalConcept implementation only.",
    },
]

CONDITIONAL_BINDINGS = [
    {
        "conditionalConceptId": "compressor",
        "instanceScope": "vfd_mediated",
        "procedureIds": ["midearss-vfd-inverter"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "fresh_food",
        "procedureIds": ["midearss-rc-temp-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "freezer",
        "procedureIds": ["midearss-fz-temp-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "ambient",
        "procedureIds": ["midearss-ambient-sensor"],
    },
    {
        "conditionalConceptId": "ice_maker",
        "procedureIds": ["midearss-ice-maker", "midearss-ice-maker-sensor"],
    },
]

PROCEDURE_BINDINGS = [
    {
        "procedureId": "midearss-mandatory-mode-entry",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "midearss-communication",
        "canonicalComponents": ["user_interface"],
    },
    {
        "procedureId": "midearss-fz-defrost-heater",
        "canonicalComponents": ["defrost_heater"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "midearss-vfd-inverter",
        "conditionalConcepts": ["compressor"],
        "instanceScope": "vfd_mediated",
    },
    {
        "procedureId": "midearss-rc-temp-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "midearss-fz-temp-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "midearss-ambient-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "ambient",
    },
    {
        "procedureId": "midearss-ice-maker",
        "conditionalConcepts": ["ice_maker"],
    },
    {
        "procedureId": "midearss-ice-maker-sensor",
        "conditionalConcepts": ["ice_maker"],
    },
]

OEM_ALIASES = {
    "main control": "control_board",
    "main_control": "main_control",
    "main board": "control_board",
    "mandatory mode": "control_board",
    "display panel": "user_interface",
    "display_panel": "display_panel",
    "cn9": "display_panel",
    "inverter board": "inverter_board",
    "inverter_board": "inverter_board",
    "vfd": "inverter_board",
    "defrost heater": "defrost_heater",
    "defrost_heater": "defrost_heater",
    "thermistor": "temperature_sensor",
    "b3839": "b3839_ntc",
    "compressor": "compressor",
    "ice maker": "ice_maker",
    "e0": "ice_maker",
    "ee": "ice_maker",
    "e1": "temperature_sensor",
    "e2": "temperature_sensor",
    "e4": "rc_defrost_ntc",
    "e5": "fz_defrost_ntc",
    "e6": "display_panel",
    "e7": "temperature_sensor",
    "e9": "high_temp_alarm",
    "sealed system": "sealed_system",
}

DISPLAY_TERMS = {
    "control_board": "Main control (mandatory mode LOCK + FRZ.TEMP entry)",
    "user_interface": "Display panel (E6 CN9 communication)",
    "defrost_heater": "Freezer defrost heater 115 V 240 W (~55 Ω)",
    "temperature_sensor": "B3839 NTCs — RC/FZ/ambient conditional scopes",
    "compressor": "VFD-mediated compressor (§11.2 — conditional)",
    "inverter_board": "VFD inverter board fault LED — platform compressor_controller",
    "ice_maker": "Ice maker E0/EE (conditional optional feature)",
    "rc_defrost_ntc": "RC defrost NTC E4 — platform defrost_sensor",
    "fz_defrost_ntc": "FZ defrost NTC E5 — platform defrost_sensor",
    "high_temp_alarm": "E9 high-temp routing — not canonical",
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
        "manufacturer": "Midea",
        "label": "Midea / Insignia NS-RSS26 side-by-side refrigerator",
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "platformFamilies": [
            {
                "platformFamilyId": PLATFORM_FAMILY_ID,
                "platformId": PLATFORM_ID,
                "manualId": MANUAL_ID,
                "label": "Midea RSS26 SxS (VFD compressor, B3839 NTC, E-family)",
                "appliesTo": {
                    "templateId": "refrigerator",
                    "manufacturers": ["Insignia", "Midea"],
                    "modelPatterns": ["NS-RSS*", "NS-RTM*"],
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
                        "lg_sxs.json",
                    ],
                    "lrmvsOverlayImportBlocked": True,
                    "samsungSxsOverlayImportBlocked": True,
                    "whirlpoolSxsOverlayImportBlocked": True,
                    "lgSxsOverlayImportBlocked": True,
                    "cg9BoundaryProbe": BOUNDARY_PROBE,
                    "cg9AutoApprovalBlocked": True,
                },
            }
        ],
        "status": "draft",
        "gateKind": GATE_KIND,
        "compoundingEvidence": {
            "phase": "CG-9.5",
            "workPackage": "WP4",
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
            "teachingId": "midearss-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "E-family steps decompose to members — aggregate remains dead.",
        },
        {
            "conceptId": "cooling_system",
            "teachingId": "midearss-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "VFD compressor vocabulary does not resurrect cooling_system aggregate.",
        },
        {
            "conceptId": "airflow_path",
            "teachingId": "midearss-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "No evap-fan seed — airflow stays deferred, aggregate dead.",
        },
        {
            "conceptId": "high_temp_alarm",
            "teachingId": "midearss-high-temp-routing",
            "verdict": "reject_canonical_promotion",
            "note": "E9 routes to compressor/thermistor checks — not door_switch canonical.",
        },
        {
            "conceptId": "sealed_system",
            "teachingId": "midearss-high-temp-routing",
            "verdict": "reject_canonical_promotion",
            "note": "Complaint routing only — routes to compressor conditional + NTC scopes.",
        },
    ]
    applied["routingRejections"] = [
        "defrost_system",
        "cooling_system",
        "airflow_path",
        "high_temp_alarm",
        "sealed_system",
    ]

    family["deferredArtifacts"] = [
        {
            "teachingId": "midearss-door-switch-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_insufficient_procedure_evidence",
            "note": "E9 references door switches — no standalone door-switch procedure seed.",
        },
        {
            "teachingId": "midearss-evaporator-fan-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
        },
        {
            "teachingId": "midearss-air-damper-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
        },
        {
            "teachingId": "midearss-condenser-fan-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_no_procedure_seed",
        },
        {
            "teachingId": "midearss-water-dispenser-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_not_on_manual",
            "note": "EH/EF/CA/EP dispenser codes — no procedure seed on RSS26.",
        },
    ]
    applied["deferredArtifacts"] = [d["teachingId"] for d in family["deferredArtifacts"]]

    assert_no_prior_overlay_leak(overlay)

    overlay["compoundingEvidence"] = {
        "phase": "CG-9.5",
        "workPackage": "WP4",
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
                "lg_sxs.json",
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
