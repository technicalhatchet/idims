#!/usr/bin/env python3
"""CG-8 — Gate-table publisher for Whirlpool Jazz W10322959 → whirlpool_jazz_french_door overlay."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANUAL_ID = "W10322959"
PLATFORM_ID = "whirlpool_jazz_french_door"
PLATFORM_FAMILY_ID = "whirlpool_jazz_french_door"
OVERLAY_FILE = "whirlpool_jazz_french_door.json"
GATE_TABLE_ARTIFACT = "WHIRLPOOL_JAZZ_FD_overlay_mapping_table_v1.json"
LEDGER_ARTIFACT = "WHIRLPOOL_JAZZ_FD_gate_decision_ledger_v1.json"
GATE_KIND = "whirlpool_jazz_first_manual_compounding"
EXPECTED_CANONICAL_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
EXPECTED_LEARNING_DECISION_IDS = frozenset(
    {
        "jazz-defrost-bimetal-platform",
        "jazz-compressor-relay-platform",
        "jazz-damper-motor-platform",
        "jazz-sealed-system-complaint-routing",
    }
)

ROOT = Path(__file__).resolve().parents[2]
CALIBRATION = ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
CANONICAL_PATH = ROOT / "frontend/components/diagnostics/knowledge/canonical/french_door_refrigerator.json"
OVERLAY_PATH = (
    ROOT / "frontend/components/diagnostics/knowledge/canonical/manufacturer_overlays" / OVERLAY_FILE
)

PLATFORM_COMPONENTS = [
    {
        "id": "defrost_thermostat",
        "name": "Defrost bimetal / thermostat",
        "aliases": ["defrost thermostat", "defrost_thermostat"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "implementsCanonicalId": "defrost_heater",
        "note": "Jazz bimetal termination — platform defrost_sensor vocabulary; pairs with defrost_heater test 1.",
    },
    {
        "id": "damper_motor",
        "name": "Fresh-food damper motor",
        "aliases": ["damper motor", "damper_motor"],
        "systemId": "airflow",
        "type": "actuator",
        "implementsCanonicalId": "air_damper",
        "note": "Jazz damper motor implements frozen air_damper — service test 6.",
    },
    {
        "id": "compressor_relay",
        "name": "Compressor relay",
        "aliases": ["relay", "compressor relay"],
        "systemId": "cooling",
        "type": "actuator",
        "implementsPlatformId": "compressor_controller",
        "note": "Jazz relay-drive path — not canonical compressor.",
    },
    {
        "id": "start_capacitor",
        "name": "Compressor start capacitor",
        "aliases": ["start capacitor", "start cap"],
        "systemId": "cooling",
        "type": "passive",
        "implementsPlatformId": "compressor_controller",
        "note": "EM2Y60 start cap — platform drive electronics.",
    },
    {
        "id": "em2y60_compressor",
        "name": "EM2Y60 compressor",
        "aliases": ["em2y60", "embraco em2y60"],
        "systemId": "cooling",
        "type": "actuator",
        "implementsConditionalConceptId": "compressor",
        "conditionalInstanceScope": "relay_drive_em2y60",
        "note": "Jazz compressor actuator — conditionalConcept binding, not canonical node.",
    },
]

CONDITIONAL_BINDINGS = [
    {
        "conditionalConceptId": "compressor",
        "instanceScope": "relay_drive_em2y60",
        "procedureIds": ["w10322959-test-02-compressor"],
    },
    {
        "conditionalConceptId": "condenser_fan",
        "procedureIds": ["w10322959-test-02-compressor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "fresh_food",
        "procedureIds": ["w10322959-test-04-ff-thermistor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "freezer",
        "procedureIds": ["w10322959-test-05-fz-thermistor"],
    },
]

PROCEDURE_BINDINGS = [
    {"procedureId": "w10322959-programming-mode", "canonicalComponents": ["control_board"]},
    {"procedureId": "w10322959-service-test-entry", "canonicalComponents": ["control_board", "user_interface", "door_switch"]},
    {"procedureId": "w10322959-forced-defrost-entry", "canonicalComponents": ["control_board", "door_switch"]},
    {"procedureId": "w10322959-test-01-defrost", "canonicalComponents": ["defrost_heater"]},
    {"procedureId": "w10322959-test-02-compressor", "conditionalConcepts": ["compressor", "condenser_fan"]},
    {"procedureId": "w10322959-test-03-evap-fan", "canonicalComponents": ["evaporator_fan"], "instanceScope": "freezer"},
    {"procedureId": "w10322959-test-04-ff-thermistor", "conditionalConcepts": ["temperature_sensor"], "instanceScope": "fresh_food"},
    {"procedureId": "w10322959-test-05-fz-thermistor", "conditionalConcepts": ["temperature_sensor"], "instanceScope": "freezer"},
    {"procedureId": "w10322959-test-06-damper", "canonicalComponents": ["air_damper"]},
]

OEM_ALIASES = {
    "control board": "control_board",
    "jazz control board": "control_board",
    "programming mode": "control_board",
    "service test mode": "control_board",
    "door light switch": "door_switch",
    "door switch": "door_switch",
    "evap_fan": "evaporator_fan",
    "freezer fan": "evaporator_fan",
    "defrost heater": "defrost_heater",
    "defrost_thermostat": "defrost_thermostat",
    "damper_motor": "damper_motor",
    "thermistor": "temperature_sensor",
    "compressor": "compressor",
    "condenser_fan": "condenser_fan",
    "sealed system": "sealed_system",
}

DISPLAY_TERMS = {
    "control_board": "Jazz control board (S-E / P-E / F-d orchestration)",
    "user_interface": "Door keypad + segment display codes",
    "door_switch": "Door light switch (service-mode authorization)",
    "evaporator_fan": "Freezer/evaporator fan (service test 3)",
    "air_damper": "Fresh-food damper (service test 6)",
    "defrost_heater": "Defrost heater (service test 1)",
    "temperature_sensor": "Compartment NTC (FF test 4 / FZ test 5 — conditional scope)",
    "compressor": "EM2Y60 compressor via relay drive (conditional)",
    "defrost_thermostat": "Defrost bimetal (platform termination sensor)",
    "sealed_system": "Sealed-system complaint routing only — not canonical",
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
        "label": "Whirlpool Jazz French-door refrigerator (W10322959)",
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "platformFamilies": [
            {
                "platformFamilyId": PLATFORM_FAMILY_ID,
                "platformId": PLATFORM_ID,
                "manualId": MANUAL_ID,
                "label": "Whirlpool Jazz French-door 19–22 cu ft (WRF53/54/55/56/98/99, KRMF55)",
                "appliesTo": {
                    "templateId": "refrigerator",
                    "manufacturers": ["Whirlpool", "KitchenAid", "JennAir"],
                    "modelPatterns": ["WRF5*", "WRF9*", "KRMF5*", "KRFF5*", "GI5F*"],
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
            }
        ],
        "status": "draft",
        "gateKind": GATE_KIND,
        "compoundingEvidence": {
            "phase": "CG-8",
            "isLearningEvent": True,
            "isCertification": False,
            "manualId": MANUAL_ID,
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

    family["procedureRoleEvidence"] = [
        {
            "procedureIds": ["w10322959-service-test-entry", "w10322959-forced-defrost-entry"],
            "canonicalComponents": ["door_switch"],
            "signalPhrases": ["door light switch", "hold door switch"],
            "teachingId": "jazz-door-switch-service-entry",
        },
        {
            "procedureIds": ["w10322959-service-test-entry", "w10322959-programming-mode"],
            "canonicalComponents": ["user_interface"],
            "signalPhrases": ["refrigerator up", "freezer down", "display shows"],
            "teachingId": "jazz-user-interface-keypad",
        },
    ]

    family["routingRejections"] = [
        {
            "conceptId": "sealed_system",
            "teachingId": "jazz-sealed-system-complaint-routing",
            "verdict": "reject_canonical_promotion",
            "note": "Warm-both routing is diagnostic evidence only — PLATFORM_ONLY per CG-7 freeze.",
        },
        {
            "conceptId": "defrost_system",
            "teachingId": "jazz-defrost-interval-scheduling",
            "verdict": "reject_aggregate_resurrection",
            "note": "Adaptive defrost interval is board scheduling — not defrost_system aggregate.",
        },
    ]
    applied["routingRejections"] = ["sealed_system", "defrost_system"]

    family["deferredArtifacts"] = [
        {
            "teachingId": "jazz-ff-performance-calibration",
            "procedureIds": ["w10322959-test-07-ff-performance"],
            "disposition": "intentional_abstention",
            "layer": "defer_platform_calibration",
        },
        {
            "teachingId": "jazz-fz-performance-calibration",
            "procedureIds": ["w10322959-test-08-fz-performance"],
            "disposition": "intentional_abstention",
            "layer": "defer_platform_calibration",
        },
        {
            "teachingId": "jazz-defrost-interval-scheduling",
            "procedureIds": ["w10322959-test-09-defrost-interval"],
            "disposition": "intentional_abstention",
            "layer": "defer_overlay_scheduling",
        },
        {
            "teachingId": "jazz-water-dispenser-gap",
            "disposition": "intentional_abstention",
            "layer": "defer_optional_feature",
        },
    ]
    applied["deferredArtifacts"] = [d["teachingId"] for d in family["deferredArtifacts"]]

    overlay["compoundingEvidence"] = {
        "phase": "CG-8",
        "workPackage": "WP1",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "isLearningEvent": True,
        "isCertification": False,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "accounting": ledger.get("accounting") or ledger.get("summary") or {},
        "publishedAt": datetime.now(timezone.utc).isoformat() if publish else None,
    }
    overlay["status"] = "published" if publish else "draft"
    overlay["gateKind"] = GATE_KIND

    plan = {
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "publishMode": "gate_table_authoritative_first_manual_compounding",
        "applied": applied,
        "accounting": ledger.get("accounting") or {},
    }
    return overlay, plan


def build_publication_plan(table: dict[str, Any], ledger: dict[str, Any]) -> dict[str, Any]:
    return {
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "publishMode": "gate_table_authoritative_first_manual_compounding",
        "gateKind": GATE_KIND,
        "isLearningEvent": True,
        "isCertification": False,
        "accounting": ledger.get("accounting") or ledger.get("summary") or {},
    }
