#!/usr/bin/env python3
"""Generate WHIRLPOOL_TOP_LOAD_WASHER CG-6.6 overlay certification gate table v1.

CG-6.6 is retroactive certification of already-published Whirlpool TL overlay knowledge
against frozen top_load_washer rev1 — not new compounding or canonical discovery.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CALIBRATION = ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
CANONICAL_DIR = ROOT / "frontend/components/diagnostics/knowledge/canonical"
OUT = CALIBRATION / "WHIRLPOOL_TOP_LOAD_WASHER_CG66_overlay_mapping_table_v1.json"

MANUALS = [
    {
        "manualId": "W10864849",
        "platformId": "whirlpool_tl_dd",
        "platformFamilyId": "whirlpool_tl_dd_direct_drive",
        "nativePrefix": "w10864849-",
        "historicalPromotionId": "promo-W10864849-20260913070539",
        "historicalNewDecisions": 14,
    },
    {
        "manualId": "W11697231",
        "platformId": "whirlpool_tl_dd",
        "platformFamilyId": "whirlpool_tl_dd_direct_drive",
        "nativePrefix": "w11697231-",
        "historicalPromotionId": "promo-W11697231-20260913133238",
        "historicalNewDecisions": 0,
    },
    {
        "manualId": "W11416787",
        "platformId": "whirlpool_tl_dd_5100",
        "platformFamilyId": "whirlpool_tl_dd_5100_direct_drive",
        "nativePrefix": "w11416787-",
        "historicalPromotionId": "promo-W11416787-20260913135602",
        "historicalNewDecisions": 2,
    },
]

LID_ROLE_PROCEDURES = [
    {
        "manualId": "W10864849",
        "procedureId": "w10864849-test-08-lid-lock",
        "stepId": "switch_states",
        "roles": [
            {
                "roleId": "lid_switch_authorization",
                "canonicalComponents": ["lid_switch"],
                "signalPhrases": ["lid switch"],
            },
            {
                "roleId": "lid_lock_spin_safety",
                "canonicalComponents": ["lid_lock"],
                "signalPhrases": ["lock switch", "home"],
            },
        ],
    },
    {
        "manualId": "W11697231",
        "procedureId": "w11697231-test-08-lid-lock",
        "stepId": "switch_states",
        "roles": [
            {
                "roleId": "lid_switch_authorization",
                "canonicalComponents": ["lid_switch"],
                "signalPhrases": ["lid switch"],
            },
            {
                "roleId": "lid_lock_spin_safety",
                "canonicalComponents": ["lid_lock"],
                "signalPhrases": ["lock switch", "lock solenoid"],
            },
        ],
    },
    {
        "manualId": "W11416787",
        "procedureId": "w11416787-test-08-lid-lock",
        "stepId": "switch_states",
        "roles": [
            {
                "roleId": "lid_switch_authorization",
                "canonicalComponents": ["lid_switch"],
                "signalPhrases": ["lid switch"],
            },
            {
                "roleId": "lid_lock_spin_safety",
                "canonicalComponents": ["lid_lock"],
                "signalPhrases": ["lock switch", "lock solenoid"],
            },
        ],
    },
]

# OEM aliases that map to overlay implementation ids (not rev1 canonical ids directly).
OVERLAY_IMPLEMENTATION_ALIASES = {
    "mode_shifter": {
        "canonicalComponents": ["transmission_or_shifter"],
        "implementationComponent": "mode_shifter",
    },
    "pressure_sensor": {
        "canonicalComponents": ["water_level_sensor"],
        "implementationComponent": "pressure_sensor",
    },
    "wash_ntc": {
        "canonicalComponents": ["temperature_sensor"],
        "implementationComponent": "wash_ntc",
    },
    "supply": {
        "canonicalComponents": ["power_supply"],
        "implementationComponent": "supply",
    },
    "bulk_level_switch": {
        "canonicalComponents": [],
        "implementationComponent": "bulk_level_switch",
    },
    "wash_heater": {
        "canonicalComponents": [],
        "implementationComponent": "wash_heater",
    },
}

# Published procedure bindings grouped by canonical routing semantics.
PROCEDURE_BINDING_SPECS = [
    {
        "suffix": "test-03-drive-system",
        "testTargetId": "motor_output_test",
        "canonicalComponents": ["drive_motor"],
        "implementationComponent": None,
        "semanticAnchor": "transmission_or_shifter",
        "gateAction": "certify_inherited_overlay",
        "layer": "canonical_functional",
    },
    {
        "suffix": "test-03a-shifter",
        "testTargetId": "motor_output_test",
        "canonicalComponents": ["transmission_or_shifter"],
        "implementationComponent": "mode_shifter",
        "semanticAnchor": "shifter_test",
        "gateAction": "certify_overlay_implementation",
        "layer": "overlay_implementation",
    },
    {
        "suffix": "test-03b-motor",
        "testTargetId": "motor_output_test",
        "canonicalComponents": ["drive_motor"],
        "implementationComponent": None,
        "semanticAnchor": "motor_output_test",
        "gateAction": "certify_inherited_overlay",
        "layer": "canonical_functional",
    },
    {
        "suffix": "test-06-water-level",
        "testTargetId": "drain_test",
        "canonicalComponents": ["water_level_sensor"],
        "implementationComponent": "pressure_sensor",
        "semanticAnchor": "drain_test",
        "gateAction": "certify_overlay_implementation",
        "layer": "overlay_implementation",
    },
    {
        "suffix": "test-07-drain-recirc-pump",
        "testTargetId": "drain_test",
        "canonicalComponents": ["drain_pump", "drain_path"],
        "implementationComponent": "recirc_pump",
        "semanticAnchor": "drain_test",
        "gateAction": "certify_overlay_implementation",
        "layer": "overlay_implementation",
        "note": "recirc_pump is overlay-only; drain canonical path remains drain_pump + drain_path.",
    },
    {
        "suffix": "test-07-drain-pump",
        "testTargetId": "drain_test",
        "canonicalComponents": ["drain_pump", "drain_path"],
        "implementationComponent": None,
        "semanticAnchor": "drain_test",
        "gateAction": "certify_inherited_overlay",
        "layer": "canonical_functional",
    },
    {
        "suffix": "test-08-lid-lock",
        "testTargetId": "lid_lock_test",
        "canonicalComponents": ["lid_lock"],
        "implementationComponent": None,
        "semanticAnchor": "lid_lock_test",
        "gateAction": "certify_matcher_mapping",
        "layer": "canonical_functional",
        "note": "Matcher seed door_lock maps to lid_lock. Procedure-role lid_switch evidence is separate.",
    },
]

UNBOUND_PROCEDURE_DEFERS = [
    ("W10864849", "w10864849-test-01-acu-power", "TEST #1: Main Control (ACU)"),
    ("W10864849", "w10864849-test-02-valves", "TEST #2: Valves"),
    ("W10864849", "w10864849-test-04-keys-encoders", "TEST #4: Keys and Encoders"),
    ("W10864849", "w10864849-test-05-temp-thermistor", "TEST #5: Temperature Thermistor"),
    ("W10864849", "w10864849-test-09-heater", "TEST #9: Heater Element"),
    ("W10864849", "w10864849-test-10-service-leds", "TEST #10: Service LEDs"),
    ("W10864849", "w10864849-test-11-basket-light", "TEST #11: Basket Light"),
    ("W10864849", "w10864849-test-12-bulk-dispense", "TEST #12: Bulk Dispense"),
    ("W11697231", "w11697231-test-01-acu-power", "TEST #1: Main Control"),
    ("W11697231", "w11697231-test-02-valves", "TEST #2: Valves"),
    ("W11697231", "w11697231-test-04-hmi", "TEST #4: HMI"),
    ("W11697231", "w11697231-test-05-temp-thermistor", "TEST #5: Temperature Thermistor"),
    ("W11416787", "w11416787-test-01-acu-power", "TEST #1: Main Control (ACU)"),
    ("W11416787", "w11416787-test-02-valves", "TEST #2: Valves"),
    ("W11416787", "w11416787-test-04-hmi", "TEST #4: HMI"),
    ("W11416787", "w11416787-test-05-temp-thermistor", "TEST #5: Temperature Thermistor"),
    ("W11416787", "w11416787-test-09-load-go", "TEST #9: Load & Go Detergent"),
]


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def build_canonical_contract(derivation: dict) -> dict:
    freeze = derivation["freezeApplication"]
    allowed = sorted(set(freeze["keep"]) | set(freeze["conditional"]))
    return {
        "graph": "top_load_washer",
        "revision": derivation["ontology"]["frozenRevision"],
        "frozen": True,
        "frozenAt": derivation["ontology"]["frozenAt"],
        "allowedCanonicalIds": allowed,
        "conditionalCanonicalIds": freeze["conditional"],
        "forbiddenCanonicalIds": freeze["remove"],
        "overlayOnlyIds": freeze["overlayOnly"],
        "contractRule": (
            "canonicalComponents[] lists rev1-permitted canonical targets for each artifact. "
            "The overlay may consume the canonical ontology; it cannot mutate or negotiate with it."
        ),
    }


def assert_contract(component_ids: list[str], contract: dict) -> None:
    allowed = set(contract["allowedCanonicalIds"])
    forbidden = set(contract["forbiddenCanonicalIds"])
    for component_id in component_ids:
        if not component_id:
            continue
        if component_id in forbidden:
            raise ValueError(f"forbidden canonical id in artifact: {component_id}")
        if component_id not in allowed:
            raise ValueError(f"canonical id not permitted by rev1 contract: {component_id}")


def classify_alias(oem_term: str, target: str) -> tuple[str, str, list[str], str | None]:
    if target in OVERLAY_IMPLEMENTATION_ALIASES:
        spec = OVERLAY_IMPLEMENTATION_ALIASES[target]
        return (
            "certify_overlay_implementation",
            "overlay_implementation",
            spec["canonicalComponents"],
            spec["implementationComponent"],
        )
    if oem_term in {"door_lock"} or target == "lid_lock":
        return ("certify_matcher_mapping", "matcher_derived", ["lid_lock"], None)
    if target in {
        "control_board",
        "inlet_valve",
        "drive_motor",
        "hmi_control",
        "water_level_sensor",
        "drain_pump",
    }:
        return ("certify_inherited_overlay", "canonical_functional", [target], None)
    if re.match(r"TEST #\d+", oem_term) and target in OVERLAY_IMPLEMENTATION_ALIASES:
        spec = OVERLAY_IMPLEMENTATION_ALIASES[target]
        return (
            "certify_overlay_implementation",
            "overlay_implementation",
            spec["canonicalComponents"],
            spec["implementationComponent"],
        )
    if "lid lock" in oem_term.lower() and target == "lid_lock":
        return (
            "defer_ambiguous_lid_language",
            "ambiguous_lid_language",
            ["lid_lock"],
            None,
        )
    return ("certify_inherited_overlay", "canonical_functional", [target], None)


def build_alias_mappings(overlay: dict, contract: dict) -> list[dict]:
    mappings: list[dict] = []
    seen: set[str] = set()
    for family in overlay["platformFamilies"]:
        manual_id = family["manualId"]
        for oem_term, target in family.get("oemTermAliases", {}).items():
            dedupe = f"{manual_id}:{oem_term}:{target}"
            if dedupe in seen:
                continue
            seen.add(dedupe)
            gate_action, layer, canonical_components, implementation = classify_alias(oem_term, target)
            if gate_action == "defer_ambiguous_lid_language":
                mappings.append(
                    {
                        "manualId": manual_id,
                        "oemTerm": oem_term,
                        "aliasTarget": target,
                        "canonicalComponents": canonical_components,
                        "layer": layer,
                        "gateAction": gate_action,
                        "rationale": (
                            "General lid-lock OEM title without explicit role disambiguation — "
                            "certified to lid_lock only as matcher/assembly routing, not as lid_switch fabrication."
                        ),
                    }
                )
                continue
            assert_contract(canonical_components, contract)
            entry = {
                "manualId": manual_id,
                "oemTerm": oem_term,
                "aliasTarget": target,
                "canonicalComponents": canonical_components,
                "layer": layer,
                "gateAction": gate_action,
                "rationale": "Published Whirlpool TL alias conforms to frozen rev1 contract.",
            }
            if implementation:
                entry["implementationComponent"] = implementation
            mappings.append(entry)
    return mappings


def build_procedure_bindings(overlay: dict, contract: dict) -> list[dict]:
    bindings: list[dict] = []
    published = {
        (family["manualId"], item["procedureId"]): item
        for family in overlay["platformFamilies"]
        for item in family.get("procedureBindings", [])
    }
    for manual in MANUALS:
        manual_id = manual["manualId"]
        prefix = manual["nativePrefix"]
        for spec in PROCEDURE_BINDING_SPECS:
            procedure_id = f"{prefix}{spec['suffix']}"
            if (manual_id, procedure_id) not in published:
                continue
            published_item = published[(manual_id, procedure_id)]
            canonical_components = spec["canonicalComponents"]
            assert_contract(canonical_components, contract)
            bindings.append(
                {
                    "manualId": manual_id,
                    "procedureId": procedure_id,
                    "testTargetId": spec["testTargetId"],
                    "canonicalComponents": canonical_components,
                    "implementationComponent": spec["implementationComponent"],
                    "semanticAnchor": spec["semanticAnchor"],
                    "displayTitle": published_item.get("displayTitle"),
                    "layer": spec["layer"],
                    "gateAction": spec["gateAction"],
                    "note": spec.get("note"),
                    "rationale": "Published procedure binding certified against rev1 — not compiler-discovered.",
                }
            )
    return bindings


def build_measurement_bindings(overlay: dict, contract: dict) -> list[dict]:
    bindings: list[dict] = []
    for family in overlay["platformFamilies"]:
        manual_id = family["manualId"]
        for item in family.get("measurementBindings", []):
            procedure_id = item["procedureId"]
            test_target = item["testTargetId"]
            canonical_components = {
                "motor_output_test": ["drive_motor"],
                "drain_test": ["drain_pump"],
                "lid_lock_test": ["lid_lock"],
            }.get(test_target, [])
            assert_contract(canonical_components, contract)
            implementation = None
            if "recirc" in item["measurementKnowledgeId"].lower():
                implementation = "recirc_pump"
            elif "shifter" in item["measurementKnowledgeId"].lower():
                implementation = "mode_shifter"
            bindings.append(
                {
                    "manualId": manual_id,
                    "procedureId": procedure_id,
                    "measurementKnowledgeId": item["measurementKnowledgeId"],
                    "testTargetId": test_target,
                    "canonicalComponents": canonical_components,
                    "implementationComponent": implementation,
                    "gateAction": "certify_inherited_overlay",
                    "layer": "overlay_implementation" if implementation else "canonical_functional",
                    "rationale": "Published measurement binding certified against rev1 contract.",
                }
            )
    return bindings


def build_procedure_role_evidence(contract: dict) -> list[dict]:
    evidence: list[dict] = []
    for item in LID_ROLE_PROCEDURES:
        for role in item["roles"]:
            assert_contract(role["canonicalComponents"], contract)
            evidence.append(
                {
                    "manualId": item["manualId"],
                    "procedureId": item["procedureId"],
                    "stepId": item["stepId"],
                    "roleId": role["roleId"],
                    "canonicalComponents": role["canonicalComponents"],
                    "evidenceKind": "procedure_role_text",
                    "signalPhrases": role["signalPhrases"],
                    "gateAction": "certify_procedure_role",
                    "doesNotFabricateMatcherAlias": True,
                    "rationale": (
                        "Explicit procedure-role evidence may bind lid_switch without manufacturing "
                        "a matcher alias. Matcher-derived door_lock remains lid_lock only."
                    ),
                }
            )
    return evidence


def build_contract_rejections() -> list[dict]:
    return [
        {
            "concept": "drive_system",
            "gateAction": "reject_contract_violation",
            "layer": "forbidden_canonical",
            "canonicalComponents": [],
            "rationale": (
                "rev1 removed drive_system. Any proposed canonical routing to drive_system is a "
                "certification failure requiring remediation, not new CG-6.6 knowledge."
            ),
            "corpusEvidence": "0/3 Whirlpool TL manuals earned drive_system at canonical layer.",
        },
        {
            "concept": "lid_switch matcher alias fabrication",
            "gateAction": "reject_contract_violation",
            "layer": "matcher_policy",
            "canonicalComponents": ["lid_switch"],
            "rationale": (
                "Do not manufacture lid_switch matcher aliases to simulate discovery. "
                "Procedure-role evidence may certify lid_switch; matcher door_lock remains lid_lock."
            ),
        },
    ]


def build_deferred_artifacts() -> list[dict]:
    deferred = []
    for manual_id, procedure_id, title in UNBOUND_PROCEDURE_DEFERS:
        deferred.append(
            {
                "manualId": manual_id,
                "procedureId": procedure_id,
                "displayTitle": title,
                "gateAction": "defer_unbound_procedure",
                "layer": "deferred_binding",
                "rationale": (
                    "Published overlay has OEM alias coverage but no procedureBinding yet — "
                    "explicit defer, not certification failure."
                ),
            }
        )
    return deferred


def summarize_accounting(
    mappings: list[dict],
    procedure_bindings: list[dict],
    measurement_bindings: list[dict],
    procedure_roles: list[dict],
    deferred: list[dict],
    rejections: list[dict],
) -> dict:
    certification_actions = {
        "certify_inherited_overlay",
        "certify_overlay_implementation",
        "certify_matcher_mapping",
        "certify_procedure_role",
    }
    certification_decisions = sum(
        1
        for bucket in (mappings, procedure_bindings, measurement_bindings, procedure_roles)
        for item in bucket
        if item.get("gateAction") in certification_actions
    )
    inherited_knowledge = sum(
        1 for item in mappings if item.get("gateAction") == "certify_inherited_overlay"
    )
    inherited_knowledge += len(procedure_bindings) + len(measurement_bindings)
    return {
        "newSemanticDecisions": 0,
        "certificationDecisions": certification_decisions,
        "inheritedKnowledge": inherited_knowledge,
        "canonicalExpansion": 0,
        "deferredArtifacts": len(deferred),
        "contractRejections": len(rejections),
        "note": (
            "CG-6.6 accounting is certification-only. Historical promotion teaching costs "
            "(14 / 0 / 2) are provenance, not CG-6.6 decisions."
        ),
    }


def main() -> int:
    derivation = load_json(CALIBRATION / "TOP_LOAD_WASHER_REV1_DERIVATION_v1.json")
    overlay = load_json(CANONICAL_DIR / "manufacturer_overlays/whirlpool_top_load_washer.json")
    contract = build_canonical_contract(derivation)

    mappings = build_alias_mappings(overlay, contract)
    procedure_bindings = build_procedure_bindings(overlay, contract)
    measurement_bindings = build_measurement_bindings(overlay, contract)
    procedure_role_evidence = build_procedure_role_evidence(contract)
    contract_rejections = build_contract_rejections()
    deferred_artifacts = build_deferred_artifacts()
    certification_accounting = summarize_accounting(
        mappings,
        procedure_bindings,
        measurement_bindings,
        procedure_role_evidence,
        deferred_artifacts,
        contract_rejections,
    )

    gate_table = {
        "schemaVersion": "1.0.0",
        "reportType": "whirlpool_tl_corpus_rev1_certification_gate_table",
        "manualIds": [manual["manualId"] for manual in MANUALS],
        "canonicalOntologyId": "top_load_washer",
        "proposedOverlayFile": "whirlpool_top_load_washer.json",
        "status": "draft",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "observationArtifacts": [
            "W10864849_tl_cg6x_observation_v1.json",
            "W11697231_tl_cg6x_observation_v1.json",
            "W11416787_tl_cg6x_observation_v1.json",
        ],
        "rev1DerivationArtifact": "TOP_LOAD_WASHER_REV1_DERIVATION_v1.json",
        "freezeRecommendationArtifact": "TOP_LOAD_WASHER_CG6X_FREEZE_RECOMMENDATION_v1.json",
        "canonicalContract": contract,
        "gatePolicy": {
            "gateKind": "whirlpool_tl_corpus_rev1_certification",
            "purpose": (
                "Certify already-published Whirlpool TL overlay knowledge against frozen "
                "top_load_washer rev1. This is not new compounding."
            ),
            "canonicalImmutabilityRule": (
                "top_load_washer.json rev1 must remain byte-stable before and after publish."
            ),
            "promotionAuthorityRule": "Gate table is authoritative; compiler ledger is audit-only.",
            "isolationRule": (
                "Do not import Whirlpool FL washer overlay vocabulary, topology, or aliases."
            ),
            "driveRoutingRule": (
                "No drive_system canonical routing. Drive diagnostics route "
                "control_board -> drive_motor -> motor_output_test with "
                "transmission_or_shifter functional and mode_shifter overlay implementation."
            ),
            "lidAuthorizationRule": (
                "Matcher-derived door_lock -> lid_lock. Procedure-derived lid switch role may "
                "certify lid_switch. Ambiguous general lid-lock language defers; do not fabricate "
                "lid_switch matcher aliases."
            ),
            "overlayOnlyRule": (
                "mode_shifter, splutch, clutch, gearcase, recirc_pump, bulk_level_switch remain "
                "overlay implementation — not canonical expansion."
            ),
            "publishBlocked": True,
        },
        "layerDefinitions": {
            "canonical_functional": "rev1-permitted canonical target(s) for the artifact.",
            "overlay_implementation": "OEM implementation component implementing a canonical function.",
            "matcher_derived": "Seed/matcher vocabulary mapped to canonical without procedure-role inference.",
            "procedure_role_evidence": "Explicit OEM procedure text distinguishes functional roles.",
            "ambiguous_lid_language": "General lid-lock OEM title without role disambiguation.",
            "deferred_binding": "Known OEM procedure not yet bound in published overlay.",
            "forbidden_canonical": "Violates frozen rev1 contract.",
            "matcher_policy": "Forbidden matcher fabrication policy.",
        },
        "certificationAccounting": certification_accounting,
        "historicalPromotionProvenance": {
            "note": "Pre-rev1 compounding decisions — provenance only, not CG-6.6 teaching cost.",
            "manuals": [
                {
                    "manualId": manual["manualId"],
                    "promotionId": manual["historicalPromotionId"],
                    "historicalNewDecisions": manual["historicalNewDecisions"],
                }
                for manual in MANUALS
            ],
        },
        "manualCohorts": [
            {
                "manualId": manual["manualId"],
                "platformId": manual["platformId"],
                "platformFamilyId": manual["platformFamilyId"],
                "nativeCohortFilter": f"procedureId.startsWith('{manual['nativePrefix']}')",
                "historicalPromotionId": manual["historicalPromotionId"],
            }
            for manual in MANUALS
        ],
        "mappings": mappings,
        "procedureBindings": procedure_bindings,
        "measurementBindings": measurement_bindings,
        "procedureRoleEvidence": procedure_role_evidence,
        "contractRejections": contract_rejections,
        "deferredArtifacts": deferred_artifacts,
        "expectedPublicationCounts": {
            "platformFamilies": 2,
            "procedureBindings": len(procedure_bindings),
            "measurementBindings": len(measurement_bindings),
            "procedureRoleEvidence": len(procedure_role_evidence),
            "oemAliasMappings": len(mappings),
        },
        "gateSummary": {
            "status": "draft",
            "certificationReady": True,
            "canonicalExpansion": 0,
            "newSemanticDecisions": 0,
        },
    }

    write_json(OUT, gate_table)
    print(f"Wrote gate table: {OUT}")
    print(
        f"mappings={len(mappings)} procedureBindings={len(procedure_bindings)} "
        f"measurementBindings={len(measurement_bindings)} procedureRoleEvidence={len(procedure_role_evidence)} "
        f"deferred={len(deferred_artifacts)}"
    )
    print(f"certificationDecisions={certification_accounting['certificationDecisions']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
