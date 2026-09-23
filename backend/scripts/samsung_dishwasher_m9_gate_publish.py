#!/usr/bin/env python3
"""Gate-table compounding publisher for SAMSUNG-DISHWASHER-M9 on samsung_dishwasher.json."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from normalization.promotion.planner import find_platform_family
from samsung_dishwasher_gate_publish import (
    FORBIDDEN_ALIAS_PREFIXES,
    FORBIDDEN_ALIAS_TERMS,
    GatePublishError,
    WHIRLPOOL_LEAK_PATTERNS,
    _scan_leaks,
    _upsert_component,
    _upsert_measurement_binding,
    _upsert_procedure_binding,
    _upsert_relationship,
    _verify_post_publish,
)

MANUAL_ID = "SAMSUNG-DISHWASHER-M9"
PRIOR_MANUAL_ID = "SAMSUNG-DISHWASHER"
PLATFORM_FAMILY_ID = "samsung_dishwasher"
NATIVE_PREFIX = "samsungdwm9-"

APPROVE_MAPPING_ACTIONS = frozenset(
    {"approve_inherit", "approve_inherit_semantic", "approve_mechanical_alias"}
)
APPROVE_PROCEDURE_ACTIONS = frozenset({"approve_mechanical", "approve_platform_delta"})
APPROVE_MEASUREMENT_ACTIONS = frozenset({"approve_mechanical", "approve_platform_delta"})

M9_DISPLAY_TITLES = {
    "samsungdwm9-circulation-motor": "§4-3: Circulation Pump (3C)",
    "samsungdwm9-door-switch": "§4-3: Door Sensing Switch",
    "samsungdwm9-drain-pump": "§4-3: Drain Pump (5C)",
    "samsungdwm9-dispenser": "§4-3: Detergent Dispenser",
    "samsungdwm9-distributor": "§4-3: Distributor Motor (PC)",
    "samsungdwm9-dry-system": "§4-3: Dry Fan, Actuator & Auto Door (FC / dC3)",
    "samsungdwm9-fill-valve": "§4-3: Fill Valve & Flow Meter (4C)",
    "samsungdwm9-heater": "§4-3: Heater Operation (HC / HC1)",
    "samsungdwm9-overflow": "§4-3: Overflow Sensor (OC)",
    "samsungdwm9-thermistor": "§4-3: Water Thermistor (tC)",
    "samsungdwm9-vane-motor": "§4-3: Lower Vane Motor (7C)",
}

M9_FAILURE_DOMAINS = {
    "samsungdwm9-circulation-motor": ["circulation_failure"],
    "samsungdwm9-distributor": ["circulation_failure"],
    "samsungdwm9-vane-motor": ["circulation_failure"],
    "samsungdwm9-door-switch": ["door_authorization_failure"],
    "samsungdwm9-drain-pump": ["drain_failure"],
    "samsungdwm9-dispenser": ["dispensing_failure"],
    "samsungdwm9-dry-system": ["drying_failure"],
    "samsungdwm9-fill-valve": ["fill_failure"],
    "samsungdwm9-heater": ["heating_failure"],
    "samsungdwm9-overflow": ["fill_failure"],
    "samsungdwm9-thermistor": ["temperature_sensing_failure"],
}

VANE_MOTOR_SPEC = {
    "id": "vane_motor",
    "name": "Lower vane motor",
    "aliases": ["vane motor", "lower vane motor"],
    "systemId": "circulation",
    "categoryId": "wash_circuit",
    "type": "actuator",
    "note": "M9 lower vane/cam motor (7C) — implements circulation_pump; not diverter_valve.",
}

VANE_RELATIONSHIPS = [
    {
        "from": "vane_motor",
        "to": "circulation_pump",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
        "note": "Samsung M9 vane motor implements canonical circulation function.",
    },
    {
        "from": "control_board",
        "to": "vane_motor",
        "type": "commands",
        "source": "service_manual",
        "confidence": "high",
        "note": "M9 lower vane motor commanded by main PBA.",
    },
]


def collect_gate_intent(table: dict) -> dict[str, Any]:
    approved_mappings = [
        m for m in table.get("mappings") or [] if m.get("gateAction") in APPROVE_MAPPING_ACTIONS
    ]
    approved_procedures = [
        b
        for b in table.get("procedureBindings") or []
        if b.get("gateAction") in APPROVE_PROCEDURE_ACTIONS
    ]
    approved_measurements = [
        b
        for b in table.get("measurementBindings") or []
        if b.get("gateAction") in APPROVE_MEASUREMENT_ACTIONS
    ]
    platform_delta = (table.get("proposedPlatformDelta") or {}).get("add", {}).get("components") or []

    carry_forward = table.get("carryForwardMatcherDefects") or []
    evidence = table.get("compoundingEvidence") or {}

    return {
        "mappings": approved_mappings,
        "procedureBindings": approved_procedures,
        "measurementBindings": approved_measurements,
        "platformComponents": platform_delta,
        "carryForwardMatcherDefects": carry_forward,
        "counts": {
            "mappings": len(approved_mappings),
            "procedureBindings": len(approved_procedures),
            "measurementBindings": len(approved_measurements),
            "platformComponents": len(platform_delta),
            "carryForwardMatcherDefects": len(carry_forward),
            "genuineNewHumanSemanticDecisions": evidence.get("genuineNewHumanSemanticDecisions", 0),
            "totalApproved": (
                len(approved_mappings)
                + len(approved_procedures)
                + len(approved_measurements)
                + len(platform_delta)
            ),
        },
    }


def build_publication_plan(table: dict) -> dict[str, Any]:
    intent = collect_gate_intent(table)
    evidence = table.get("compoundingEvidence") or {}
    return {
        "manualId": MANUAL_ID,
        "priorManualId": PRIOR_MANUAL_ID,
        "gateArtifact": "SAMSUNG_DISHWASHER_M9_overlay_mapping_table_v1.json",
        "publishMode": "gate_table_compounding",
        "gateIntent": intent,
        "expectedCounts": table.get("expectedPublicationCounts") or {},
        "carryForwardMatcherDefects": intent["carryForwardMatcherDefects"],
        "teachingCostAccounting": {
            "priorManualHumanDecisions": evidence.get("priorHumanSemanticDecisions", 15),
            "genuineNewHumanSemanticDecisions": evidence.get("genuineNewHumanSemanticDecisions", 0),
            "carryForwardMatcherDefectThemes": evidence.get("carryForwardMatcherDefectThemes", 0),
            "rawProjectedTeachingUnits": evidence.get("rawProjectedTeachingUnits", 0),
            "note": (
                "Genuine new knowledge excludes carry-forward matcher defects and "
                "mechanical inherited registrations."
            ),
        },
        "compoundingInheritance": {
            "inheritedExact": evidence.get("inheritedExact", 0),
            "inheritedSemantic": evidence.get("inheritedSemantic", 0),
            "mechanicalProcedureRegistrations": evidence.get("mechanicalProcedureRegistrations", 0),
            "mechanicalMeasurementRegistrations": evidence.get("mechanicalMeasurementRegistrations", 0),
        },
        "rejected": table.get("rejectedOverlayBindings") or [],
        "deferred": {
            "mappings": [
                m for m in table.get("mappings") or [] if str(m.get("gateAction", "")).startswith("defer")
            ],
            "procedureBindings": [
                b
                for b in table.get("procedureBindings") or []
                if str(b.get("gateAction", "")).startswith("defer")
            ],
        },
    }


def _apply_mapping_inherit(family: dict, mapping: dict) -> list[dict[str, str]]:
    """M9 compounding — only add aliases explicitly approved as new vocabulary."""
    applied: list[dict[str, str]] = []
    proposed = mapping.get("proposedAliases") or {}
    if not proposed:
        applied.append(
            {
                "manualConcept": mapping.get("manualConcept"),
                "mode": "inherit_only",
                "canonicalId": mapping.get("candidate"),
            }
        )
        return applied

    aliases = family.setdefault("oemTermAliases", {})
    for term, canonical_id in proposed.items():
        lower = str(term).lower()
        if lower in FORBIDDEN_ALIAS_TERMS:
            raise GatePublishError(f"Forbidden alias term: {term}")
        if any(str(term).startswith(prefix) for prefix in FORBIDDEN_ALIAS_PREFIXES):
            raise GatePublishError(f"Procedural title alias blocked: {term}")
        if _scan_leaks(term) or _scan_leaks(str(canonical_id)):
            raise GatePublishError(f"Leak in alias {term} -> {canonical_id}")
        aliases[term] = canonical_id
        applied.append({"term": term, "canonicalId": canonical_id})
    return applied


def apply_samsung_dishwasher_m9_gate_delta(
    overlay: dict,
    table: dict,
    *,
    publish: bool = False,
) -> tuple[dict, dict[str, Any]]:
    plan = build_publication_plan(table)
    intent = plan["gateIntent"]
    expected = plan["expectedCounts"]

    family = find_platform_family(overlay, PLATFORM_FAMILY_ID)
    if not family:
        raise GatePublishError(f"Platform family {PLATFORM_FAMILY_ID} not found")

    publisher_result: dict[str, Any] = {
        "mappings": {"applied": [], "skipped": [], "failures": []},
        "procedureBindings": {"applied": [], "skipped": [], "failures": []},
        "measurementBindings": {"applied": [], "skipped": [], "failures": []},
        "platformComponents": {"applied": [], "skipped": [], "failures": []},
        "oemTermAliasesAdded": {"applied": [], "skipped": [], "failures": []},
    }

    alias_count_before = len(family.get("oemTermAliases") or {})
    component_ids_before = {
        c.get("id") for c in (family.get("add") or {}).get("components") or []
    }
    proc_ids_before = {
        b.get("procedureId")
        for b in family.get("procedureBindings") or []
        if str(b.get("procedureId", "")).startswith(NATIVE_PREFIX)
    }

    try:
        for mapping in intent["mappings"]:
            publisher_result["mappings"]["applied"].extend(_apply_mapping_inherit(family, mapping))

        for component in intent["platformComponents"]:
            cid = component.get("id")
            if cid == "vane_motor":
                _upsert_component(family, VANE_MOTOR_SPEC)
                for rel in VANE_RELATIONSHIPS:
                    _upsert_relationship(family, rel)
                publisher_result["platformComponents"]["applied"].append(cid)
            else:
                raise GatePublishError(f"Unexpected M9 platform component: {cid}")

        for binding in intent["procedureBindings"]:
            proc_id = binding["procedureId"]
            if not str(proc_id).startswith(NATIVE_PREFIX):
                raise GatePublishError(f"Non-native M9 procedure blocked: {proc_id}")
            entry = {
                "procedureId": proc_id,
                "testTargetId": binding["testTargetId"],
                "failureDomains": M9_FAILURE_DOMAINS.get(proc_id, []),
                "displayTitle": M9_DISPLAY_TITLES.get(proc_id),
                "canonicalComponents": binding.get("canonicalComponents") or [],
            }
            if binding.get("implementationComponent"):
                entry["implementationComponent"] = binding["implementationComponent"]
            if binding.get("semanticAnchor"):
                entry["platformNote"] = (
                    f"M9 compounding — semantic anchor {binding['semanticAnchor']}."
                )
            _upsert_procedure_binding(family, entry)
            publisher_result["procedureBindings"]["applied"].append(proc_id)

        for binding in intent["measurementBindings"]:
            proc_id = binding["procedureId"]
            knowledge_id = binding["measurementKnowledgeId"]
            if _scan_leaks(knowledge_id):
                raise GatePublishError(f"Whirlpool measurement blocked: {knowledge_id}")
            entry = {
                "procedureId": proc_id,
                "measurementKnowledgeId": knowledge_id,
                "testTargetId": binding["testTargetId"],
            }
            if binding.get("implementationComponent"):
                entry["implementationComponent"] = binding["implementationComponent"]
            _upsert_measurement_binding(family, entry)
            publisher_result["measurementBindings"]["applied"].append(f"{proc_id}:{knowledge_id}")

    except GatePublishError as exc:
        plan["publisherResult"] = publisher_result
        plan["publishBlocked"] = True
        plan["blockedReason"] = str(exc)
        raise

    applies_to = family.setdefault("appliesTo", {})
    patterns = set(applies_to.get("modelPatterns") or [])
    patterns.update({"DW80M996*", "DW80M955*", "DW80M999*", "DW80M9*"})
    applies_to["modelPatterns"] = sorted(patterns)

    prior_ids = list(family.get("compoundingManualIds") or [PRIOR_MANUAL_ID])
    if PRIOR_MANUAL_ID not in prior_ids:
        prior_ids.insert(0, PRIOR_MANUAL_ID)
    if MANUAL_ID not in prior_ids:
        prior_ids.append(MANUAL_ID)
    family["compoundingManualIds"] = prior_ids
    family["label"] = (
        "Samsung DW80/DW82 + DW80M9 premium dishwasher "
        "(SAMSUNG-DISHWASHER + SAMSUNG-DISHWASHER-M9)"
    )

    overlay["gateArtifact"] = "SAMSUNG_DISHWASHER_M9_overlay_mapping_table_v1.json"
    overlay["priorGateArtifact"] = "SAMSUNG_DISHWASHER_overlay_mapping_table_v1.json"
    published_ids = list(overlay.get("publishedManualIds") or [PRIOR_MANUAL_ID])
    if MANUAL_ID not in published_ids:
        published_ids.append(MANUAL_ID)
    overlay["publishedManualIds"] = published_ids
    overlay["publishedAt"] = datetime.now(timezone.utc).isoformat()
    overlay["status"] = "published" if publish else "gated_preview"

    proc_ids_after = {
        b.get("procedureId")
        for b in family.get("procedureBindings") or []
        if str(b.get("procedureId", "")).startswith(NATIVE_PREFIX)
    }
    new_m9_procs = proc_ids_after - proc_ids_before

    failures: list[str] = []
    if len(new_m9_procs) != expected.get("m9ProcedureBindingsAdded", len(intent["procedureBindings"])):
        failures.append(
            f"m9ProcedureBindings: expected {expected.get('m9ProcedureBindingsAdded')}, got {len(new_m9_procs)}"
        )
    meas_after = {
        f"{b.get('procedureId')}:{b.get('measurementKnowledgeId')}"
        for b in family.get("measurementBindings") or []
        if str(b.get("procedureId", "")).startswith(NATIVE_PREFIX)
    }
    if len(meas_after) != expected.get("m9MeasurementBindingsAdded", len(intent["measurementBindings"])):
        failures.append(
            f"m9MeasurementBindings: expected {expected.get('m9MeasurementBindingsAdded')}, "
            f"got {len(meas_after)}"
        )
    component_ids_after = {
        c.get("id") for c in (family.get("add") or {}).get("components") or []
    }
    new_components = component_ids_after - component_ids_before
    if new_components != {"vane_motor"}:
        failures.append(f"platform delta must be vane_motor only, got {new_components}")

    alias_added = len(family.get("oemTermAliases") or {}) - alias_count_before
    if alias_added != expected.get("newAliasesAdded", 0):
        failures.append(f"alias adds: expected {expected.get('newAliasesAdded')}, got {alias_added}")

    if any(
        b.get("procedureId") in {"samsungdwm9-communication", "samsungdwm9-power-supply", "samsungdwm9-voltage-abnormal"}
        for b in family.get("procedureBindings") or []
    ):
        failures.append("carry-forward matcher procedures must not publish")

    if failures:
        plan["publisherResult"] = publisher_result
        plan["publishBlocked"] = True
        plan["blockedReason"] = "; ".join(failures)
        raise GatePublishError(plan["blockedReason"])

    plan["publisherResult"] = publisher_result
    plan["appliedCounts"] = {
        "mappingsInherited": len(publisher_result["mappings"]["applied"]),
        "procedureBindings": len(publisher_result["procedureBindings"]["applied"]),
        "measurementBindings": len(publisher_result["measurementBindings"]["applied"]),
        "platformComponents": len(publisher_result["platformComponents"]["applied"]),
        "newAliasesAdded": alias_added,
    }
    plan["summary"] = {
        "gateIntentTotal": intent["counts"]["totalApproved"],
        "publisherAppliedTotal": (
            len(publisher_result["procedureBindings"]["applied"])
            + len(publisher_result["measurementBindings"]["applied"])
            + len(publisher_result["platformComponents"]["applied"])
            + alias_added
        ),
        "representationFailures": 0,
        "publishBlocked": False,
        "genuineNewHumanSemanticDecisions": plan["teachingCostAccounting"][
            "genuineNewHumanSemanticDecisions"
        ],
        "carryForwardMatcherDefectThemes": plan["teachingCostAccounting"][
            "carryForwardMatcherDefectThemes"
        ],
    }

    return overlay, plan
