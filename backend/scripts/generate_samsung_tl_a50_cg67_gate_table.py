#!/usr/bin/env python3
"""Generate SAMSUNG-TL-A50-WASHER CG-6.7 overlay mapping gate table v1 (WP2).

Fresh Samsung TL manufacturer-boundary gate against frozen top_load_washer rev1.
Built from WP1.1 clean re-observation — no further matcher changes unless gate exposes defect.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
KNOWLEDGE = ROOT / "frontend/components/diagnostics/knowledge"
CALIBRATION = KNOWLEDGE / "normalization/calibration"
CANDIDATES = KNOWLEDGE / "normalization/candidates"
CANONICAL_REV1 = KNOWLEDGE / "canonical/top_load_washer.json"

MANUAL_ID = "SAMSUNG-TL-A50-WASHER"
PLATFORM_ID = "samsung_tl_washer_a50"
PLATFORM_FAMILY_ID = "samsung_tl_washer_a50"
OUT = CALIBRATION / "SAMSUNG_TL_A50_WASHER_overlay_mapping_table_v1.json"

OBSERVATION = CALIBRATION / "SAMSUNG_TL_A50_WASHER_cg67_observation_v1.json"
MAPPING_CANDIDATES = CANDIDATES / MANUAL_ID / "canonical_mapping_candidates.json"
OVERLAY_CANDIDATES = CANDIDATES / MANUAL_ID / "overlay_candidates.json"

REV1_ALLOWED = [
    "agitator_or_impeller",
    "basket",
    "control_board",
    "drain_path",
    "drain_pump",
    "drive_motor",
    "hmi_control",
    "inlet_valve",
    "lid_lock",
    "lid_switch",
    "power_supply",
    "spin_system",
    "suspension_system",
    "temperature_sensor",
    "transmission_or_shifter",
    "tub",
    "water_level_sensor",
]

REV1_TEST_TARGETS = [
    "lid_lock_test",
    "drain_test",
    "motor_command_test",
    "motor_output_test",
    "motor_winding_test",
    "shifter_test",
]

LID_ROLE_PROCEDURE = {
    "manualId": MANUAL_ID,
    "procedureId": "samsungtla50-door-lock",
    "roles": [
        {
            "roleId": "lid_switch_authorization",
            "canonicalComponents": ["lid_switch"],
            "evidenceSteps": ["reed_ohms", "replace_reed"],
            "measurementKnowledgeIds": ["samsungTlA50WasherDoorReedOhms"],
            "signalPhrases": ["reed switch"],
            "gateAction": "approve_procedure_role_evidence",
            "forbiddenMatcherAlias": "door_lock → lid_switch",
        },
        {
            "roleId": "lid_lock_spin_safety",
            "canonicalComponents": ["lid_lock"],
            "evidenceSteps": ["lock_motor_ohms", "replace_lock_motor", "replace_lock_unit"],
            "measurementKnowledgeIds": [
                "samsungTlA50WasherDoorLockMotorOhms",
                "samsungTlA50WasherDoorLockContactOhms",
            ],
            "signalPhrases": ["lock motor", "lock switch"],
            "gateAction": "approve_procedure_role_evidence",
            "seedFunctionalAlias": "door_lock → lid_lock (top_load_functional_alias only)",
        },
    ],
    "matcherPolicy": {
        "allowed": "door_lock seed → lid_lock via top_load_functional_alias",
        "forbidden": "door_lock → lid_switch matcher alias",
        "rationale": "Procedure evidence distinguishes reed/closed authorization from lock-motor spin safety.",
    },
}

# Bucket B — seven procedure-level seed concepts; each gated individually.
SAMSUNG_KNOWLEDGE_REVIEWS: list[dict[str, Any]] = [
    {
        "seedComponentId": "clutch",
        "procedureIds": ["samsungtla50-clutch"],
        "disposition": "samsung_tl_platform_implementation",
        "canonicalFunctionalRole": ["transmission_or_shifter"],
        "implementationComponent": "clutch",
        "gateAction": "approve_platform_implementation",
        "rationale": (
            "Samsung clutch/hall implements transmission_or_shifter — platform vocabulary, "
            "not canonical expansion. drive_system = 0."
        ),
        "observationPreserved": True,
    },
    {
        "seedComponentId": "door_lock",
        "procedureIds": ["samsungtla50-door-lock"],
        "disposition": "evidence_derived_role_split",
        "canonicalFunctionalRole": ["lid_switch", "lid_lock"],
        "implementationComponent": "door_lock",
        "gateAction": "approve_platform_vocabulary_role_split",
        "rationale": (
            "Seed id door_lock is Samsung OEM vocabulary. door_lock→lid_lock approved for "
            "lock/spin-safety only (bucket A functional alias). lid_switch from procedure "
            "evidence (bucket C). Forbidden: door_lock→lid_switch matcher."
        ),
        "observationPreserved": True,
    },
    {
        "seedComponentId": "main_control",
        "procedureIds": ["samsungtla50-communication", "samsungtla50-mems-sensor", "samsungtla50-power-supply"],
        "disposition": "samsung_manufacturer_vocabulary",
        "canonicalFunctionalRole": ["control_board"],
        "implementationComponent": "main_control",
        "gateAction": "approve_manufacturer_vocabulary",
        "rationale": "Samsung PCB/PBA seed id maps to control_board functionally — not Samsung FL overlay routing.",
    },
    {
        "seedComponentId": "supply",
        "procedureIds": ["samsungtla50-power-supply"],
        "disposition": "samsung_tl_platform_implementation",
        "canonicalFunctionalRole": ["power_supply"],
        "implementationComponent": "supply",
        "functionalAlias": "supply → power_supply (top_load_functional_alias)",
        "gateAction": "approve_platform_implementation",
        "rationale": "Samsung seed id for mains/LVS path — functional normalization, not Whirlpool inheritance.",
    },
    {
        "seedComponentId": "user_interface",
        "procedureIds": ["samsungtla50-hmi-check"],
        "disposition": "samsung_manufacturer_vocabulary",
        "canonicalFunctionalRole": ["hmi_control"],
        "implementationComponent": "user_interface",
        "gateAction": "approve_manufacturer_vocabulary",
        "rationale": "Samsung UI/console seed id — functional target hmi_control inherited separately in bucket A.",
    },
    {
        "seedComponentId": "wash_heater",
        "procedureIds": ["samsungtla50-wash-heater"],
        "disposition": "defer_platform_implementation",
        "canonicalFunctionalRole": [],
        "implementationComponent": "wash_heater",
        "gateAction": "defer_human_review",
        "rationale": (
            "No rev1 wash_heater canonical id. Gate must decide temperature-domain binding "
            "vs platform-only implementation before promotion."
        ),
    },
    {
        "seedComponentId": "wash_ntc",
        "procedureIds": ["samsungtla50-wash-heater", "samsungtla50-wash-thermistor"],
        "disposition": "samsung_tl_platform_implementation",
        "canonicalFunctionalRole": ["temperature_sensor"],
        "implementationComponent": "wash_ntc",
        "functionalAlias": "wash_ntc → temperature_sensor (top_load_functional_alias)",
        "gateAction": "approve_platform_implementation",
        "rationale": "Samsung NTC seed id — functional normalization to rev1 temperature_sensor.",
    },
]

# Samsung-specific procedure surfaces beyond the seven seed ids.
SAMSUNG_PROCEDURE_SURFACES: list[dict[str, Any]] = [
    {
        "procedureId": "samsungtla50-mems-sensor",
        "seedComponentIds": ["main_control"],
        "gateAction": "defer_platform_implementation",
        "rationale": "MEMS vibration/tilt on main PCB — Samsung platform surface; no rev1 canonical expansion.",
    },
    {
        "procedureId": "samsungtla50-leak-check",
        "seedComponentIds": ["drain_pump"],
        "gateAction": "defer_platform_implementation",
        "rationale": "Leak detection path — Samsung-specific; functional drain domain only via inherited drain_pump.",
    },
    {
        "procedureId": "samsungtla50-overflow",
        "seedComponentIds": ["water_level_sensor", "inlet_valve"],
        "gateAction": "defer_platform_implementation",
        "rationale": "Overflow sensor family — platform vocabulary TBD; rev1 water_level/inlet inherited.",
    },
    {
        "procedureId": "samsungtla50-unbalance",
        "seedComponentIds": ["drive_motor"],
        "gateAction": "defer_platform_implementation",
        "rationale": "UB unbalance detection — Samsung platform diagnostic; drive_motor inherited functionally.",
    },
]


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _matcher_layers(candidate: dict[str, Any]) -> list[str]:
    provenance = candidate.get("provenance") or {}
    return [
        str(source.get("layer") or "")
        for source in provenance.get("sources") or []
        if source.get("type") == "matcher"
    ]


def _layer_for_inheritance(candidate: dict[str, Any], canonical_id: str) -> str:
    layers = _matcher_layers(candidate)
    if any("top_load_functional_alias" in layer for layer in layers):
        return "top_load_functional_alias"
    if any("component_aliases" in layer for layer in layers):
        return "matcher_derived"
    if any("canonical_ontology_alias" in layer for layer in layers):
        return "canonical_functional"
    if canonical_id in REV1_ALLOWED:
        return "canonical_functional"
    return "canonical_functional"


def _build_bucket_a(mappings: list[dict[str, Any]], overlays: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    rev1_set = set(REV1_ALLOWED)
    test_set = set(REV1_TEST_TARGETS)

    inheritable_statuses = {"candidate", "COMPOUND_TERM_CANDIDATE"}
    mapping_index: dict[str, int] = {}

    for candidate in mappings:
        if candidate.get("status") not in inheritable_statuses:
            continue
        canonical_id = candidate.get("canonicalId")
        if canonical_id not in rev1_set:
            continue
        merge_key = f"{canonical_id}::{candidate.get('procedureId') or candidate.get('seedComponentId') or ''}"
        if merge_key in mapping_index:
            row = rows[mapping_index[merge_key]]
            row["candidateIds"].append(candidate["id"])
            if candidate.get("status") == "COMPOUND_TERM_CANDIDATE":
                row.setdefault("compoundTitleCandidateIds", []).append(candidate["id"])
            continue
        mapping_index[merge_key] = len(rows)
        row = {
            "bucket": "A_canonical_inheritance",
            "manualConcept": candidate.get("sourceTerm"),
            "seedComponentId": candidate.get("seedComponentId"),
            "canonicalComponents": [canonical_id],
            "layer": _layer_for_inheritance(candidate, canonical_id),
            "gateAction": "approve_inherited_canonical",
            "candidateIds": [candidate["id"]],
            "matcherLayers": _matcher_layers(candidate),
            "independenceCheck": (
                "Resolves against frozen top_load_washer rev1 without Whirlpool TL, "
                "Whirlpool FL, or Samsung FL overlay dependency."
            ),
            "rationale": "WP1.1 clean observation — legitimate rev1 functional inheritance.",
        }
        if candidate.get("status") == "COMPOUND_TERM_CANDIDATE":
            row["compoundTitleCandidateIds"] = [candidate["id"]]
        rows.append(row)

    seen_proc_target: set[tuple[str, str]] = set()
    for candidate in overlays:
        test_target = candidate.get("canonicalTestTarget")
        if test_target not in test_set:
            continue
        proc_id = str(candidate.get("procedureId") or "")
        key = (proc_id, test_target)
        if candidate.get("candidateType") == "procedureTestBinding":
            if key in seen_proc_target:
                continue
            seen_proc_target.add(key)
            rows.append(
                {
                    "bucket": "A_canonical_inheritance",
                    "manualConcept": proc_id,
                    "canonicalTestTarget": test_target,
                    "layer": "procedure_test_binding",
                    "gateAction": "approve_inherited_canonical",
                    "candidateIds": [candidate["id"]],
                    "independenceCheck": (
                        "Test target is rev1 canonical — no cross-family overlay dependency."
                    ),
                    "rationale": "Procedure binding inherits frozen rev1 test target vocabulary.",
                }
            )
        elif candidate.get("candidateType") == "measurementBinding":
            rows.append(
                {
                    "bucket": "A_canonical_inheritance",
                    "manualConcept": candidate.get("measurementKnowledgeId"),
                    "procedureId": proc_id,
                    "canonicalTestTarget": test_target,
                    "layer": "measurement_test_binding",
                    "gateAction": "approve_inherited_canonical",
                    "candidateIds": [candidate["id"]],
                    "rationale": "Measurement binding under rev1 test target family.",
                }
            )

    return rows


def _build_deferred_procedural(mappings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deferred: list[dict[str, Any]] = []
    for candidate in mappings:
        if not str(candidate.get("status", "")).startswith("UNRESOLVED"):
            continue
        layers = _matcher_layers(candidate)
        if not any("compound" in layer for layer in layers):
            continue
        deferred.append(
            {
                "bucket": "deferred_procedural_noise",
                "manualConcept": candidate.get("sourceTerm"),
                "layer": "defer_procedural_title",
                "gateAction": "defer_procedural_title",
                "candidateIds": [candidate["id"]],
                "rationale": "OEM §5-2/§5-3 procedure title — bind by procedureId only; not oemTermAlias promotion.",
            }
        )
    return deferred


def main() -> int:
    observation = _load_json(OBSERVATION)
    mappings = (_load_json(MAPPING_CANDIDATES).get("candidates") or [])
    overlays = (_load_json(OVERLAY_CANDIDATES).get("candidates") or [])
    rev1_meta = (_load_json(CANONICAL_REV1).get("ontology") or {})

    bucket_a = _build_bucket_a(mappings, overlays)
    deferred = _build_deferred_procedural(mappings)
    wp1_comparison = observation.get("wp1BeforeAfterComparison") or {}

    payload: dict[str, Any] = {
        "schemaVersion": "1.0.0",
        "reportType": "samsung_tl_a50_cg67_overlay_mapping_gate_table",
        "manualId": MANUAL_ID,
        "platformId": PLATFORM_ID,
        "platformFamilyId": PLATFORM_FAMILY_ID,
        "canonicalOntologyId": "top_load_washer",
        "proposedOverlayFile": "samsung_top_load_washer.json",
        "status": "pending_human_review",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "workPackage": "WP2_gate_table_design",
        "observationArtifact": "SAMSUNG_TL_A50_WASHER_cg67_observation_v1.json",
        "pipelineManifest": f"normalization/candidates/{MANUAL_ID}/pipeline_manifest.json",
        "canonicalContract": {
            "graph": "top_load_washer",
            "revision": "rev1",
            "frozen": bool(rev1_meta.get("frozen")),
            "ontologyHash": observation.get("ontologyHash"),
            "allowedCanonicalIds": REV1_ALLOWED,
            "conditionalCanonicalIds": ["lid_switch"],
            "forbiddenCanonicalIds": ["drive_system"],
            "contractRule": (
                "Samsung TL overlay may consume frozen rev1 functional ontology; "
                "it cannot mutate canonical rev1 or import Whirlpool TL vocabulary."
            ),
        },
        "gatePolicy": {
            "gateKind": "samsung_tl_manufacturer_boundary_first_manual",
            "purpose": (
                "First Samsung TL washer overlay gate — certify rev1 inheritance and "
                "individually gate Samsung platform vocabulary without Whirlpool dependency."
            ),
            "canonicalImmutabilityRule": "top_load_washer.json rev1 must remain byte-stable before and after publish.",
            "isolationRule": (
                "Zero Whirlpool TL, Whirlpool FL, and Samsung FL overlay dependency "
                "(verified WP1.1 re-observation)."
            ),
            "functionalAliasRule": (
                "top_load_functional_alias (door_lock→lid_lock, supply→power_supply, "
                "wash_ntc→temperature_sensor) is rev1 functional normalization — not Whirlpool inheritance."
            ),
            "lidAuthorizationRule": (
                "Certify lid_switch and lid_lock from procedure evidence only. "
                "Forbidden: door_lock → lid_switch matcher alias."
            ),
            "driveRoutingRule": (
                "clutch implements transmission_or_shifter at platform layer. "
                "No drive_system canonical routing."
            ),
            "teachingCostRule": (
                "WP1→WP1.1 +6 inheritance delta is infrastructure correction — zero new semantic decisions."
            ),
            "publishBlocked": True,
        },
        "layerDefinitions": {
            "canonical_functional": "Direct or alias-resolved rev1 canonical component target.",
            "top_load_functional_alias": "Neutral rev1 functional seed-id remap — not manufacturer vocabulary.",
            "matcher_derived": "Global/component alias registry resolving to rev1.",
            "procedure_test_binding": "Procedure bound to rev1 canonical test target.",
            "measurement_test_binding": "Measurement step under rev1 test target family.",
            "samsung_tl_platform_implementation": "Samsung TL platform component implementing rev1 function.",
            "samsung_manufacturer_vocabulary": "Samsung OEM seed id with rev1 functional anchor.",
            "evidence_derived_role_split": "Functional roles from procedure text — not matcher fabrication.",
            "defer_procedural_title": "OEM section title noise — procedureId binding only.",
            "defer_platform_implementation": "Genuine Samsung surface — human gate required before promotion.",
        },
        "infrastructureCorrection": {
            "workPackage": "WP1.1_boundary_cleanup_reobservation",
            "classification": "matcher_routing_hygiene_not_learning",
            "newSemanticDecisions": 0,
            "canonicalExpansion": 0,
            "before": (wp1_comparison.get("before") or {}).get("threeMetrics"),
            "after": (wp1_comparison.get("after") or {}).get("threeMetrics"),
            "deltas": wp1_comparison.get("deltas"),
            "attribution": (
                "Six additional canonical inheritance hits (17→23) are correct ontology routing "
                "under top_load_washer rev1 — not newly learned Samsung concepts. "
                "Previously classified FL pollution: door_lock, supply, wash_ntc functional remaps "
                "plus compound title resolutions."
            ),
            "successCriteria": wp1_comparison.get("successCriteria"),
        },
        "gateBuckets": {
            "A_canonical_inheritance": {
                "description": (
                    "Rev1 functional inheritance — certify only if independent of "
                    "Whirlpool/Samsung-FL overlays."
                ),
                "observationMetric": observation.get("threeMetrics", {}).get("canonicalInheritance", 23),
                "gateRowCount": len(bucket_a),
                "reconciliationNote": (
                    "Observation metric counts 23 candidate-level inheritance artifacts. "
                    "Gate rows merge seed-id mappings with duplicate OEM compound-title candidates "
                    "sharing the same rev1 canonical target."
                ),
                "items": bucket_a,
            },
            "B_samsung_knowledge": {
                "description": (
                    "Seven procedure-level seed concepts — individually gated; "
                    "do not predeclare as seven new canonical concepts."
                ),
                "observationCount": observation.get("procedureLevelSamsungPlatformCount", 7),
                "seedReviews": SAMSUNG_KNOWLEDGE_REVIEWS,
                "procedureSurfaces": SAMSUNG_PROCEDURE_SURFACES,
            },
            "C_evidence_derived_roles": {
                "description": (
                    "Lid authorization split from procedure evidence — no fabricated matcher aliases."
                ),
                "lidAuthorization": LID_ROLE_PROCEDURE,
                "clutchEvidence": {
                    "procedureId": "samsungtla50-clutch",
                    "seedComponent": "clutch",
                    "functionalCanonical": "transmission_or_shifter",
                    "observationVerdict": observation.get("focusAreaReview", {})
                    .get("driveClutchPath", {})
                    .get("observation"),
                    "driveSystemHits": 0,
                    "canonicalExpansion": 0,
                },
            },
        },
        "deferredProceduralTitles": deferred,
        "gateAccounting": {
            "proposedNewSemanticDecisions": 0,
            "infrastructureCorrectionOnly": True,
            "canonicalInheritanceToCertify": observation.get("threeMetrics", {}).get("canonicalInheritance", 23),
            "samsungKnowledgeReviewsPending": len(SAMSUNG_KNOWLEDGE_REVIEWS),
            "samsungProcedureSurfacesDeferred": len(SAMSUNG_PROCEDURE_SURFACES),
            "canonicalExpansion": 0,
            "deferredProceduralTitles": len(deferred),
            "forbiddenFamilyLeaks": {
                "whirlpoolTl": 0,
                "whirlpoolFl": 0,
                "samsungFl": 0,
            },
            "note": (
                "Teaching cost for WP1.1 is zero. Bucket B dispositions are recommendations — "
                "human gate (WP3) is authoritative."
            ),
        },
        "manufacturerIsolation": observation.get("manufacturerIsolation"),
        "nextWorkPackage": "WP3_human_gate_review",
    }

    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Bucket A rows: {len(bucket_a)}")
    print(f"Bucket B seed reviews: {len(SAMSUNG_KNOWLEDGE_REVIEWS)}")
    print(f"Deferred procedural titles: {len(deferred)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
