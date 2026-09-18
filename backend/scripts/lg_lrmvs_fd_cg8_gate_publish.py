#!/usr/bin/env python3
"""CG-8 WP3 — Gate-table publisher for LG LRMVS → lg_lrmvs overlay."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANUAL_ID = "LG-LRMVS-FRIDGE"
PLATFORM_ID = "lg_lrmvs"
PLATFORM_FAMILY_ID = "lg_lrmvs"
OVERLAY_FILE = "lg_lrmvs.json"
GATE_TABLE_ARTIFACT = "LG_LRMVS_FD_overlay_mapping_table_v1.json"
LEDGER_ARTIFACT = "LG_LRMVS_FD_gate_decision_ledger_v1.json"
GATE_KIND = "lg_lrmvs_third_manual_compounding"
PRIOR_MANUAL_IDS = ["W10322959", "SAMSUNG-RF23BB-FRIDGE"]
EXPECTED_CANONICAL_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
EXPECTED_LEARNING_DECISION_IDS = frozenset(
    {
        "lg-linear-compressor-platform",
        "lg-defrost-sensor-platform",
        "lg-icing-fan-platform",
        "lg-wifi-modem-platform",
        "lg-sealed-system-routing",
        "lg-aggregate-resurrection-blocked",
        "lg-discovery-corpus-isolation",
    }
)
PRIOR_OVERLAY_LEAK_TERMS = frozenset(
    {
        "em2y60",
        "relay_drive_em2y60",
        "defrost_thermostat",
        "compressor_relay",
        "inverter_board",
        "inverter_pba_mediated",
        "ice_pipe_heater",
        "whirlpool_jazz_french_door",
        "samsung_fridge_bespoke",
        "jazz-door-switch",
        "samsung-compressor-inverter",
    }
)
DISCOVERY_CORPUS_LEAK_TERMS = frozenset(
    {
        "triangulationresult",
        "freezeeligible",
        "r3_triangulation",
        "cg7_fd_refrigerator_r3",
        "functional_role_triangulated",
        "french_door_refrigerator_cg7x_candidate",
        "lg_lrmvs_fd_cg7x_observation",
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
SAMSUNG_OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays"
    / "samsung_fridge_bespoke.json"
)

PLATFORM_COMPONENTS = [
    {
        "id": "linear_compressor",
        "name": "Linear compressor (R-600a)",
        "aliases": ["linear compressor", "linear_compressor"],
        "systemId": "cooling",
        "type": "actuator",
        "implementsPlatformId": "compressor_controller",
        "implementsConditionalConceptId": "compressor",
        "conditionalInstanceScope": "linear_compressor_r600a",
        "note": "LG linear drive path — platform layer, not canonical compressor.",
    },
    {
        "id": "freezer_defrost_ntc",
        "name": "Freezer defrost NTC (F dS)",
        "aliases": ["f ds", "freezer defrost sensor"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "instanceScope": "freezer",
    },
    {
        "id": "fridge_defrost_ntc",
        "name": "Fridge defrost NTC (r dS)",
        "aliases": ["r ds", "fridge defrost sensor"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "instanceScope": "fresh_food",
    },
    {
        "id": "icing_fan",
        "name": "Icing compartment fan",
        "aliases": ["icing fan", "i-fan"],
        "systemId": "airflow",
        "type": "actuator",
        "implementsCanonicalId": "evaporator_fan",
        "instanceScope": "icing_room",
        "note": "E IF — platform detail under canonical evaporator_fan.",
    },
    {
        "id": "wifi_modem",
        "name": "ThinQ Wi-Fi modem",
        "aliases": ["wifi modem", "thinQ modem"],
        "systemId": "connectivity",
        "type": "controller",
        "note": "E Od connectivity — platform adjunct, not canonical user_interface.",
    },
    {
        "id": "ice_maker_module",
        "name": "Ice maker module",
        "aliases": ["ice maker module", "ice_maker_module"],
        "systemId": "ice_maker",
        "type": "actuator",
        "implementsConditionalConceptId": "ice_maker",
        "note": "E ID/E IU — implements conditional ice_maker only.",
    },
]

CONDITIONAL_BINDINGS = [
    {
        "conditionalConceptId": "compressor",
        "instanceScope": "linear_compressor_r600a",
        "procedureIds": ["lglrmvs-sealed-system"],
    },
    {
        "conditionalConceptId": "condenser_fan",
        "procedureIds": ["lglrmvs-condenser-fan"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "fresh_food",
        "procedureIds": ["lglrmvs-ff-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "freezer",
        "procedureIds": ["lglrmvs-fz-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "convert_drawer",
        "procedureIds": ["lglrmvs-convert-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "icing_room",
        "procedureIds": ["lglrmvs-icing-sensor"],
    },
    {
        "conditionalConceptId": "ice_maker",
        "procedureIds": ["lglrmvs-ice-maker-electrical"],
    },
]

PROCEDURE_BINDINGS = [
    {"procedureId": "lglrmvs-test-mode-entry", "canonicalComponents": ["control_board"]},
    {"procedureId": "lglrmvs-display-communication", "canonicalComponents": ["control_board", "user_interface"]},
    {"procedureId": "lglrmvs-display-mode", "canonicalComponents": ["control_board", "user_interface"]},
    {"procedureId": "lglrmvs-damper-test", "canonicalComponents": ["air_damper"]},
    {"procedureId": "lglrmvs-ff-fan", "canonicalComponents": ["evaporator_fan"], "instanceScope": "fresh_food"},
    {"procedureId": "lglrmvs-fz-fan", "canonicalComponents": ["evaporator_fan"], "instanceScope": "freezer"},
    {"procedureId": "lglrmvs-fz-defrost-heater", "canonicalComponents": ["defrost_heater"], "instanceScope": "freezer"},
    {"procedureId": "lglrmvs-ff-defrost-heater", "canonicalComponents": ["defrost_heater"], "instanceScope": "fresh_food"},
    {"procedureId": "lglrmvs-sealed-system", "conditionalConcepts": ["compressor"], "instanceScope": "linear_compressor_r600a"},
    {"procedureId": "lglrmvs-condenser-fan", "conditionalConcepts": ["condenser_fan"]},
    {"procedureId": "lglrmvs-ff-sensor", "conditionalConcepts": ["temperature_sensor"], "instanceScope": "fresh_food"},
    {"procedureId": "lglrmvs-fz-sensor", "conditionalConcepts": ["temperature_sensor"], "instanceScope": "freezer"},
    {"procedureId": "lglrmvs-convert-sensor", "conditionalConcepts": ["temperature_sensor"], "instanceScope": "convert_drawer"},
    {"procedureId": "lglrmvs-icing-sensor", "conditionalConcepts": ["temperature_sensor"], "instanceScope": "icing_room"},
    {"procedureId": "lglrmvs-ice-maker-electrical", "conditionalConcepts": ["ice_maker"]},
]

OEM_ALIASES = {
    "main pcb": "control_board",
    "main pba": "control_board",
    "test mode": "control_board",
    "display panel": "user_interface",
    "display_panel": "user_interface",
    "demo mode": "user_interface",
    "evap_fan": "evaporator_fan",
    "r-fan": "evaporator_fan",
    "f-fan": "evaporator_fan",
    "i-fan": "evaporator_fan",
    "damper": "air_damper",
    "thermistor": "temperature_sensor",
    "compressor": "compressor",
    "linear compressor": "compressor",
    "condenser fan": "condenser_fan",
    "ice maker": "ice_maker",
    "sealed system": "sealed_system",
}

DISPLAY_TERMS = {
    "control_board": "Main PCB (test mode ×1/×2/×3 orchestration)",
    "user_interface": "Display panel (E CO / demo OFF mode)",
    "evaporator_fan": "R/F/I evaporator-path fans (E rF/FF/IF)",
    "air_damper": "Damper close test (22 22 display)",
    "defrost_heater": "FF/FZ defrost heaters (r dH / F dH)",
    "temperature_sensor": "Compartment NTCs (rS/FS/IS/CS — conditional scopes)",
    "compressor": "Linear R-600a compressor (conditional)",
    "condenser_fan": "Condenser fan (E CF — conditional)",
    "linear_compressor": "Linear compressor drive (platform)",
    "sealed_system": "CH/CL leak-cycle routing — not canonical",
    "ice_maker": "In-door ice maker kit (conditional optional feature)",
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
        "label": "LG LRMVS InstaView French-door refrigerator (LRMVS3006)",
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "platformFamilies": [
            {
                "platformFamilyId": PLATFORM_FAMILY_ID,
                "platformId": PLATFORM_ID,
                "manualId": MANUAL_ID,
                "label": "LG LRMVS3006 InstaView 4-door French door",
                "appliesTo": {
                    "templateId": "refrigerator",
                    "manufacturers": ["LG"],
                    "modelPatterns": ["LRMVS*", "LRMDS*"],
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
                    "priorPublishedManualIds": PRIOR_MANUAL_IDS,
                    "priorOverlays": ["whirlpool_jazz_french_door.json", "samsung_fridge_bespoke.json"],
                    "discoveryCorpusImportBlocked": True,
                },
            }
        ],
        "status": "draft",
        "gateKind": GATE_KIND,
        "compoundingEvidence": {
            "phase": "CG-8",
            "workPackage": "WP3",
            "isLearningEvent": True,
            "isCertification": False,
            "manualId": MANUAL_ID,
            "priorPublishedManualIds": PRIOR_MANUAL_IDS,
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


def assert_overlay_isolation(overlay: dict[str, Any]) -> None:
    family = _family(overlay)
    implementation_blob = json.dumps(
        {
            "aliases": family.get("oemTermAliases") or {},
            "components": (family.get("add") or {}).get("components") or [],
            "bindings": family.get("procedureBindings") or [],
            "displayTerms": family.get("displayTerms") or {},
            "deferred": family.get("deferredArtifacts") or [],
        }
    ).lower()
    for term in PRIOR_OVERLAY_LEAK_TERMS | DISCOVERY_CORPUS_LEAK_TERMS:
        if term in implementation_blob:
            raise GatePublishError(f"Overlay isolation leak detected: {term}")


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
            "conceptId": "sealed_system",
            "teachingId": "lg-sealed-system-routing",
            "verdict": "reject_canonical_promotion",
            "note": "E CH/E CL routing — PLATFORM_ONLY per CG-7 freeze.",
        },
        {
            "conceptId": "defrost_system",
            "teachingId": "lg-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
        },
        {
            "conceptId": "cooling_system",
            "teachingId": "lg-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
        },
        {
            "conceptId": "airflow_path",
            "teachingId": "lg-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
        },
    ]
    applied["routingRejections"] = ["sealed_system", "defrost_system", "cooling_system", "airflow_path"]

    family["deferredArtifacts"] = [
        {
            "teachingId": "lg-door-switch-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_insufficient_procedure_evidence",
            "note": "No LRMVS door-switch procedure — CG-7 triangulation phrases not imported.",
        },
        {
            "teachingId": "lg-water-dispenser-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_no_standalone_diagnostic",
        },
        {
            "teachingId": "lg-humidity-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_single_manufacturer_feature",
        },
        {
            "teachingId": "lg-power-supply-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_cg7_deferred_concept",
        },
    ]
    applied["deferredArtifacts"] = [d["teachingId"] for d in family["deferredArtifacts"]]

    assert_overlay_isolation(overlay)

    overlay["compoundingEvidence"] = {
        "phase": "CG-8",
        "workPackage": "WP3",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "priorPublishedManualIds": PRIOR_MANUAL_IDS,
        "isLearningEvent": True,
        "isCertification": False,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "accounting": ledger.get("accounting") or ledger.get("summary") or {},
        "headlineMetric": {"canonicalExpansion": 0},
        "hardInvariants": {
            "canonicalExpansion": 0,
            "discoveryCorpusInheritance": 0,
        },
        "publishedAt": datetime.now(timezone.utc).isoformat() if publish else None,
    }
    overlay["status"] = "published" if publish else "draft"
    overlay["gateKind"] = GATE_KIND

    plan = {
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "publishMode": "gate_table_authoritative_third_manual_compounding",
        "applied": applied,
        "accounting": ledger.get("accounting") or {},
        "manufacturerIsolation": {
            "priorOverlays": ["whirlpool_jazz_french_door.json", "samsung_fridge_bespoke.json"],
            "discoveryCorpusImportBlocked": True,
        },
    }
    return overlay, plan


def build_publication_plan(table: dict[str, Any], ledger: dict[str, Any]) -> dict[str, Any]:
    return {
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "publishMode": "gate_table_authoritative_third_manual_compounding",
        "gateKind": GATE_KIND,
        "isLearningEvent": True,
        "isCertification": False,
        "priorPublishedManualIds": PRIOR_MANUAL_IDS,
        "accounting": ledger.get("accounting") or ledger.get("summary") or {},
        "headlineMetric": {"canonicalExpansion": 0},
        "hardInvariants": {
            "canonicalHash": EXPECTED_CANONICAL_HASH,
            "canonicalExpansion": 0,
            "whirlpoolOverlayMutation": 0,
            "samsungOverlayMutation": 0,
            "discoveryCorpusInheritance": 0,
        },
    }
