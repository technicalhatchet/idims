#!/usr/bin/env python3
"""Gate-table → overlay publisher for SAMSUNG-DISHWASHER (manufacturer boundary)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from normalization.promotion.planner import find_platform_family

MANUAL_ID = "SAMSUNG-DISHWASHER"
PLATFORM_FAMILY_ID = "samsung_dishwasher"
NATIVE_PREFIX = "samsungdw-"

APPROVE_MAPPING_ACTIONS = frozenset({"approve_auto", "approve_human"})
APPROVE_PROCEDURE_ACTION = "approve_human"
APPROVE_MEASUREMENT_ACTION = "approve_human"

FORBIDDEN_ALIAS_TERMS = frozenset(
    {
        "diverter_motor",
        "diverter motor",
        "diverter_motor (seed on distributor procedure)",
    }
)
FORBIDDEN_ALIAS_PREFIXES = ("§",)
WHIRLPOOL_LEAK_PATTERNS = (
    "whirlpool",
    "w11633848",
    "w11480208",
    "w11499711",
    "whirlpooldishwasher",
    "filtrationvsm",
    "acuwashmotor",
    "ssm_wash",
    "vsm_wash",
    "vsm_drain",
    "diverter_motor",
)

DISPLAY_TITLES = {
    "samsungdw-circulation-motor": "§4-1: Circulation Motor & Nozzle",
    "samsungdw-door-switch": "§4-1: Door Sensing Switch",
    "samsungdw-drain-pump": "§4-1: Drain Pump (5C)",
    "samsungdw-dispenser": "§4-1: Detergent Dispenser",
    "samsungdw-distributor": "§4-1: Distributor Motor (PC)",
    "samsungdw-dry-system": "§4-1: Dry Fan & Thermal Actuator (FC / dC3)",
    "samsungdw-fill-valve": "§4-1: Fill Valve & Flow Meter (4C)",
    "samsungdw-heater": "§4-1: Heater Operation (HC / HC1)",
    "samsungdw-overflow": "§4-1: Overflow Sensor (OC)",
    "samsungdw-thermistor": "§4-1: Water Thermistor (tC)",
}

FAILURE_DOMAINS = {
    "samsungdw-circulation-motor": ["circulation_failure"],
    "samsungdw-distributor": ["circulation_failure"],
    "samsungdw-door-switch": ["door_authorization_failure"],
    "samsungdw-drain-pump": ["drain_failure"],
    "samsungdw-dispenser": ["dispensing_failure"],
    "samsungdw-dry-system": ["drying_failure"],
    "samsungdw-fill-valve": ["fill_failure"],
    "samsungdw-heater": ["heating_failure"],
    "samsungdw-overflow": ["fill_failure"],
    "samsungdw-thermistor": ["temperature_sensing_failure"],
}

DISPLAY_TERMS = {
    "control_board": "Main PBA",
    "circulation_pump": "Circulation / distributor motor path",
    "detergent_dispenser": "Detergent dispenser",
    "drying_system": "Vent / dry fan + thermal actuator",
    "heat_source": "Wash heater",
    "hmi_control": "Touch panel / Sub PBA",
    "inlet_valve": "Fill valve & flow meter",
    "water_level_sensor": "Float / overflow sensor (OC)",
}

PLATFORM_COMPONENT_SPECS: dict[str, dict[str, Any]] = {
    "circulation_motor": {
        "id": "circulation_motor",
        "name": "Circulation motor & nozzle",
        "aliases": ["circulation motor"],
        "systemId": "circulation",
        "categoryId": "wash_circuit",
        "type": "actuator",
        "implementsCanonicalId": "circulation_pump",
        "note": "Samsung circulation motor + nozzle (~5.8 Ω).",
    },
    "distributor_motor": {
        "id": "distributor_motor",
        "name": "Distributor motor",
        "aliases": ["distributor motor"],
        "systemId": "circulation",
        "categoryId": "wash_circuit",
        "type": "actuator",
        "implementsCanonicalId": "circulation_pump",
        "note": "Samsung distributor/cam motor (PC code) — not diverter_valve.",
    },
    "vent_fan_motor": {
        "id": "vent_fan_motor",
        "name": "Dry fan motor",
        "aliases": ["dry fan", "vent fan motor"],
        "systemId": "drying",
        "categoryId": "heat_dry",
        "type": "actuator",
        "implementsCanonicalId": "drying_system",
        "note": "Samsung dry fan (~150 Ω) — distinct from Whirlpool ProDry DC fan.",
    },
    "thermal_actuator": {
        "id": "thermal_actuator",
        "name": "Thermal actuator (auto door)",
        "aliases": ["thermal actuator"],
        "systemId": "drying",
        "categoryId": "heat_dry",
        "type": "actuator",
        "implementsCanonicalId": "drying_system",
        "note": "Samsung auto-door thermal actuator (~1.45 kΩ).",
    },
    "overflow_sensor": {
        "id": "overflow_sensor",
        "name": "Overflow sensor (OC)",
        "aliases": ["overflow sensor"],
        "systemId": "water_level",
        "categoryId": "fill_supply",
        "type": "sensor",
        "implementsCanonicalId": "water_level_sensor",
        "note": "Samsung OC overflow sensor on CN505.",
    },
}

PLATFORM_RELATIONSHIPS = [
    {
        "from": "circulation_motor",
        "to": "circulation_pump",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
        "note": "Samsung circulation motor implements canonical circulation_pump.",
    },
    {
        "from": "distributor_motor",
        "to": "circulation_pump",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
        "note": "Samsung distributor motor implements canonical circulation_pump — not diverter_valve.",
    },
    {
        "from": "vent_fan_motor",
        "to": "drying_system",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
    },
    {
        "from": "thermal_actuator",
        "to": "drying_system",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
    },
    {
        "from": "overflow_sensor",
        "to": "water_level_sensor",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
    },
    {
        "from": "control_board",
        "to": "circulation_motor",
        "type": "commands",
        "source": "service_manual",
        "confidence": "high",
    },
    {
        "from": "control_board",
        "to": "distributor_motor",
        "type": "commands",
        "source": "service_manual",
        "confidence": "high",
    },
    {
        "from": "control_board",
        "to": "vent_fan_motor",
        "type": "commands",
        "source": "service_manual",
        "confidence": "high",
    },
]


class GatePublishError(Exception):
    """Raised when approved gate intent cannot be fully represented."""


def _component_by_id(family: dict, component_id: str) -> dict | None:
    for component in (family.get("add") or {}).get("components") or []:
        if component.get("id") == component_id:
            return component
    return None


def _upsert_component(family: dict, component: dict) -> None:
    add = family.setdefault("add", {})
    components = add.setdefault("components", [])
    existing = _component_by_id(family, component["id"])
    if existing:
        existing.update(component)
    else:
        components.append(component)


def _upsert_relationship(family: dict, relationship: dict) -> None:
    add = family.setdefault("add", {})
    relationships = add.setdefault("relationships", [])
    key = (relationship.get("from"), relationship.get("to"), relationship.get("type"))
    for rel in relationships:
        if (rel.get("from"), rel.get("to"), rel.get("type")) == key:
            rel.update(relationship)
            return
    relationships.append(relationship)


def _upsert_procedure_binding(family: dict, binding: dict) -> None:
    bindings = family.setdefault("procedureBindings", [])
    proc_id = binding.get("procedureId")
    for index, existing in enumerate(bindings):
        if existing.get("procedureId") == proc_id:
            bindings[index] = {**existing, **binding}
            return
    bindings.append(binding)


def _upsert_measurement_binding(family: dict, binding: dict) -> None:
    bindings = family.setdefault("measurementBindings", [])
    key = (binding.get("procedureId"), binding.get("measurementKnowledgeId"))
    for index, existing in enumerate(bindings):
        if (
            existing.get("procedureId"),
            existing.get("measurementKnowledgeId"),
        ) == key:
            bindings[index] = {**existing, **binding}
            return
    bindings.append(binding)


def _scan_leaks(blob: str) -> list[str]:
    lower = blob.lower()
    return [pattern for pattern in WHIRLPOOL_LEAK_PATTERNS if pattern in lower]


def collect_gate_intent(table: dict) -> dict[str, Any]:
    """Enumerate approved gate-table artifacts (authoritative human intent)."""
    approved_mappings = [
        m
        for m in table.get("mappings") or []
        if m.get("gateAction") in APPROVE_MAPPING_ACTIONS
    ]
    approved_procedures = [
        b
        for b in table.get("procedureBindings") or []
        if b.get("gateAction") == APPROVE_PROCEDURE_ACTION
    ]
    approved_measurements = [
        b
        for b in table.get("measurementBindings") or []
        if b.get("gateAction") == APPROVE_MEASUREMENT_ACTION
    ]
    approved_platform = (table.get("proposedPlatformDelta") or {}).get("add", {}).get(
        "components"
    ) or []

    alias_items: list[dict[str, str]] = []
    for mapping in approved_mappings:
        action = mapping.get("gateAction")
        canonical = str(mapping.get("candidate") or "")
        layer = mapping.get("layer", "")
        if action == "approve_auto":
            term = str(mapping.get("manualConcept") or "")
            if term and canonical:
                alias_items.append(
                    {
                        "term": term,
                        "canonicalId": canonical,
                        "layer": layer or "canonical_reuse",
                        "source": "seed_component_id",
                    }
                )
        elif action == "approve_human":
            proposed = mapping.get("proposedAliases") or {}
            for term, target in proposed.items():
                alias_items.append(
                    {
                        "term": str(term),
                        "canonicalId": str(target),
                        "layer": layer or "samsung_manufacturer_vocabulary",
                        "source": "proposedAliases",
                        "manualConcept": mapping.get("manualConcept"),
                    }
                )

    rejected_mappings = [
        m for m in table.get("mappings") or [] if m.get("gateAction") == "reject_mapping"
    ]
    deferred_mappings = [
        m
        for m in table.get("mappings") or []
        if str(m.get("gateAction", "")).startswith("defer")
    ]
    deferred_procedures = [
        b
        for b in table.get("procedureBindings") or []
        if b.get("gateAction") == "defer_procedure_binding"
    ]
    rejected_procedures = [
        b
        for b in table.get("procedureBindings") or []
        if b.get("gateAction") == "reject_binding"
    ]
    rejected_overlays = table.get("rejectedOverlayBindings") or []

    return {
        "manufacturerAliases": alias_items,
        "procedureBindings": approved_procedures,
        "measurementBindings": approved_measurements,
        "platformComponents": approved_platform,
        "rejected": {
            "mappings": rejected_mappings,
            "overlayBindings": rejected_overlays,
            "procedureBindings": rejected_procedures,
        },
        "deferred": {
            "mappings": deferred_mappings,
            "procedureBindings": deferred_procedures,
        },
        "counts": {
            "manufacturerAliases": len(alias_items),
            "procedureBindings": len(approved_procedures),
            "measurementBindings": len(approved_measurements),
            "platformComponents": len(approved_platform),
            "totalApproved": (
                len(alias_items)
                + len(approved_procedures)
                + len(approved_measurements)
                + len(approved_platform)
            ),
        },
    }


def build_publication_plan(table: dict) -> dict[str, Any]:
    intent = collect_gate_intent(table)
    return {
        "manualId": MANUAL_ID,
        "gateArtifact": "SAMSUNG_DISHWASHER_overlay_mapping_table_v1.json",
        "publishMode": "gate_table_authoritative",
        "gateIntent": intent,
        "expectedCounts": {
            "procedureBindings": 10,
            "measurementBindings": 5,
            "platformComponents": 5,
        },
        "rejected": intent["rejected"],
        "deferred": intent["deferred"],
    }


def _validate_alias_term(term: str, canonical_id: str) -> None:
    lower = term.lower()
    if any(term.startswith(prefix) for prefix in FORBIDDEN_ALIAS_PREFIXES):
        raise GatePublishError(f"Forbidden procedural-title alias: {term}")
    if lower in FORBIDDEN_ALIAS_TERMS or term in FORBIDDEN_ALIAS_TERMS:
        raise GatePublishError(f"Forbidden alias term: {term}")
    if _scan_leaks(term) or _scan_leaks(canonical_id):
        raise GatePublishError(f"Whirlpool leak in alias: {term} -> {canonical_id}")


def _apply_aliases(family: dict, alias_items: list[dict[str, str]]) -> list[dict[str, str]]:
    applied: list[dict[str, str]] = []
    aliases = family.setdefault("oemTermAliases", {})
    for item in alias_items:
        term = item["term"]
        canonical_id = item["canonicalId"]
        _validate_alias_term(term, canonical_id)
        aliases[term] = canonical_id
        applied.append(item)
    return applied


def _apply_platform_components(
    family: dict,
    platform_items: list[dict[str, Any]],
) -> list[str]:
    applied: list[str] = []
    for item in platform_items:
        component_id = item.get("id")
        if not component_id:
            raise GatePublishError(f"Platform component missing id: {item}")
        spec = PLATFORM_COMPONENT_SPECS.get(component_id)
        if not spec:
            raise GatePublishError(
                f"No publisher spec for approved platform component: {component_id}"
            )
        expected_canonical = item.get("implementsCanonicalId")
        if expected_canonical and spec.get("implementsCanonicalId") != expected_canonical:
            raise GatePublishError(
                f"Platform component {component_id} canonical mismatch: "
                f"gate={expected_canonical} spec={spec.get('implementsCanonicalId')}"
            )
        component = {k: v for k, v in spec.items() if k != "implementsCanonicalId"}
        _upsert_component(family, component)
        applied.append(component_id)

    for relationship in PLATFORM_RELATIONSHIPS:
        _upsert_relationship(family, relationship)

    return applied


def _apply_procedure_bindings(
    family: dict,
    bindings: list[dict[str, Any]],
) -> list[str]:
    applied: list[str] = []
    for binding in bindings:
        proc_id = binding.get("procedureId")
        if not proc_id or not str(proc_id).startswith(NATIVE_PREFIX):
            raise GatePublishError(f"Non-native procedure blocked: {proc_id}")
        test_target = binding.get("testTargetId")
        if not test_target:
            raise GatePublishError(f"Approved procedure missing testTargetId: {proc_id}")
        entry = {
            "procedureId": proc_id,
            "testTargetId": test_target,
            "failureDomains": FAILURE_DOMAINS.get(proc_id, []),
            "displayTitle": DISPLAY_TITLES.get(proc_id),
            "canonicalComponents": binding.get("canonicalComponents") or [],
        }
        if binding.get("implementationComponent"):
            entry["implementationComponent"] = binding["implementationComponent"]
        if binding.get("matcherDefect"):
            entry["platformNote"] = (
                f"Gate note: matcher defect {binding['matcherDefect']} — "
                "Samsung dishwasher vocabulary only."
            )
        _upsert_procedure_binding(family, entry)
        applied.append(proc_id)
    return applied


def _apply_measurement_bindings(
    family: dict,
    bindings: list[dict[str, Any]],
) -> list[str]:
    applied: list[str] = []
    for binding in bindings:
        proc_id = binding.get("procedureId")
        knowledge_id = binding.get("measurementKnowledgeId")
        test_target = binding.get("testTargetId")
        if not proc_id or not knowledge_id or not test_target:
            raise GatePublishError(f"Incomplete measurement binding: {binding}")
        if _scan_leaks(knowledge_id):
            raise GatePublishError(f"Whirlpool measurement id blocked: {knowledge_id}")
        entry = {
            "procedureId": proc_id,
            "measurementKnowledgeId": knowledge_id,
            "testTargetId": test_target,
        }
        if binding.get("implementationComponent"):
            entry["implementationComponent"] = binding["implementationComponent"]
        _upsert_measurement_binding(family, entry)
        applied.append(f"{proc_id}:{knowledge_id}")
    return applied


def _verify_post_publish(family: dict, plan: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    expected = plan["expectedCounts"]

    proc_ids = {
        b.get("procedureId")
        for b in family.get("procedureBindings") or []
        if str(b.get("procedureId", "")).startswith(NATIVE_PREFIX)
    }
    if len(proc_ids) != expected["procedureBindings"]:
        failures.append(
            f"procedureBindings: expected {expected['procedureBindings']}, got {len(proc_ids)}"
        )

    meas_keys = {
        f"{b.get('procedureId')}:{b.get('measurementKnowledgeId')}"
        for b in family.get("measurementBindings") or []
        if str(b.get("procedureId", "")).startswith(NATIVE_PREFIX)
    }
    if len(meas_keys) != expected["measurementBindings"]:
        failures.append(
            f"measurementBindings: expected {expected['measurementBindings']}, got {len(meas_keys)}"
        )

    component_ids = {
        c.get("id") for c in (family.get("add") or {}).get("components") or []
    }
    if len(component_ids) != expected["platformComponents"]:
        failures.append(
            f"platformComponents: expected {expected['platformComponents']}, got {len(component_ids)}"
        )

    forbidden_procs = {
        "samsungdw-communication",
        "samsungdw-power-supply",
        "samsungdw-hmi-check",
        "samsungdw-leak-sensor",
    }
    for proc_id in forbidden_procs:
        if proc_id in proc_ids:
            failures.append(f"forbidden procedure binding published: {proc_id}")

    aliases = family.get("oemTermAliases") or {}
    if "diverter_motor" in aliases or "diverter motor" in aliases:
        failures.append("diverter_motor alias must not be published")

    if "diverter_motor" in component_ids:
        failures.append("diverter_motor platform component must not be published")

    structural_blob = json.dumps(
        {
            "oemTermAliases": family.get("oemTermAliases"),
            "procedureBindings": family.get("procedureBindings"),
            "measurementBindings": family.get("measurementBindings"),
            "componentIds": [
                c.get("id") for c in (family.get("add") or {}).get("components") or []
            ],
        }
    )
    leaks = _scan_leaks(structural_blob)
    if leaks:
        failures.append(f"Whirlpool leak in Samsung structural fields: {leaks}")

    main_control_note = any(
        "samsung_fl_washer" in str(b.get("platformNote", ""))
        for b in family.get("procedureBindings") or []
    )
    if main_control_note:
        failures.append("Washer overlay provenance must not appear in procedure bindings")

    return failures


def _relationship_keys(relationships: list[dict]) -> set[tuple]:
    return {
        (rel.get("from"), rel.get("to"), rel.get("type"))
        for rel in relationships or []
    }


def reconcile_first_manual_equivalence(
    reference_family: dict,
    generated_family: dict,
    equivalence: dict[str, Any],
) -> dict[str, Any]:
    """First Samsung manual — additive platform topology from empty skeleton is allowed."""
    checks = dict(equivalence.get("checks") or {})
    if equivalence.get("equivalent"):
        return equivalence

    if not (
        checks.get("canonicalAliases")
        and checks.get("procedureBindings")
        and checks.get("measurementBindings")
        and checks.get("topologyOverrides") is False
    ):
        return equivalence

    ref_rels = (reference_family.get("add") or {}).get("relationships") or []
    gen_rels = (generated_family.get("add") or {}).get("relationships") or []
    ref_overrides = reference_family.get("overrides") or []
    gen_overrides = generated_family.get("overrides") or []

    if ref_overrides == gen_overrides and _relationship_keys(ref_rels).issubset(
        _relationship_keys(gen_rels)
    ):
        checks["topologyOverrides"] = True
        checks["topologyAdditiveOnly"] = True
        equivalence = {
            **equivalence,
            "equivalent": True,
            "checks": checks,
            "note": "First-manual publish — additive Samsung platform topology from skeleton.",
        }
    return equivalence


def apply_samsung_dishwasher_gate_delta(
    overlay: dict,
    table: dict,
    *,
    publish: bool = False,
) -> tuple[dict, dict[str, Any]]:
    """
    Apply gate-table authoritative intent to samsung_dishwasher overlay.
    Returns (overlay_after, publication_plan_with_results).
    Fail closed on representation gaps.
    """
    plan = build_publication_plan(table)
    intent = plan["gateIntent"]

    family = find_platform_family(overlay, PLATFORM_FAMILY_ID)
    if not family:
        raise GatePublishError(f"Platform family {PLATFORM_FAMILY_ID} not found")

    publisher_result: dict[str, Any] = {
        "manufacturerAliases": {"applied": [], "skipped": [], "failures": []},
        "procedureBindings": {"applied": [], "skipped": [], "failures": []},
        "measurementBindings": {"applied": [], "skipped": [], "failures": []},
        "platformComponents": {"applied": [], "skipped": [], "failures": []},
    }

    try:
        publisher_result["manufacturerAliases"]["applied"] = _apply_aliases(
            family,
            intent["manufacturerAliases"],
        )
        publisher_result["platformComponents"]["applied"] = _apply_platform_components(
            family,
            intent["platformComponents"],
        )
        publisher_result["procedureBindings"]["applied"] = _apply_procedure_bindings(
            family,
            intent["procedureBindings"],
        )
        publisher_result["measurementBindings"]["applied"] = _apply_measurement_bindings(
            family,
            intent["measurementBindings"],
        )
    except GatePublishError as exc:
        publisher_result["representationFailures"] = [str(exc)]
        plan["publisherResult"] = publisher_result
        plan["publishBlocked"] = True
        plan["blockedReason"] = str(exc)
        raise

    for key, display in DISPLAY_TERMS.items():
        family.setdefault("displayTerms", {})[key] = display

    deferred = family.setdefault("deferredConcepts", {})
    deferred["platform"] = (table.get("proposedPlatformDelta") or {}).get("deferred") or [
        "leak_sensor",
        "main_pba_power",
    ]
    deferred["rejectedProceduralTitles"] = sorted(
        {
            m.get("manualConcept")
            for m in table.get("mappings") or []
            if m.get("gateAction") == "defer_procedural_title"
        }
    )

    family["compoundingManualIds"] = [MANUAL_ID]
    overlay["gateArtifact"] = "SAMSUNG_DISHWASHER_overlay_mapping_table_v1.json"
    overlay["publishedManualIds"] = [MANUAL_ID]
    overlay["status"] = "published" if publish else "gated_preview"
    overlay["publishedAt"] = datetime.now(timezone.utc).isoformat()
    overlay["label"] = "Samsung dishwasher family overlays"

    representation_failures = _verify_post_publish(family, plan)
    if representation_failures:
        publisher_result["representationFailures"] = representation_failures
        plan["publisherResult"] = publisher_result
        plan["publishBlocked"] = True
        plan["blockedReason"] = "; ".join(representation_failures)
        raise GatePublishError(plan["blockedReason"])

    applied_counts = {
        "manufacturerAliases": len(publisher_result["manufacturerAliases"]["applied"]),
        "procedureBindings": len(publisher_result["procedureBindings"]["applied"]),
        "measurementBindings": len(publisher_result["measurementBindings"]["applied"]),
        "platformComponents": len(publisher_result["platformComponents"]["applied"]),
    }
    expected_counts = intent["counts"]
    silently_dropped = []
    for category in ("procedureBindings", "measurementBindings", "platformComponents"):
        gate_count = expected_counts[category]
        applied_count = applied_counts[category]
        if applied_count != gate_count:
            silently_dropped.append(
                f"{category}: gate={gate_count} applied={applied_count}"
            )
    alias_gate = expected_counts["manufacturerAliases"]
    alias_applied = applied_counts["manufacturerAliases"]
    if alias_applied != alias_gate:
        silently_dropped.append(
            f"manufacturerAliases: gate={alias_gate} applied={alias_applied}"
        )

    plan["publisherResult"] = publisher_result
    plan["appliedCounts"] = applied_counts
    plan["silentlyDropped"] = silently_dropped
    plan["publishBlocked"] = bool(silently_dropped)
    if silently_dropped:
        plan["blockedReason"] = f"Representation failure: {silently_dropped}"
        raise GatePublishError(plan["blockedReason"])

    plan["summary"] = {
        "gateIntentTotal": expected_counts["totalApproved"],
        "publisherAppliedTotal": sum(applied_counts.values()),
        "representationFailures": 0,
        "publishBlocked": False,
    }

    return overlay, plan
