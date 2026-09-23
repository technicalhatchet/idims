#!/usr/bin/env python3
"""CG-8 WP2 — Gate-table publisher for Samsung RF23BB → samsung_fridge_bespoke overlay."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANUAL_ID = "SAMSUNG-RF23BB-FRIDGE"
PLATFORM_ID = "samsung_fridge_bespoke"
PLATFORM_FAMILY_ID = "samsung_fridge_bespoke"
OVERLAY_FILE = "samsung_fridge_bespoke.json"
GATE_TABLE_ARTIFACT = "SAMSUNG_RF23BB_FD_overlay_mapping_table_v1.json"
LEDGER_ARTIFACT = "SAMSUNG_RF23BB_FD_gate_decision_ledger_v1.json"
GATE_KIND = "samsung_rf23bb_second_manual_compounding"
PRIOR_MANUAL_ID = "W10322959"
EXPECTED_CANONICAL_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
EXPECTED_LEARNING_DECISION_IDS = frozenset(
    {
        "samsung-inverter-board-platform",
        "samsung-main-inverter-comm-platform",
        "samsung-defrost-sensor-platform",
        "samsung-damper-motor-platform",
        "samsung-ice-subsystem-platform",
        "samsung-aggregate-resurrection-blocked",
        "samsung-ice-room-fan-platform",
    }
)
JAZZ_LEAK_TERMS = frozenset(
    {
        "em2y60",
        "relay_drive_em2y60",
        "defrost_thermostat",
        "compressor_relay",
        "start_capacitor",
        "whirlpool_jazz_french_door",
        "jazz-door-switch",
        "jazz-compressor-relay",
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

PLATFORM_COMPONENTS = [
    {
        "id": "inverter_board",
        "name": "Compressor inverter PBA",
        "aliases": ["inverter board", "inverter_board", "inverter PBA"],
        "systemId": "cooling",
        "type": "controller",
        "implementsPlatformId": "compressor_controller",
        "note": "44E/84C inverter-mediated drive — platform layer, not canonical compressor.",
    },
    {
        "id": "damper_motor",
        "name": "Flex-zone damper motor",
        "aliases": ["damper motor", "damper_motor"],
        "systemId": "airflow",
        "type": "actuator",
        "implementsCanonicalId": "air_damper",
        "note": "Damper heater Ω on damper_motor seed — Samsung air_damper implementation.",
    },
    {
        "id": "freezer_defrost_ntc",
        "name": "Freezer defrost NTC (F-DEF)",
        "aliases": ["f-def", "freezer defrost sensor"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "instanceScope": "freezer",
        "note": "Platform defrost_sensor vocabulary — not cabinet temperature_sensor.",
    },
    {
        "id": "fridge_defrost_ntc",
        "name": "Fridge defrost NTC (R-DEF)",
        "aliases": ["r-def", "fridge defrost sensor"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "instanceScope": "fresh_food",
        "note": "Platform defrost_sensor vocabulary — not cabinet temperature_sensor.",
    },
    {
        "id": "ice_pipe_heater",
        "name": "Ice pipe / duct heater",
        "aliases": ["ice pipe heater", "ice_pipe_heater"],
        "systemId": "ice_maker",
        "type": "actuator",
        "implementsConditionalConceptId": "ice_maker",
        "note": "Ice subsystem hardware — conditional ice_maker implementation only.",
    },
    {
        "id": "ice_maker_module",
        "name": "Ice maker module",
        "aliases": ["ice maker module", "ice_maker_module"],
        "systemId": "ice_maker",
        "type": "actuator",
        "implementsConditionalConceptId": "ice_maker",
        "note": "Optional ice_maker feature domain — not components[] promotion.",
    },
    {
        "id": "ice_room_fan",
        "name": "Ice room evaporator fan",
        "aliases": ["ice room fan", "ice-room fan"],
        "systemId": "airflow",
        "type": "actuator",
        "implementsCanonicalId": "evaporator_fan",
        "instanceScope": "ice_room",
        "note": "Compartment-specific fan under canonical evaporator_fan — platform detail.",
    },
]

CONDITIONAL_BINDINGS = [
    {
        "conditionalConceptId": "compressor",
        "instanceScope": "inverter_pba_mediated",
        "procedureIds": ["samsungbespoke-compressor-inverter"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "fresh_food",
        "procedureIds": ["samsungbespoke-fridge-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "freezer",
        "procedureIds": ["samsungbespoke-freezer-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "flex_zone",
        "procedureIds": ["samsungbespoke-flex-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "ambient",
        "procedureIds": ["samsungbespoke-ambient-sensor"],
    },
    {
        "conditionalConceptId": "ice_maker",
        "procedureIds": [
            "samsungbespoke-ice-maker-sensor",
            "samsungbespoke-ice-room-fan",
            "samsungbespoke-ice-room-heater",
        ],
    },
    {
        "conditionalConceptId": "water_dispenser",
        "procedureIds": ["samsungbespoke-autofill-overflow"],
    },
]

PROCEDURE_BINDINGS = [
    {
        "procedureId": "samsungbespoke-engineer-mode-rf23bb-inner",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "samsungbespoke-fhub-engineer-entry",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "samsungbespoke-self-diagnosis-entry",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "samsungbespoke-main-panel-comm",
        "canonicalComponents": ["user_interface"],
    },
    {
        "procedureId": "samsungbespoke-freezer-defrost-heater",
        "canonicalComponents": ["defrost_heater"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "samsungbespoke-freezer-fan",
        "canonicalComponents": ["evaporator_fan"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "samsungbespoke-fridge-fan",
        "canonicalComponents": ["evaporator_fan"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "samsungbespoke-convertible-fan",
        "canonicalComponents": ["evaporator_fan"],
        "instanceScope": "convertible",
    },
    {
        "procedureId": "samsungbespoke-damper-heater-135",
        "canonicalComponents": ["air_damper"],
    },
    {
        "procedureId": "samsungbespoke-damper-heater-24",
        "canonicalComponents": ["air_damper"],
    },
    {
        "procedureId": "samsungbespoke-compressor-inverter",
        "conditionalConcepts": ["compressor"],
        "instanceScope": "inverter_pba_mediated",
    },
    {
        "procedureId": "samsungbespoke-fridge-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "samsungbespoke-freezer-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "samsungbespoke-flex-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "flex_zone",
    },
    {
        "procedureId": "samsungbespoke-ambient-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "ambient",
    },
    {
        "procedureId": "samsungbespoke-ice-maker-sensor",
        "conditionalConcepts": ["ice_maker"],
    },
    {
        "procedureId": "samsungbespoke-autofill-overflow",
        "conditionalConcepts": ["water_dispenser"],
    },
]

OEM_ALIASES = {
    "main pcb": "control_board",
    "main pba": "control_board",
    "engineer mode": "control_board",
    "self diagnosis": "control_board",
    "display panel": "user_interface",
    "display_panel": "user_interface",
    "inverter board": "inverter_board",
    "inverter_board": "inverter_board",
    "evap_fan": "evaporator_fan",
    "f-fan": "evaporator_fan",
    "fridge fan": "evaporator_fan",
    "freezer fan": "evaporator_fan",
    "c-fan": "evaporator_fan",
    "damper_motor": "damper_motor",
    "thermistor": "temperature_sensor",
    "compressor": "compressor",
    "ice maker": "ice_maker",
    "autofill": "water_dispenser",
}

DISPLAY_TERMS = {
    "control_board": "Main PBA (engineer mode / self-diagnosis orchestration)",
    "user_interface": "Display panel (41E main↔panel communication)",
    "evaporator_fan": "Multi-compartment fans (F/R/C — canonical; ice-room platform)",
    "air_damper": "Flex-zone damper heater (135 Ω / 24 Ω)",
    "defrost_heater": "Freezer defrost heater (CN20)",
    "temperature_sensor": "Compartment NTCs (R/F/flex/ambient — conditional scopes)",
    "compressor": "Inverter PBA-mediated compressor (conditional)",
    "inverter_board": "Inverter PBA / IPM (platform compressor_controller)",
    "ice_maker": "Ice subsystem (conditional optional feature)",
    "water_dispenser": "AutoFill overflow path (conditional optional feature)",
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
        "manufacturer": "Samsung",
        "label": "Samsung Bespoke French-door refrigerator (RF23BB)",
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "platformFamilies": [
            {
                "platformFamilyId": PLATFORM_FAMILY_ID,
                "platformId": PLATFORM_ID,
                "manualId": MANUAL_ID,
                "label": "Samsung Bespoke 4-door RF23BB / RF23BB8600",
                "appliesTo": {
                    "templateId": "refrigerator",
                    "manufacturers": ["Samsung"],
                    "modelPatterns": ["RF23BB*", "RF23B*"],
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
                    "priorPublishedManualIds": [PRIOR_MANUAL_ID],
                    "whirlpoolOverlayImportBlocked": True,
                },
            }
        ],
        "status": "draft",
        "gateKind": GATE_KIND,
        "compoundingEvidence": {
            "phase": "CG-8",
            "workPackage": "WP2",
            "isLearningEvent": True,
            "isCertification": False,
            "manualId": MANUAL_ID,
            "priorPublishedManualIds": [PRIOR_MANUAL_ID],
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


def assert_no_jazz_leak(overlay: dict[str, Any]) -> None:
    """Check Samsung overlay does not inherit Jazz implementation vocabulary."""
    scrubbed = json.loads(json.dumps(overlay))
    for key in ("compoundingEvidence",):
        block = scrubbed.get(key) or {}
        block.pop("priorPublishedManualIds", None)
        scrubbed[key] = block
    family = (scrubbed.get("platformFamilies") or [{}])[0]
    family.pop("manufacturerIsolation", None)
    blob = json.dumps(scrubbed).lower()
    for term in JAZZ_LEAK_TERMS:
        if term in blob:
            raise GatePublishError(f"Whirlpool Jazz overlay leak detected: {term}")


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
            "teachingId": "samsung-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Fd forced-defrost mode decomposes to members — aggregate remains dead.",
        },
        {
            "conceptId": "cooling_system",
            "teachingId": "samsung-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Inverter/PBA vocabulary does not resurrect cooling_system aggregate.",
        },
        {
            "conceptId": "airflow_path",
            "teachingId": "samsung-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Multi-fan topology stays under evaporator_fan + platform instances.",
        },
    ]
    applied["routingRejections"] = ["defrost_system", "cooling_system", "airflow_path"]

    family["deferredArtifacts"] = [
        {
            "teachingId": "samsung-door-switch-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_insufficient_procedure_evidence",
            "note": "No standalone RF23BB door-switch procedure — do not inherit Jazz evidence.",
        },
        {
            "teachingId": "samsung-condenser-fan-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_no_standalone_diagnostic",
        },
        {
            "teachingId": "samsung-humidity-abstention",
            "procedureIds": ["samsungbespoke-humidity-sensor"],
            "disposition": "intentional_abstention",
            "layer": "defer_single_manufacturer_feature",
        },
        {
            "teachingId": "samsung-water-level-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_insufficient_cross_manual_evidence",
        },
    ]
    applied["deferredArtifacts"] = [d["teachingId"] for d in family["deferredArtifacts"]]

    assert_no_jazz_leak(overlay)

    overlay["compoundingEvidence"] = {
        "phase": "CG-8",
        "workPackage": "WP2",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "priorPublishedManualIds": [PRIOR_MANUAL_ID],
        "isLearningEvent": True,
        "isCertification": False,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
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
        "publishMode": "gate_table_authoritative_second_manual_compounding",
        "applied": applied,
        "accounting": ledger.get("accounting") or {},
        "manufacturerIsolation": {
            "priorOverlay": "whirlpool_jazz_french_door.json",
            "jazzLeakTermsChecked": sorted(JAZZ_LEAK_TERMS),
        },
    }
    return overlay, plan


def build_publication_plan(table: dict[str, Any], ledger: dict[str, Any]) -> dict[str, Any]:
    return {
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "publishMode": "gate_table_authoritative_second_manual_compounding",
        "gateKind": GATE_KIND,
        "isLearningEvent": True,
        "isCertification": False,
        "priorPublishedManualIds": [PRIOR_MANUAL_ID],
        "accounting": ledger.get("accounting") or ledger.get("summary") or {},
        "headlineMetric": {"canonicalExpansion": 0},
    }
