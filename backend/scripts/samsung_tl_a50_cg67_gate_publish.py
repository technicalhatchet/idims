#!/usr/bin/env python3
"""Gate-table → overlay publisher for SAMSUNG-TL-A50-WASHER CG-6.7 (first Samsung TL learning event)."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANUAL_ID = "SAMSUNG-TL-A50-WASHER"
PLATFORM_ID = "samsung_tl_washer_a50"
PLATFORM_FAMILY_ID = "samsung_tl_washer_a50"
OVERLAY_FILE = "samsung_top_load_washer.json"
GATE_TABLE_ARTIFACT = "SAMSUNG_TL_A50_WASHER_overlay_mapping_table_v1.json"
LEDGER_ARTIFACT = "SAMSUNG_TL_A50_WASHER_gate_decision_ledger_v1.json"
GATE_KIND = "samsung_tl_first_manual_compounding"
NATIVE_PREFIX = "samsungtla50-"
EXPECTED_CANONICAL_HASH = "dee6b0c7128706eb78ac0e290090cd3d79d98dad579f41d6fa0a36ea3fdbf2b5"
EXPECTED_LEARNING_DECISION_IDS = frozenset(
    {
        "seed:clutch",
        "seed:door_lock",
        "seed:main_control",
        "seed:supply",
        "seed:user_interface",
        "seed:wash_ntc",
    }
)
EXPECTED_ARTIFACT_COUNTS = {
    "procedureBindings": 8,
    "measurementBindings": 5,
    "procedureRoleEvidence": 2,
    "deferredArtifacts": 12,
    "learningDecisions": 6,
}

FORBIDDEN_ALIAS_TARGETS = frozenset({"lid_switch", "drive_system", "wash_heater", "door_lock_test"})
FORBIDDEN_ALIAS_PREFIXES = ("§", "TEST #")
WHIRLPOOL_LEAK_PATTERNS = (
    "whirlpool_tl",
    "whirlpool_tl_dd",
    "w10864849",
    "w11697231",
    "w11416787",
    "mode_shifter",
    "whirlpool_top_load",
    "bulk_level_switch",
    "recirc_pump",
    "pressure_switch",
    "door_lock_test",
)
SAMSUNG_FL_LEAK_PATTERNS = (
    "samsung_fl_washer",
    "wf45t6000",
    "wf6000",
    "bb8700",
    "inverter_board",
)

DEFERRED_PROCEDURE_IDS = frozenset(
    {
        "samsungtla50-clutch",
        "samsungtla50-communication",
        "samsungtla50-hmi-check",
        "samsungtla50-mems-sensor",
        "samsungtla50-wash-heater",
        "samsungtla50-wash-thermistor",
        "samsungtla50-inlet-valves",
    }
)

PLATFORM_COMPONENT_SPECS: dict[str, dict[str, Any]] = {
    "clutch": {
        "id": "clutch",
        "name": "Clutch / hall position actuator",
        "aliases": ["clutch"],
        "systemId": "drive",
        "categoryId": "transmission_or_shifter",
        "type": "actuator",
        "implementsCanonicalId": "transmission_or_shifter",
        "note": "Samsung TL platform implementation — not canonical expansion.",
    },
    "supply": {
        "id": "supply",
        "name": "Line voltage / supply path",
        "aliases": ["supply"],
        "systemId": "power",
        "categoryId": "electrical_supply",
        "type": "external_input",
        "implementsCanonicalId": "power_supply",
        "note": "Samsung seed id — functional power_supply (samsungtla50-power-supply procedure evidence).",
    },
    "wash_ntc": {
        "id": "wash_ntc",
        "name": "Wash temperature NTC",
        "aliases": ["wash_ntc"],
        "systemId": "temperature",
        "categoryId": "wash_heating",
        "type": "sensor",
        "implementsCanonicalId": "temperature_sensor",
        "note": "Samsung NTC seed id — functional temperature_sensor.",
    },
}

PLATFORM_RELATIONSHIPS = [
    {
        "from": "clutch",
        "to": "transmission_or_shifter",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
        "note": "Samsung clutch/hall fulfills transmission_or_shifter — drive_system absent.",
    },
    {
        "from": "supply",
        "to": "power_supply",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
        "note": "Electrical supply function established by samsungtla50-power-supply — not generic word alone.",
    },
    {
        "from": "wash_ntc",
        "to": "temperature_sensor",
        "type": "implements",
        "source": "service_manual",
        "confidence": "high",
    },
]

SEED_ALIAS_MAP: dict[str, str] = {
    "main_control": "control_board",
    "user_interface": "hmi_control",
    "door_lock": "lid_lock",
    "drain_pump": "drain_pump",
    "inlet_valve": "inlet_valve",
    "drive_motor": "drive_motor",
    "water_level_sensor": "water_level_sensor",
    "supply": "power_supply",
    "wash_ntc": "temperature_sensor",
}

DISPLAY_TERMS = {
    "control_board": "Main control / PBA",
    "hmi_control": "Control panel (BC2)",
    "power_supply": "Line voltage / supply (UC, 9C1, 9C2)",
    "lid_lock": "Door lock assembly (DC) — spin-safety path",
    "temperature_sensor": "Wash NTC (TC1–TC4)",
    "transmission_or_shifter": "Clutch / hall position (PC)",
}


class GatePublishError(Exception):
    """Raised when approved gate intent cannot be fully represented."""


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_sha256(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def extract_gated_learning_decisions(ledger: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        entry
        for entry in ledger.get("entries") or []
        if entry.get("newSemanticDecision") is True
    ]


def gated_learning_decision_ids(ledger: dict[str, Any]) -> frozenset[str]:
    ids = {str(entry.get("artifactId")) for entry in extract_gated_learning_decisions(ledger)}
    if None in ids:
        ids.discard("None")
    return frozenset(ids)


def build_learning_decision_records(ledger: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for entry in sorted(extract_gated_learning_decisions(ledger), key=lambda e: e.get("artifactId", "")):
        records.append(
            {
                "artifactId": entry.get("artifactId"),
                "seedComponentId": entry.get("seedComponentId"),
                "gateAction": entry.get("gateAction"),
                "decisionKind": entry.get("decisionKind"),
                "disposition": entry.get("disposition"),
                "canonicalFunctionalRole": entry.get("canonicalFunctionalRole") or [],
                "isLearningEvent": True,
                "isCertification": False,
            }
        )
    return records


def reconcile_promoted_learning_decisions(
    promoted_ids: list[str],
    ledger: dict[str, Any],
) -> None:
    expected = gated_learning_decision_ids(ledger)
    if expected != EXPECTED_LEARNING_DECISION_IDS:
        raise GatePublishError(
            f"ledger learning decision IDs drift from frozen contract "
            f"(expected {sorted(EXPECTED_LEARNING_DECISION_IDS)}, ledger {sorted(expected)})"
        )
    promoted = frozenset(promoted_ids)
    if promoted != expected:
        missing = sorted(expected - promoted)
        extra = sorted(promoted - expected)
        raise GatePublishError(
            "learning decision reconciliation failed: "
            f"missing={missing or 'none'} extra={extra or 'none'}"
        )


def _scan_leaks(blob: str, patterns: tuple[str, ...]) -> list[str]:
    lower = blob.lower()
    return [pattern for pattern in patterns if pattern in lower]


def scaffold_samsung_top_load_washer_overlay() -> dict[str, Any]:
    return {
        "schemaVersion": "1.0.0",
        "overlayKind": "manufacturer",
        "canonicalOntologyId": "top_load_washer",
        "manufacturer": "Samsung",
        "label": "Samsung top-load washer family overlays",
        "platformFamilies": [
            {
                "platformFamilyId": PLATFORM_FAMILY_ID,
                "platformId": PLATFORM_ID,
                "manualId": MANUAL_ID,
                "label": "Samsung TL washer A50 family (WA50R, WA51DG, WF45A)",
                "appliesTo": {
                    "templateId": "washer",
                    "manufacturers": ["Samsung"],
                    "modelPatterns": ["WA50R*", "WA51D*", "WA52D*", "WF45A*"],
                    "platformIds": [PLATFORM_ID],
                },
                "oemTermAliases": {},
                "displayTerms": {},
                "add": {"components": [], "relationships": []},
                "procedureBindings": [],
                "measurementBindings": [],
            }
        ],
        "status": "draft",
        "gateKind": GATE_KIND,
    }


def collect_gate_intent(table: dict[str, Any], ledger: dict[str, Any]) -> dict[str, Any]:
    buckets = table.get("gateBuckets") or {}
    inheritance = buckets.get("A_canonical_inheritance", {}).get("items") or []
    seed_reviews = buckets.get("B_samsung_knowledge", {}).get("seedReviews") or []
    surfaces = buckets.get("B_samsung_knowledge", {}).get("procedureSurfaces") or []
    lid = buckets.get("C_evidence_derived_roles", {}).get("lidAuthorization") or {}
    clutch = buckets.get("C_evidence_derived_roles", {}).get("clutchEvidence") or {}

    approved_seeds = [
        s
        for s in seed_reviews
        if s.get("gateAction")
        in {
            "approve_platform_implementation",
            "approve_manufacturer_vocabulary",
            "approve_platform_vocabulary_role_split",
        }
    ]
    deferred_seeds = [s for s in seed_reviews if str(s.get("gateAction", "")).startswith("defer")]

    return {
        "inheritanceItems": inheritance,
        "approvedSeedReviews": approved_seeds,
        "deferredSeedReviews": deferred_seeds,
        "deferredSurfaces": surfaces,
        "procedureRoleEvidence": lid.get("roles") or [],
        "matcherPolicy": lid.get("matcherPolicy") or {},
        "clutchEvidence": clutch,
        "deferredProceduralTitles": table.get("deferredProceduralTitles") or [],
        "infrastructureCorrection": table.get("infrastructureCorrection") or {},
        "accounting": ledger.get("accounting") or {},
        "counts": {
            "inheritanceRows": len(inheritance),
            "newOverlaySemanticDecisions": ledger.get("summary", {}).get(
                "newOverlaySemanticDecisions", 0
            ),
            "approvedSeeds": len(approved_seeds),
            "deferredSeeds": len(deferred_seeds),
            "deferredSurfaces": len(surfaces),
            "procedureRoleEvidence": len(lid.get("roles") or []),
        },
    }


def build_publication_plan(table: dict[str, Any], ledger: dict[str, Any]) -> dict[str, Any]:
    intent = collect_gate_intent(table, ledger)
    return {
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "publishMode": "gate_table_authoritative_first_manual_compounding",
        "gateKind": GATE_KIND,
        "isLearningEvent": True,
        "isCertification": False,
        "gateIntent": intent,
        "expectedCounts": {
            "oemSeedAliases": len(SEED_ALIAS_MAP),
            "platformComponents": len(PLATFORM_COMPONENT_SPECS),
            "procedureBindings": 8,
            "measurementBindings": 5,
            "procedureRoleEvidence": 2,
            "deferredProcedures": len(DEFERRED_PROCEDURE_IDS),
        },
    }


def _validate_alias(term: str, canonical_id: str) -> None:
    if any(term.startswith(prefix) for prefix in FORBIDDEN_ALIAS_PREFIXES):
        raise GatePublishError(f"Forbidden procedural-title alias: {term}")
    if canonical_id in FORBIDDEN_ALIAS_TARGETS:
        raise GatePublishError(f"Forbidden alias target {canonical_id} for term {term}")
    if term == "door_lock" and canonical_id != "lid_lock":
        raise GatePublishError("door_lock seed alias must target lid_lock only")
    blob = f"{term} {canonical_id}"
    if _scan_leaks(blob, WHIRLPOOL_LEAK_PATTERNS):
        raise GatePublishError(f"Whirlpool leak in alias: {term} -> {canonical_id}")
    if _scan_leaks(blob, SAMSUNG_FL_LEAK_PATTERNS):
        raise GatePublishError(f"Samsung FL leak in alias: {term} -> {canonical_id}")


def _family(overlay: dict[str, Any]) -> dict[str, Any]:
    families = overlay.get("platformFamilies") or []
    if not families:
        raise GatePublishError("overlay missing platformFamilies")
    return families[0]


def apply_samsung_tl_a50_cg67_gate_delta(
    overlay: dict[str, Any],
    table: dict[str, Any],
    ledger: dict[str, Any],
    *,
    publish: bool = False,
    canonical_hash: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if table.get("status") != "gated":
        raise GatePublishError(f"gate table not gated ({table.get('status')})")

    intent = collect_gate_intent(table, ledger)
    family = _family(overlay)
    applied: dict[str, list[str]] = {
        "oemSeedAliases": [],
        "platformComponents": [],
        "procedureBindings": [],
        "measurementBindings": [],
        "procedureRoleEvidence": [],
        "deferredArtifacts": [],
        "learningDecisions": [],
    }

    aliases = family.setdefault("oemTermAliases", {})
    for seed_id, canonical_id in SEED_ALIAS_MAP.items():
        if seed_id == "wash_heater":
            continue
        _validate_alias(seed_id, canonical_id)
        aliases[seed_id] = canonical_id
        applied["oemSeedAliases"].append(f"{seed_id}->{canonical_id}")

    family["displayTerms"] = {**family.get("displayTerms", {}), **DISPLAY_TERMS}

    for component_id, spec in PLATFORM_COMPONENT_SPECS.items():
        add = family.setdefault("add", {})
        components = add.setdefault("components", [])
        if not any(c.get("id") == component_id for c in components):
            components.append(spec)
        applied["platformComponents"].append(component_id)

    relationships = family.setdefault("add", {}).setdefault("relationships", [])
    for rel in PLATFORM_RELATIONSHIPS:
        key = (rel.get("from"), rel.get("to"), rel.get("type"))
        if not any(
            (r.get("from"), r.get("to"), r.get("type")) == key for r in relationships
        ):
            relationships.append(rel)

    procedure_bindings = family.setdefault("procedureBindings", [])
    bound_procedure_ids = {b.get("procedureId") for b in procedure_bindings}

    for item in intent["inheritanceItems"]:
        if item.get("layer") != "procedure_test_binding":
            continue
        proc_id = str(item.get("manualConcept") or "")
        test_target = item.get("canonicalTestTarget")
        if not test_target or not proc_id.startswith(NATIVE_PREFIX):
            continue
        if proc_id in DEFERRED_PROCEDURE_IDS:
            raise GatePublishError(f"deferred procedure has binding in gate A: {proc_id}")
        if proc_id in bound_procedure_ids:
            continue
        binding = {
            "procedureId": proc_id,
            "testTargetId": test_target,
            "canonicalComponents": item.get("canonicalComponents") or [],
            "layer": item.get("layer", "inherited_canonical"),
        }
        procedure_bindings.append(binding)
        bound_procedure_ids.add(proc_id)
        applied["procedureBindings"].append(proc_id)

    for item in intent["inheritanceItems"]:
        if item.get("layer") != "measurement_test_binding":
            continue
        proc_id = item.get("procedureId")
        knowledge_id = item.get("manualConcept")
        test_target = item.get("canonicalTestTarget")
        if not proc_id or not knowledge_id or not test_target:
            continue
        mb = {
            "procedureId": proc_id,
            "measurementKnowledgeId": knowledge_id,
            "testTargetId": test_target,
        }
        bindings = family.setdefault("measurementBindings", [])
        key = (proc_id, knowledge_id)
        if not any(
            (b.get("procedureId"), b.get("measurementKnowledgeId")) == key for b in bindings
        ):
            bindings.append(mb)
            applied["measurementBindings"].append(knowledge_id)

    role_evidence: list[dict[str, Any]] = []
    lid_proc = (table.get("gateBuckets") or {}).get("C_evidence_derived_roles", {}).get(
        "lidAuthorization", {}
    ).get("procedureId", "samsungtla50-door-lock")
    for role in intent["procedureRoleEvidence"]:
        entry = {
            "manualId": MANUAL_ID,
            "procedureId": lid_proc,
            "roleId": role.get("roleId"),
            "canonicalComponents": role.get("canonicalComponents") or [],
            "measurementKnowledgeIds": role.get("measurementKnowledgeIds") or [],
            "evidenceSteps": role.get("evidenceSteps") or [],
            "signalPhrases": role.get("signalPhrases") or [],
            "evidenceKind": "procedure_role_text",
            "gateAction": "approve_procedure_role_evidence",
            "doesNotFabricateMatcherAlias": True,
            "forbiddenMatcherAlias": role.get("forbiddenMatcherAlias"),
            "seedFunctionalAlias": role.get("seedFunctionalAlias"),
        }
        role_evidence.append(entry)
        applied["procedureRoleEvidence"].append(role.get("roleId"))

    deferred_artifacts: list[dict[str, Any]] = []
    for proc_id in sorted(DEFERRED_PROCEDURE_IDS):
        deferred_artifacts.append(
            {
                "procedureId": proc_id,
                "gateAction": "defer_platform_implementation",
                "reason": "WP3 gate — no overlay binding until platform vocabulary finalized.",
            }
        )
    for seed in intent["deferredSeedReviews"]:
        deferred_artifacts.append(
            {
                "seedComponentId": seed.get("seedComponentId"),
                "gateAction": seed.get("gateAction"),
                "reason": seed.get("rationale"),
            }
        )
    for surface in intent["deferredSurfaces"]:
        deferred_artifacts.append(
            {
                "procedureId": surface.get("procedureId"),
                "gateAction": surface.get("gateAction"),
                "reason": surface.get("rationale"),
            }
        )
    applied["deferredArtifacts"] = [str(d.get("procedureId") or d.get("seedComponentId")) for d in deferred_artifacts]

    for seed in intent["approvedSeedReviews"]:
        seed_id = seed.get("seedComponentId")
        if not seed_id:
            raise GatePublishError(f"approved seed review missing seedComponentId: {seed}")
        artifact_id = f"seed:{seed_id}"
        applied["learningDecisions"].append(artifact_id)

    reconcile_promoted_learning_decisions(applied["learningDecisions"], ledger)
    learning_records = build_learning_decision_records(ledger)

    overlay["gateArtifact"] = GATE_TABLE_ARTIFACT
    overlay["ledgerArtifact"] = LEDGER_ARTIFACT
    overlay["gateKind"] = GATE_KIND
    overlay["compoundingEvidence"] = {
        "isLearningEvent": True,
        "isCertification": False,
        "newOverlaySemanticDecisions": intent["accounting"].get("newOverlaySemanticDecisions", 6),
        "learningDecisions": learning_records,
        "infrastructureCorrection": intent["infrastructureCorrection"],
        "observationCanonicalInheritance": intent["accounting"].get(
            "postRoutingCanonicalInheritance", 23
        ),
        "note": (
            "First Samsung TL semantic learning event — not retroactive certification. "
            "WP1.1 +6 routing correction is zero teaching cost."
        ),
    }
    overlay["certificationEvidence"] = {
        "procedureRoleEvidence": role_evidence,
        "clutchObservation": intent["clutchEvidence"],
        "matcherPolicy": intent["matcherPolicy"],
    }
    overlay["deferredArtifacts"] = deferred_artifacts

    if publish:
        overlay["status"] = "published"
        overlay["publishedAt"] = datetime.now(timezone.utc).isoformat()
    else:
        overlay["status"] = "draft"
        overlay["draftAt"] = datetime.now(timezone.utc).isoformat()

    plan = build_publication_plan(table, ledger)
    plan["appliedCounts"] = {k: len(v) for k, v in applied.items()}
    plan["applied"] = applied
    plan["publishBlocked"] = not publish
    plan["summary"] = {
        "representationFailures": 0,
        "publisherAppliedTotal": sum(len(v) for v in applied.values()),
        "gateIntentTotal": intent["counts"]["approvedSeeds"]
        + intent["counts"]["inheritanceRows"]
        + intent["counts"]["procedureRoleEvidence"],
    }

    _validate_overlay(overlay, intent, ledger=ledger, applied=applied)
    if publish:
        if not canonical_hash:
            raise GatePublishError("canonical_hash required when publish=True")
        _enforce_publish_invariants(
            overlay,
            table,
            ledger,
            applied,
            canonical_hash=canonical_hash,
        )
    return overlay, plan


def _enforce_publish_invariants(
    overlay: dict[str, Any],
    table: dict[str, Any],
    ledger: dict[str, Any],
    applied: dict[str, list[str]],
    *,
    canonical_hash: str,
) -> None:
    if canonical_hash != EXPECTED_CANONICAL_HASH:
        raise GatePublishError(
            f"canonical hash mismatch at publish gate "
            f"(expected {EXPECTED_CANONICAL_HASH}, got {canonical_hash})"
        )

    accounting = ledger.get("accounting") or {}
    if accounting.get("newOverlaySemanticDecisions") != 6:
        raise GatePublishError("newOverlaySemanticDecisions must be exactly 6")
    if accounting.get("canonicalExpansion", -1) != 0:
        raise GatePublishError("canonicalExpansion must be zero")
    leaks = accounting.get("forbiddenFamilyLeaks") or {}
    if any(leaks.get(k, 0) != 0 for k in ("whirlpoolTl", "whirlpoolFl", "samsungFl")):
        raise GatePublishError(f"foreign family leaks must be zero: {leaks}")

    infra = ledger.get("infrastructureCorrection") or {}
    if infra.get("semanticLearningFromRouting", -1) != 0:
        raise GatePublishError("WP1.1 routing correction must not count as semantic learning")

    reconcile_promoted_learning_decisions(applied.get("learningDecisions") or [], ledger)

    learning_records = overlay.get("compoundingEvidence", {}).get("learningDecisions") or []
    if len(learning_records) != 6:
        raise GatePublishError(f"expected 6 learning decision records, got {len(learning_records)}")
    record_ids = {r.get("artifactId") for r in learning_records}
    if record_ids != EXPECTED_LEARNING_DECISION_IDS:
        raise GatePublishError("learning decision records do not match gated ledger artifact IDs")
    for record in learning_records:
        if record.get("isLearningEvent") is not True:
            raise GatePublishError(f"{record.get('artifactId')} missing isLearningEvent: true")
        if record.get("isCertification") is not False:
            raise GatePublishError(f"{record.get('artifactId')} must have isCertification: false")

    counts = {k: len(applied.get(k) or []) for k in EXPECTED_ARTIFACT_COUNTS}
    for key, expected in EXPECTED_ARTIFACT_COUNTS.items():
        if counts.get(key, -1) != expected:
            raise GatePublishError(f"artifact count {key}: expected {expected}, got {counts.get(key)}")

    family = _family(overlay)
    if family.get("platformId") != PLATFORM_ID:
        raise GatePublishError(f"platformId must remain {PLATFORM_ID}")
    if overlay.get("compoundingEvidence", {}).get("isCertification") is not False:
        raise GatePublishError("Samsung TL overlay must remain isCertification: false")
    if overlay.get("compoundingEvidence", {}).get("isLearningEvent") is not True:
        raise GatePublishError("Samsung TL overlay must have isLearningEvent: true")

    if table.get("status") != "gated":
        raise GatePublishError(f"gate table must be gated before publish (got {table.get('status')})")


def _overlay_has_drive_system(overlay: dict[str, Any]) -> bool:
    family = _family(overlay)
    if (family.get("oemTermAliases") or {}).get("drive_system"):
        return True
    for component in (family.get("add") or {}).get("components") or []:
        if component.get("id") == "drive_system":
            return True
        if component.get("implementsCanonicalId") == "drive_system":
            return True
    for rel in (family.get("add") or {}).get("relationships") or []:
        if rel.get("from") == "drive_system" or rel.get("to") == "drive_system":
            return True
    for binding in family.get("procedureBindings") or []:
        if "drive_system" in (binding.get("canonicalComponents") or []):
            return True
        if binding.get("testTargetId") == "drive_system":
            return True
    for role in (overlay.get("certificationEvidence") or {}).get("procedureRoleEvidence") or []:
        if "drive_system" in (role.get("canonicalComponents") or []):
            return True
    return False


def _validate_overlay(
    overlay: dict[str, Any],
    intent: dict[str, Any],
    *,
    ledger: dict[str, Any] | None = None,
    applied: dict[str, list[str]] | None = None,
) -> None:
    blob = json.dumps(overlay)
    if _overlay_has_drive_system(overlay):
        raise GatePublishError("drive_system leaked into overlay structural fields")
    if _scan_leaks(blob, WHIRLPOOL_LEAK_PATTERNS):
        raise GatePublishError(f"Whirlpool TL/FL leakage: {_scan_leaks(blob, WHIRLPOOL_LEAK_PATTERNS)}")
    if _scan_leaks(blob, SAMSUNG_FL_LEAK_PATTERNS):
        raise GatePublishError(f"Samsung FL leakage: {_scan_leaks(blob, SAMSUNG_FL_LEAK_PATTERNS)}")

    family = _family(overlay)
    aliases = family.get("oemTermAliases") or {}
    if aliases.get("door_lock") != "lid_lock":
        raise GatePublishError("door_lock alias must map to lid_lock only")
    if any(target == "lid_switch" for target in aliases.values()):
        raise GatePublishError("forbidden lid_switch matcher alias in oemTermAliases")
    if "wash_heater" in aliases or any(c.get("id") == "wash_heater" for c in (family.get("add") or {}).get("components") or []):
        raise GatePublishError("wash_heater must remain deferred")

    bound_ids = {b.get("procedureId") for b in family.get("procedureBindings") or []}
    overlap = bound_ids & DEFERRED_PROCEDURE_IDS
    if overlap:
        raise GatePublishError(f"deferred procedures incorrectly bound: {sorted(overlap)}")

    if intent["accounting"].get("canonicalExpansion", 0) != 0:
        raise GatePublishError("canonical expansion must be zero")

    if ledger is not None and applied is not None:
        reconcile_promoted_learning_decisions(applied.get("learningDecisions") or [], ledger)
        for key, expected in EXPECTED_ARTIFACT_COUNTS.items():
            actual = len(applied.get(key) or [])
            if actual != expected:
                raise GatePublishError(f"artifact count {key}: expected {expected}, got {actual}")
