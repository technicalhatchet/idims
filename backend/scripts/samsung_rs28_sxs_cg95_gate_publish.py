#!/usr/bin/env python3
"""CG-9.5 WP1 — Gate-table publisher for Samsung RS28 SxS → samsung_sxs overlay."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANUAL_ID = "SAMSUNG-RS28-SXS"
PLATFORM_ID = "samsung_sxs"
PLATFORM_FAMILY_ID = "samsung_sxs"
OVERLAY_FILE = "samsung_sxs.json"
GATE_TABLE_ARTIFACT = "SAMSUNG_RS28_SXS_overlay_mapping_table_v1.json"
LEDGER_ARTIFACT = "SAMSUNG_RS28_SXS_gate_decision_ledger_v1.json"
BOUNDARY_PROBE = "SAMSUNG_RS28_SXS_REFRIGERATOR_FAMILY_BOUNDARY_OBSERVATION_v1.json"
GATE_KIND = "sxs_production_compounding_samsung"
EXPECTED_CANONICAL_HASH = "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9"
EXPECTED_LEARNING_DECISION_IDS = frozenset(
    {
        "samsung-rs28-inverter-board-platform",
        "samsung-rs28-io-expander-platform",
        "samsung-rs28-defrost-sensor-platform",
        "samsung-rs28-damper-motor-platform",
        "samsung-rs28-ice-subsystem-platform",
        "samsung-rs28-wifi-modem-platform",
        "samsung-rs28-dispenser-panel-platform",
        "samsung-rs28-c-fan-platform",
        "samsung-rs28-aggregate-resurrection-blocked",
        "samsung-rs28-cg9-evidence-isolation",
    }
)
RF23BB_LEAK_TERMS = frozenset(
    {
        "samsungbespoke",
        "rf23bb",
        "flex_zone",
        "ice_room",
        "samsung-compressor-inverter",
        "jazz-door-switch",
        "em2y60",
        "relay_drive_em2y60",
        "defrost_thermostat",
        "whirlpool_jazz_french_door",
        "linear_compressor",
        "lglrmvs-",
        "icing_fan",
        "icing_room",
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

PLATFORM_COMPONENTS = [
    {
        "id": "inverter_board",
        "name": "Compressor inverter PBA",
        "aliases": ["inverter board", "inverter_board", "inverter PBA"],
        "systemId": "cooling",
        "type": "controller",
        "implementsPlatformId": "compressor_controller",
        "note": "44Er/84C inverter-mediated drive — platform layer, not canonical compressor.",
    },
    {
        "id": "io_expander",
        "name": "IO expander board",
        "aliases": ["io expander", "io_expander", "I/O expander"],
        "systemId": "control",
        "type": "controller",
        "implementsPlatformId": "io_expander",
        "note": "46Er main↔IO expander — platform comm path, not canonical control_board.",
    },
    {
        "id": "damper_motor",
        "name": "R-room damper motor",
        "aliases": ["damper motor", "damper_motor"],
        "systemId": "airflow",
        "type": "actuator",
        "implementsCanonicalId": "air_damper",
        "note": "Damper heater Ω on damper_motor seed — Samsung SxS air_damper implementation.",
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
        "name": "Fridge defrost NTC (FF-DEF)",
        "aliases": ["ff-def", "fridge defrost sensor"],
        "systemId": "defrost",
        "type": "sensor",
        "implementsPlatformId": "defrost_sensor",
        "instanceScope": "fresh_food",
        "note": "RF260B FF-DEF NTC — platform defrost_sensor on samsung_sxs sibling topology.",
    },
    {
        "id": "ice_pipe_heater",
        "name": "Ice pipe heater",
        "aliases": ["ice pipe heater", "ice_pipe_heater"],
        "systemId": "ice_maker",
        "type": "actuator",
        "implementsConditionalConceptId": "ice_maker",
        "note": "33E ice pipe — conditional ice_maker implementation only.",
    },
    {
        "id": "ice_maker_module",
        "name": "In-door ice maker module",
        "aliases": ["ice maker module", "ice_maker_module"],
        "systemId": "ice_maker",
        "type": "actuator",
        "implementsConditionalConceptId": "ice_maker",
        "note": "Optional ice_maker feature domain — not components[] promotion.",
    },
    {
        "id": "c_fan_convertible",
        "name": "C-FAN (convertible path)",
        "aliases": ["c-fan", "c fan", "C-FAN"],
        "systemId": "airflow",
        "type": "actuator",
        "implementsCanonicalId": "evaporator_fan",
        "instanceScope": "convertible",
        "note": (
            "22C C-FAN — platform under evaporator_fan. Role ambiguity vs condenser_fan "
            "documented; NOT condenser_fan conditional binding."
        ),
    },
    {
        "id": "wifi_modem",
        "name": "WiFi modem",
        "aliases": ["wifi modem", "wifi_modem", "ThinQ modem"],
        "systemId": "connectivity",
        "type": "controller",
        "note": "52Er WiFi comm — connectivity platform adjunct, not canonical user_interface.",
    },
    {
        "id": "dispenser_panel",
        "name": "Through-door dispenser panel",
        "aliases": ["dispenser panel", "dispenser_panel"],
        "systemId": "water_dispenser",
        "type": "controller",
        "implementsConditionalConceptId": "water_dispenser",
        "note": "47Er dispenser comm — implements conditional water_dispenser.",
    },
]

CONDITIONAL_BINDINGS = [
    {
        "conditionalConceptId": "compressor",
        "instanceScope": "inverter_pba_mediated",
        "procedureIds": ["samsungrs28-inverter-communication"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "freezer",
        "procedureIds": ["samsungrs28-f-sensor", "samsungrf260b-fz-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "fresh_food",
        "procedureIds": ["samsungrs28-r-sensor", "samsungrf260b-ff-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "ambient",
        "procedureIds": ["samsungrs28-ambient-sensor", "samsungrf260b-ambient-sensor"],
    },
    {
        "conditionalConceptId": "temperature_sensor",
        "instanceScope": "pantry",
        "procedureIds": ["samsungrf260b-pantry-sensor"],
    },
    {
        "conditionalConceptId": "ice_maker",
        "procedureIds": [
            "samsungrs28-ice-maker-sensor",
            "samsungrs28-ice-maker-function",
            "samsungrs28-ice-pipe-heater",
            "samsungrf260b-ice-maker-sensor",
            "samsungrf260b-ice-maker-function",
        ],
    },
    {
        "conditionalConceptId": "water_dispenser",
        "procedureIds": ["samsungrs28-dispenser-communication"],
    },
]

PROCEDURE_BINDINGS = [
    {
        "procedureId": "samsungrs28-engineer-test-entry",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "samsungrs28-self-diagnostic-entry",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "samsungrs28-led-test-mode-entry",
        "canonicalComponents": ["control_board"],
    },
    {
        "procedureId": "samsungrs28-panel-communication",
        "canonicalComponents": ["user_interface"],
    },
    {
        "procedureId": "samsungrf260b-panel-communication",
        "canonicalComponents": ["user_interface"],
    },
    {
        "procedureId": "samsungrs28-f-defrost-heater",
        "canonicalComponents": ["defrost_heater"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "samsungrf260b-fz-defrost-heater",
        "canonicalComponents": ["defrost_heater"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "samsungrf260b-ff-defrost-heater",
        "canonicalComponents": ["defrost_heater"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "samsungrs28-f-fan",
        "canonicalComponents": ["evaporator_fan"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "samsungrf260b-fz-fan",
        "canonicalComponents": ["evaporator_fan"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "samsungrf260b-ff-fan",
        "canonicalComponents": ["evaporator_fan"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "samsungrs28-damper-heater",
        "canonicalComponents": ["air_damper"],
    },
    {
        "procedureId": "samsungrs28-inverter-communication",
        "conditionalConcepts": ["compressor"],
        "instanceScope": "inverter_pba_mediated",
    },
    {
        "procedureId": "samsungrs28-f-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "samsungrf260b-fz-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "freezer",
    },
    {
        "procedureId": "samsungrs28-r-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "samsungrf260b-ff-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "fresh_food",
    },
    {
        "procedureId": "samsungrs28-ambient-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "ambient",
    },
    {
        "procedureId": "samsungrf260b-ambient-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "ambient",
    },
    {
        "procedureId": "samsungrf260b-pantry-sensor",
        "conditionalConcepts": ["temperature_sensor"],
        "instanceScope": "pantry",
    },
    {
        "procedureId": "samsungrs28-ice-maker-sensor",
        "conditionalConcepts": ["ice_maker"],
    },
    {
        "procedureId": "samsungrs28-ice-maker-function",
        "conditionalConcepts": ["ice_maker"],
    },
    {
        "procedureId": "samsungrs28-ice-pipe-heater",
        "conditionalConcepts": ["ice_maker"],
    },
    {
        "procedureId": "samsungrf260b-ice-maker-sensor",
        "conditionalConcepts": ["ice_maker"],
    },
    {
        "procedureId": "samsungrf260b-ice-maker-function",
        "conditionalConcepts": ["ice_maker"],
    },
    {
        "procedureId": "samsungrs28-dispenser-communication",
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
    "io expander": "io_expander",
    "evap_fan": "evaporator_fan",
    "f-fan": "evaporator_fan",
    "fz fan": "evaporator_fan",
    "ff fan": "evaporator_fan",
    "c-fan": "c_fan_convertible",
    "damper_motor": "damper_motor",
    "thermistor": "temperature_sensor",
    "compressor": "compressor",
    "ice maker": "ice_maker",
    "dispenser panel": "dispenser_panel",
    "wifi modem": "wifi_modem",
}

DISPLAY_TERMS = {
    "control_board": "Main PBA (engineer mode / self-diagnosis orchestration)",
    "user_interface": "Display panel (41Er main↔panel communication)",
    "evaporator_fan": "Multi-compartment fans (F/FZ/FF + C-FAN platform)",
    "air_damper": "R-room damper heater (CN40)",
    "defrost_heater": "F-DEF / FZ-DEF / FF-DEF defrost heaters",
    "temperature_sensor": "Compartment NTCs (F/R/ambient/pantry — conditional scopes)",
    "compressor": "Inverter PBA-mediated compressor (conditional)",
    "inverter_board": "Inverter PBA / IPM (platform compressor_controller)",
    "ice_maker": "In-door ice subsystem (conditional optional feature)",
    "water_dispenser": "Through-door dispenser (47Er — conditional optional feature)",
    "io_expander": "IO expander (46Er harness)",
    "wifi_modem": "WiFi modem (52Er — platform connectivity)",
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
        "label": "Samsung side-by-side refrigerator (RS28 / RF260B)",
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "platformFamilies": [
            {
                "platformFamilyId": PLATFORM_FAMILY_ID,
                "platformId": PLATFORM_ID,
                "manualId": MANUAL_ID,
                "label": "Samsung SxS RS28/RS23 SpaceMax + RF260B platform",
                "appliesTo": {
                    "templateId": "refrigerator",
                    "manufacturers": ["Samsung"],
                    "modelPatterns": [
                        "RS28A*",
                        "RS23A*",
                        "RS22T*",
                        "RS27T*",
                        "RS28T5B*",
                        "RS5300*",
                        "RF260B*",
                        "RF261B*",
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
                    "priorOverlayBlocked": "samsung_fridge_bespoke.json",
                    "rf23bbOverlayImportBlocked": True,
                    "cg9BoundaryProbe": BOUNDARY_PROBE,
                    "cg9AutoApprovalBlocked": True,
                },
            }
        ],
        "status": "draft",
        "gateKind": GATE_KIND,
        "compoundingEvidence": {
            "phase": "CG-9.5",
            "workPackage": "WP1",
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
    """Check Samsung SxS overlay does not inherit RF23BB/Jazz/LG vocabulary."""
    scrubbed = json.loads(json.dumps(overlay))
    for key in ("compoundingEvidence",):
        block = scrubbed.get(key) or {}
        block.pop("boundaryProbeArtifact", None)
        scrubbed[key] = block
    family = (scrubbed.get("platformFamilies") or [{}])[0]
    family.pop("manufacturerIsolation", None)
    blob = json.dumps(scrubbed).lower()
    for term in RF23BB_LEAK_TERMS | CG7_DISCOVERY_LEAK_TERMS:
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
            "teachingId": "samsung-rs28-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Self-diagnostic checklist decomposes to members — aggregate remains dead.",
        },
        {
            "conceptId": "cooling_system",
            "teachingId": "samsung-rs28-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Inverter/PBA vocabulary does not resurrect cooling_system aggregate.",
        },
        {
            "conceptId": "airflow_path",
            "teachingId": "samsung-rs28-aggregate-resurrection-blocked",
            "verdict": "reject_aggregate_resurrection",
            "note": "Multi-fan topology stays under evaporator_fan + platform instances.",
        },
        {
            "conceptId": "condenser_fan",
            "teachingId": "samsung-rs28-condenser-fan-abstention",
            "verdict": "defer_conditional_binding",
            "note": "C-FAN role ambiguous — NOT promoted to condenser_fan conditional.",
        },
    ]
    applied["routingRejections"] = [
        "defrost_system",
        "cooling_system",
        "airflow_path",
        "condenser_fan",
    ]

    family["deferredArtifacts"] = [
        {
            "teachingId": "samsung-rs28-door-switch-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_insufficient_procedure_evidence",
            "note": "No standalone RS28 door-switch procedure — svc manual flowchart only.",
        },
        {
            "teachingId": "samsung-rs28-condenser-fan-abstention",
            "disposition": "intentional_abstention",
            "layer": "defer_role_ambiguity",
            "procedureIds": ["samsungrs28-c-fan", "samsungrf260b-c-fan"],
            "note": "C-FAN bound to evaporator_fan platform — condenser_fan conditional withheld.",
        },
        {
            "teachingId": "samsung-rs28-humidity-abstention",
            "procedureIds": [
                "samsungrs28-humidity-sensor",
                "samsungrf260b-humidity-sensor",
            ],
            "disposition": "intentional_abstention",
            "layer": "defer_single_manufacturer_feature",
        },
        {
            "teachingId": "samsung-rs28-wifi-canonical-abstention",
            "procedureIds": ["samsungrs28-wifi-communication"],
            "disposition": "intentional_abstention",
            "layer": "defer_connectivity_not_hmi",
        },
    ]
    applied["deferredArtifacts"] = [d["teachingId"] for d in family["deferredArtifacts"]]

    assert_no_prior_overlay_leak(overlay)

    overlay["compoundingEvidence"] = {
        "phase": "CG-9.5",
        "workPackage": "WP1",
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
            "priorOverlayBlocked": "samsung_fridge_bespoke.json",
            "rf23bbLeakTermsChecked": sorted(RF23BB_LEAK_TERMS),
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
