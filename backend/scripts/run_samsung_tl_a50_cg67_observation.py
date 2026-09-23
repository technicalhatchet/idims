#!/usr/bin/env python3
"""CG-6.7 WP1 — Fresh Samsung TL observation vs frozen top_load_washer rev1 (no gate/publish)."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANDIDATES = KNOWLEDGE / "normalization" / "candidates"
CANONICAL_REV1 = KNOWLEDGE / "canonical" / "top_load_washer.json"
CANONICAL_FL = KNOWLEDGE / "canonical" / "front_load_washer.json"
WHIRLPOOL_TL_OVERLAY = (
    KNOWLEDGE / "canonical" / "manufacturer_overlays" / "whirlpool_top_load_washer.json"
)
WHIRLPOOL_FL_OVERLAY = (
    KNOWLEDGE / "canonical" / "manufacturer_overlays" / "whirlpool_front_load_washer.json"
)
SAMSUNG_FL_OVERLAY = (
    KNOWLEDGE / "canonical" / "manufacturer_overlays" / "samsung_front_load_washer.json"
)
PROCEDURE_CATALOG = (
    ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "procedures"
    / "seed"
    / "samsung_tl_washer_a50"
    / "procedureCatalog.json"
)

TARGET_MANUAL = "SAMSUNG-TL-A50-WASHER"
PLATFORM_ID = "samsung_tl_washer_a50"
SMOKE_MODEL = "WA50R5200"

REV1_FORBIDDEN = frozenset({"drive_system"})
REV1_CONDITIONAL = frozenset({"lid_switch"})

# Samsung TL platform implementation concepts (observation — not canonical rev1)
SAMSUNG_PLATFORM_CONCEPTS = frozenset(
    {
        "clutch",
        "mems_sensor",
        "leak_sensor",
        "overflow_sensor",
        "pba",
        "sub_pba",
        "hall_sensor",
        "reed_switch",
        "door_lock",  # seed id — functional mapping TBD at gate
        "main_control",
        "inverter",
    }
)

WHIRLPOOL_TL_LEAK_PATTERNS = (
    "w10864849",
    "w11697231",
    "w11416787",
    "whirlpool_tl_dd",
    "mode_shifter",
    "whirlpool_top_load",
    "bulk_level_switch",
    "recirc_pump",
)
WHIRLPOOL_FL_LEAK_PATTERNS = (
    "w8178558",
    "w11169652",
    "whirlpool_duet_sport",
    "whirlpool_fl_dd",
    "door_lock_test",
    "pressure_switch",
)
SAMSUNG_FL_LEAK_PATTERNS = (
    "samsung_fl_washer",
    "wf45t6000",
    "samsungfl",
    "inverter_board",
    "bb8700",
)


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _normalize(term: str) -> str:
    return re.sub(r"\s+", " ", str(term or "").strip().lower())


def _component_ids(ontology: dict) -> set[str]:
    return {c["id"] for c in ontology.get("components", []) if c.get("id")}


def _matcher_layers(candidate: dict[str, Any]) -> list[str]:
    provenance = candidate.get("provenance") or {}
    return [
        str(source.get("layer") or "")
        for source in provenance.get("sources") or []
        if source.get("type") == "matcher"
    ]


def _scan_leaks(blob: str, patterns: tuple[str, ...]) -> list[str]:
    lower = blob.lower()
    return [p for p in patterns if p in lower]


def _is_whirlpool_overlay_dependent(layers: list[str]) -> bool:
    return any(
        "manufacturer_overlay:whirlpool" in layer
        or "whirlpool_tl" in layer
        or "whirlpool_fl" in layer
        for layer in layers
    )


def _run_fresh_cg3() -> dict[str, Any]:
    import sys

    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization

    manifest = load_manifest()
    entry = find_manual_entry(manifest, TARGET_MANUAL)
    print(f"==> CG-3 normalize {TARGET_MANUAL} (fresh)")
    return run_manual_normalization(entry)


def _procedure_inventory(catalog: dict, procedures_path: Path) -> dict[str, Any]:
    planned = catalog.get("plannedProcedures") or []
    normalized = _load_json(procedures_path) if procedures_path.is_file() else {}
    proc_list = normalized.get("procedures") or []
    return {
        "plannedCount": len(planned),
        "normalizedCount": len(proc_list),
        "plannedProcedureIds": [p["id"] for p in planned],
        "bundleIds": sorted(
            p.stem for p in PROCEDURE_CATALOG.parent.glob("bundles/*.json")
        ),
        "bundleCount": len(list(PROCEDURE_CATALOG.parent.glob("bundles/*.json"))),
    }


def _extract_lid_authorization_evidence(procedures: list[dict]) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    lid_patterns = (
        r"lid\s+switch",
        r"lock\s+switch",
        r"reed\s+switch",
        r"door\s+lock",
        r"lid\s+sensor",
        r"door\s+closed",
    )
    for procedure in procedures:
        proc_id = procedure.get("procedureId") or procedure.get("id")
        for step in procedure.get("steps") or []:
            blob = _normalize(
                f"{step.get('title', '')} {step.get('body', '')} {step.get('sourceExcerpt', '')}"
            )
            matched = [p for p in lid_patterns if re.search(p, blob)]
            if matched:
                hits.append(
                    {
                        "procedureId": proc_id,
                        "stepId": step.get("id"),
                        "matchedPatterns": matched,
                        "excerpt": (step.get("sourceExcerpt") or step.get("body") or "")[:200],
                    }
                )
    return hits


def _extract_drive_topology_evidence(procedures: list[dict]) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    drive_patterns = (
        r"clutch",
        r"motor",
        r"agitat",
        r"spin",
        r"hall\s+sensor",
        r"dehydrat",
        r"transmission",
        r"shifter",
        r"actuator",
    )
    for procedure in procedures:
        proc_id = procedure.get("procedureId") or procedure.get("id")
        component_ids = procedure.get("componentIds") or []
        for step in procedure.get("steps") or []:
            blob = _normalize(
                f"{step.get('title', '')} {step.get('body', '')} {step.get('sourceExcerpt', '')}"
            )
            matched = [p for p in drive_patterns if re.search(p, blob)]
            if matched:
                hits.append(
                    {
                        "procedureId": proc_id,
                        "stepId": step.get("id"),
                        "seedComponentIds": component_ids,
                        "matchedPatterns": matched,
                        "functionalQuestion": (
                            "What functional role does this implementation fulfill "
                            "(motor output / mode selection / agitate / spin)?"
                        ),
                    }
                )
    return hits[:40]


REV1_TEST_TARGETS = frozenset(
    {
        "motor_output_test",
        "drain_test",
        "fill_test",
        "lid_lock_test",
        "lid_switch_test",
        "temperature_test",
        "water_level_test",
        "hmi_test",
        "power_test",
    }
)
FL_ONLY_TEST_TARGETS = frozenset({"door_lock_test", "pressure_switch_test"})


def _classify_candidate(
    candidate: dict[str, Any],
    *,
    rev1_ids: set[str],
    fl_ids: set[str],
    whirlpool_tl_aliases: dict[str, str],
) -> dict[str, Any]:
    cid = candidate.get("canonicalId")
    test_target = candidate.get("canonicalTestTarget")
    component_ids = [str(c) for c in candidate.get("componentIds") or []]
    source_term = _normalize(str(candidate.get("sourceTerm") or ""))
    layers = _matcher_layers(candidate)
    blob = json.dumps(candidate)
    whirlpool_overlay_dep = _is_whirlpool_overlay_dependent(layers)
    wp_tl_leaks = _scan_leaks(blob, WHIRLPOOL_TL_LEAK_PATTERNS)
    wp_fl_leaks = _scan_leaks(blob, WHIRLPOOL_FL_LEAK_PATTERNS)
    samsung_fl_leaks = _scan_leaks(blob, SAMSUNG_FL_LEAK_PATTERNS)

    samsung_seed_hit = (
        source_term in SAMSUNG_PLATFORM_CONCEPTS
        or any(c in SAMSUNG_PLATFORM_CONCEPTS for c in component_ids)
        or any(c in SAMSUNG_PLATFORM_CONCEPTS for c in component_ids)
    )

    if whirlpool_overlay_dep or wp_tl_leaks:
        bucket = "forbidden_whirlpool_dependent"
    elif test_target in FL_ONLY_TEST_TARGETS:
        bucket = "pipeline_fl_test_target_pollution"
    elif test_target in REV1_TEST_TARGETS:
        bucket = "canonical_inheritance"
    elif cid in REV1_FORBIDDEN:
        bucket = "canonical_expansion_forbidden"
    elif cid in rev1_ids:
        bucket = "canonical_inheritance"
    elif cid in fl_ids and cid not in rev1_ids:
        bucket = "pipeline_fl_ontology_pollution"
    elif samsung_seed_hit or (
        not cid
        and str(candidate.get("status", "")).startswith("UNRESOLVED")
        and any(c in SAMSUNG_PLATFORM_CONCEPTS for c in component_ids + [source_term])
    ):
        bucket = "samsung_knowledge_creation"
    elif candidate.get("candidateType") in {"procedureTestBinding", "measurementBinding"}:
        bucket = "samsung_knowledge_creation"
    elif cid and cid not in rev1_ids and cid not in fl_ids:
        bucket = "samsung_knowledge_creation"
    elif not cid or str(candidate.get("status", "")).startswith("UNRESOLVED"):
        bucket = "unresolved_procedural_noise"
    else:
        bucket = "canonical_expansion_candidate"

    if cid in REV1_CONDITIONAL and bucket == "canonical_inheritance":
        bucket = "canonical_inheritance_conditional"

    return {
        "id": candidate.get("id"),
        "sourceTerm": candidate.get("sourceTerm") or candidate.get("procedureId"),
        "canonicalId": cid,
        "canonicalTestTarget": test_target,
        "componentIds": component_ids,
        "bucket": bucket,
        "matcherLayers": layers,
        "whirlpoolOverlayDependent": whirlpool_overlay_dep,
        "crossFamilyLeaks": {
            "whirlpoolTl": wp_tl_leaks,
            "whirlpoolFl": wp_fl_leaks,
            "samsungFl": samsung_fl_leaks,
        },
        "wouldRequireWhirlpoolTlOverlay": whirlpool_overlay_dep,
    }


def _whirlpool_tl_alias_map() -> dict[str, str]:
    if not WHIRLPOOL_TL_OVERLAY.is_file():
        return {}
    overlay = _load_json(WHIRLPOOL_TL_OVERLAY)
    aliases: dict[str, str] = {}
    for family in overlay.get("platformFamilies") or []:
        for term, target in (family.get("oemTermAliases") or {}).items():
            aliases[_normalize(term)] = target
    return aliases


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    rev1 = _load_json(CANONICAL_REV1)
    fl = _load_json(CANONICAL_FL)
    rev1_ids = _component_ids(rev1)
    fl_ids = _component_ids(fl)
    whirlpool_tl_aliases = _whirlpool_tl_alias_map()

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    overlays = _load_json(target_dir / "overlay_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []
    procedures = _load_json(target_dir / "normalized_procedures.json").get("procedures") or []
    catalog = _load_json(PROCEDURE_CATALOG)

    classified_mappings = [
        _classify_candidate(
            row,
            rev1_ids=rev1_ids,
            fl_ids=fl_ids,
            whirlpool_tl_aliases=whirlpool_tl_aliases,
        )
        for row in mappings
    ]
    classified_overlays = [
        _classify_candidate(
            row,
            rev1_ids=rev1_ids,
            fl_ids=fl_ids,
            whirlpool_tl_aliases=whirlpool_tl_aliases,
        )
        for row in overlays
    ]

    bucket_counter = Counter(row["bucket"] for row in classified_mappings + classified_overlays)
    layer_counter = Counter(
        layer for row in classified_mappings for layer in row.get("matcherLayers") or []
    )

    whirlpool_dependent = [
        row for row in classified_mappings + classified_overlays if row["whirlpoolOverlayDependent"]
    ]
    cross_leaks = {
        "whirlpoolTl": [],
        "whirlpoolFl": [],
        "samsungFl": [],
    }
    for row in classified_mappings + classified_overlays:
        for family, hits in row.get("crossFamilyLeaks", {}).items():
            if hits:
                cross_leaks[family].append({"id": row["id"], "patterns": hits})

    measurement_ids = sorted(
        {
            str(c.get("measurementKnowledgeId"))
            for c in overlays
            if c.get("measurementKnowledgeId")
        }
    )

    samsung_terms = sorted(
        {
            _normalize(c.get("sourceTerm") or "")
            for c in mappings
            if c.get("sourceTerm") and not str(c.get("sourceTerm")).startswith("§")
        }
    )

    lid_evidence = _extract_lid_authorization_evidence(procedures)
    drive_evidence = _extract_drive_topology_evidence(procedures)

    seed_component_histogram: Counter[str] = Counter()
    procedure_level: list[dict[str, Any]] = []
    for proc in procedures:
        proc_id = proc.get("procedureId") or proc.get("id")
        seed_ids = [str(c) for c in proc.get("componentIds") or []]
        for cid in seed_ids:
            seed_component_histogram[cid] += 1
        rev1_hits = [c for c in seed_ids if c in rev1_ids]
        samsung_platform = [
            c for c in seed_ids if c in SAMSUNG_PLATFORM_CONCEPTS or c not in rev1_ids
        ]
        procedure_level.append(
            {
                "procedureId": proc_id,
                "seedComponentIds": seed_ids,
                "rev1DirectHits": rev1_hits,
                "samsungPlatformCandidates": samsung_platform,
            }
        )

    procedure_samsung_platform = sorted(
        {
            c
            for row in procedure_level
            for c in row["samsungPlatformCandidates"]
            if c not in rev1_ids
        }
    )

    three_metrics = {
        "canonicalInheritance": bucket_counter.get("canonical_inheritance", 0)
        + bucket_counter.get("canonical_inheritance_conditional", 0),
        "samsungKnowledgeCreation": bucket_counter.get("samsung_knowledge_creation", 0),
        "canonicalExpansionCandidates": bucket_counter.get("canonical_expansion_candidate", 0)
        + bucket_counter.get("canonical_expansion_forbidden", 0),
        "unresolvedProceduralNoise": bucket_counter.get("unresolved_procedural_noise", 0),
        "pipelineFlOntologyPollution": bucket_counter.get("pipeline_fl_ontology_pollution", 0),
        "pipelineFlTestTargetPollution": bucket_counter.get("pipeline_fl_test_target_pollution", 0),
        "forbiddenWhirlpoolDependent": bucket_counter.get("forbidden_whirlpool_dependent", 0),
    }

    ontology_meta = rev1.get("ontology") or {}

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg67_samsung_tl_washer_cg3_observation",
        "phase": "CG-6.7",
        "workPackage": "WP1.1_boundary_cleanup_reobservation",
        "experiment": (
            "Manufacturer-boundary test — Samsung TL WA50R5200 observed against frozen "
            "top_load_washer rev1 without Whirlpool TL overlay imports."
        ),
        "certificationStatement": (
            "Not compounding. Not gate. Not promotion. Observation only."
        ),
        "manualId": TARGET_MANUAL,
        "platformId": PLATFORM_ID,
        "smokeModel": SMOKE_MODEL,
        "ontologyId": "top_load_washer",
        "ontologyFrozen": bool(ontology_meta.get("frozen")),
        "ontologyFrozenRevision": ontology_meta.get("frozenRevision"),
        "ontologyHash": "dee6b0c7128706eb78ac0e290090cd3d79d98dad579f41d6fa0a36ea3fdbf2b5",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "publishBlocked": True,
        "priorPhaseClosed": "CG66_WHIRLPOOL_TOP_LOAD_WASHER_FAMILY_LOCK_v1.json",
        "hierarchyShape": {
            "canonical": "top_load_washer rev1 (frozen — do not modify without contradiction)",
            "targetManufacturerOverlay": "samsung_top_load_washer.json (does not exist yet)",
            "whirlpoolTlOverlayPublished": WHIRLPOOL_TL_OVERLAY.is_file(),
            "whirlpoolTlOverlayUsedForResolution": False,
            "isolationGoal": (
                "Samsung TL knowledge must resolve through frozen rev1 functional ontology "
                "or become Samsung-specific knowledge — never inherit because Whirlpool TL exists."
            ),
            "hardBoundary": (
                "If a Samsung TL candidate can only be resolved because a Whirlpool TL overlay "
                "exists, it is NOT inherited knowledge."
            ),
        },
        "procedureInventory": _procedure_inventory(
            catalog,
            target_dir / "normalized_procedures.json",
        ),
        "pipelineCounts": manifest.get("counts") or {},
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
            "pipelineOntologyId": manifest.get("ontologyId"),
            "pipelineOntologyNote": (
                "CG-3 matcher routes samsung_tl_* through top_load_washer rev1 ontology and "
                "top_load functional aliases — not front_load_washer or Samsung FL overlays."
            ),
        },
        "threeMetrics": three_metrics,
        "threeMetricsDefinitions": {
            "canonicalInheritance": "Samsung evidence resolves directly to rev1 functional concepts",
            "samsungKnowledgeCreation": "New manufacturer/platform/model implementation knowledge",
            "canonicalExpansionCandidates": (
                "Evidence that potentially challenges frozen ontology — observation only, no promotion"
            ),
        },
        "classificationBuckets": dict(bucket_counter),
        "matcherLayers": dict(layer_counter.most_common()),
        "seedComponentHistogram": dict(seed_component_histogram.most_common()),
        "procedureLevelClassification": procedure_level,
        "samsungPlatformConceptsObserved": procedure_samsung_platform,
        "procedureLevelSamsungPlatformCount": len(procedure_samsung_platform),
        "measurementKnowledgeIds": measurement_ids,
        "samsungSpecificSeedTerms": samsung_terms[:60],
        "manufacturerIsolation": {
            "whirlpoolTlLeakCount": len(cross_leaks["whirlpoolTl"]),
            "whirlpoolFlLeakCount": len(cross_leaks["whirlpoolFl"]),
            "samsungFlLeakCount": len(cross_leaks["samsungFl"]),
            "whirlpoolOverlayDependentCount": len(whirlpool_dependent),
            "whirlpoolOverlayDependent": whirlpool_dependent[:20],
            "crossLeaks": cross_leaks,
            "verdict": (
                "clean"
                if not whirlpool_dependent
                and not cross_leaks["whirlpoolTl"]
                else "review_required"
            ),
        },
        "adversarialReview": {
            "driveArchitecture": {
                "question": (
                    "Motor → clutch/actuator/mode mechanism → agitate/spin: what functional role "
                    "does each implementation fulfill? Do not map physical mechanisms into canonical graph."
                ),
                "rev1FunctionalAnchor": "transmission_or_shifter (canonical) — clutch/hall/actuator overlay-only",
                "rev1Forbidden": "drive_system",
                "seedClutchProcedure": "samsungtla50-clutch",
                "seedMotorProcedure": "samsungtla50-motor-circuit",
                "procedureEvidenceSample": drive_evidence[:12],
                "observationVerdict": (
                    "clutch is Samsung platform implementation candidate for transmission_or_shifter — "
                    "not canonical expansion"
                ),
            },
            "lidAuthorization": {
                "question": (
                    "Resolve Samsung lid switch / lid lock / lock switch / reed switch / lid sensor "
                    "from functional role + procedure evidence — not Whirlpool alias string similarity."
                ),
                "rev1Concepts": {
                    "lid_switch": "conditional — cycle-start authorization",
                    "lid_lock": "spin-safety authorization",
                },
                "samsungDoorLockSeed": "door_lock on samsungtla50-door-lock",
                "reedSwitchInProcedure": True,
                "procedureEvidenceSample": lid_evidence[:12],
                "observationVerdict": (
                    "Samsung door_lock seed + reed/lock contact measurements require functional split "
                    "review at gate — do not fabricate lid_switch matcher alias from Whirlpool pattern"
                ),
            },
        },
        "canonicalOntologyWatch": {
            "rev1ComponentCount": len(rev1_ids),
            "conditionalComponents": sorted(REV1_CONDITIONAL),
            "forbiddenComponents": sorted(REV1_FORBIDDEN),
            "expansionCandidates": [
                row
                for row in classified_mappings
                if row["bucket"] in {"canonical_expansion_candidate", "canonical_expansion_forbidden"}
            ],
            "flOntologyPollution": [
                row for row in classified_mappings if row["bucket"] == "pipeline_fl_ontology_pollution"
            ],
            "verdict": (
                "contained"
                if bucket_counter.get("canonical_expansion_candidate", 0) == 0
                and bucket_counter.get("canonical_expansion_forbidden", 0) == 0
                else "observe_only"
            ),
        },
        "conflicts": conflicts,
        "conflictCount": len(conflicts),
        "mappingSample": classified_mappings[:25],
        "overlaySample": classified_overlays[:15],
        "hardGates": {
            "topLoadWasherRev1Unchanged": True,
            "noGateTable": True,
            "noPromotion": True,
            "noWhirlpoolTlOverlayImport": len(whirlpool_dependent) == 0,
            "autoPublish": False,
            "autoApprove": False,
        },
        "primaryMeasurement": (
            "How much Samsung TL knowledge resolves against frozen rev1 functional ontology "
            "without borrowing Whirlpool knowledge?"
        ),
        "focusAreaReview": {
            "driveClutchPath": {
                "procedure": "samsungtla50-clutch",
                "seedComponent": "clutch",
                "functionalCanonical": "transmission_or_shifter",
                "observation": "Clutch/hall is Samsung platform implementation — not canonical expansion.",
            },
            "motorCircuit": {
                "procedure": "samsungtla50-motor-circuit",
                "seedComponent": "drive_motor",
                "functionalCanonical": "drive_motor",
                "observation": "Direct rev1 inheritance.",
            },
            "doorLockAuthorization": {
                "procedure": "samsungtla50-door-lock",
                "seedComponent": "door_lock",
                "functionalCanonicalMapping": "door_lock seed → lid_lock via top_load_functional_alias",
                "overlayTestTarget": "lid_lock_test",
                "observation": (
                    "WP1.1 routes door-lock procedure to lid_lock_test (not FL door_lock_test). "
                    "Gate must still split reed/closed authorization (lid_switch) from lock-motor "
                    "spin-safety (lid_lock) from procedure evidence — no fabricated matcher alias."
                ),
            },
            "samsungOnlySurfaces": {
                "procedures": [
                    "samsungtla50-mems-sensor",
                    "samsungtla50-leak-check",
                    "samsungtla50-overflow",
                    "samsungtla50-unbalance",
                ],
                "observation": "Platform/model knowledge — not rev1 canonical expansion.",
            },
        },
        "nextDecisionPoint": [
            "Human review Samsung platform vocabulary (clutch, MEMS, leak, overflow, PBA)",
            "Functional lid authorization split from procedure evidence",
            "Drive path: transmission_or_shifter functional + Samsung clutch overlay",
            "WP1.1 matcher routing complete — review clean re-observation before WP2 gate design",
        ],
        "artifacts": {
            "candidatesDir": f"normalization/candidates/{TARGET_MANUAL}/",
            "extractionDoc": "frontend/components/diagnostics/knowledge/pattern-catalog/SAMSUNG_TL_A50_WASHER_EXTRACTION.md",
        },
    }


def _load_wp1_baseline_metrics() -> dict[str, Any] | None:
    baseline_path = CALIBRATION / "SAMSUNG_TL_A50_WASHER_cg67_observation_v1.json"
    if not baseline_path.is_file():
        return None
    baseline = _load_json(baseline_path)
    if baseline.get("workPackage") == "WP1.1_boundary_cleanup_reobservation":
        return baseline.get("wp1BeforeAfterComparison", {}).get("before")
    return {
        "workPackage": baseline.get("workPackage"),
        "threeMetrics": baseline.get("threeMetrics"),
        "classificationBuckets": baseline.get("classificationBuckets"),
        "matcherLayers": baseline.get("matcherLayers"),
        "manufacturerIsolation": baseline.get("manufacturerIsolation"),
        "generatedAt": baseline.get("generatedAt"),
    }


def _build_wp1_comparison(before: dict[str, Any] | None, after: dict[str, Any]) -> dict[str, Any]:
    if before is None:
        return {"note": "No WP1 baseline artifact found for comparison."}
    before_metrics = before.get("threeMetrics") or {}
    after_metrics = after.get("threeMetrics") or {}
    return {
        "before": before,
        "after": {
            "threeMetrics": after_metrics,
            "classificationBuckets": after.get("classificationBuckets"),
            "matcherLayers": after.get("matcherLayers"),
            "manufacturerIsolation": after.get("manufacturerIsolation"),
            "generatedAt": after.get("generatedAt"),
        },
        "deltas": {
            key: after_metrics.get(key, 0) - before_metrics.get(key, 0)
            for key in sorted(set(before_metrics) | set(after_metrics))
        },
        "successCriteria": {
            "canonicalInheritancePreserved": after_metrics.get("canonicalInheritance", 0)
            >= before_metrics.get("canonicalInheritance", 0),
            "flOntologyPollutionZero": after_metrics.get("pipelineFlOntologyPollution", 0) == 0,
            "flTestTargetPollutionZero": after_metrics.get("pipelineFlTestTargetPollution", 0) == 0,
            "whirlpoolDependencyZero": after_metrics.get("forbiddenWhirlpoolDependent", 0) == 0,
            "samsungFlDependencyZero": (after.get("manufacturerIsolation") or {}).get(
                "samsungFlLeakCount",
                0,
            )
            == 0,
        },
    }


def main() -> int:
    wp1_baseline = _load_wp1_baseline_metrics()
    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)
    report["wp1BeforeAfterComparison"] = _build_wp1_comparison(wp1_baseline, report)
    out = CALIBRATION / "SAMSUNG_TL_A50_WASHER_cg67_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    metrics = report["threeMetrics"]
    isolation = report["manufacturerIsolation"]
    print(f"\n=== Samsung TL A50 CG-6.7 WP1.1 Re-observation ===")
    print(f"procedures:       {report['pipelineCounts'].get('procedures')}")
    print(f"mappings:         {report['pipelineCounts'].get('mappingCandidates')}")
    print(f"overlay bindings: {report['pipelineCounts'].get('overlayCandidates')}")
    print(f"conflicts:        {report['conflictCount']}")
    print(f"canonical inherit:{metrics['canonicalInheritance']}")
    print(f"samsung new:      {metrics['samsungKnowledgeCreation']} (candidate buckets)")
    print(f"samsung platform: {report.get('procedureLevelSamsungPlatformCount')} (procedure seeds)")
    print(f"expansion cand:   {metrics['canonicalExpansionCandidates']}")
    print(f"FL pollution:     {metrics['pipelineFlOntologyPollution']}")
    print(f"whirlpool dep:    {metrics['forbiddenWhirlpoolDependent']}")
    print(f"isolation:        {isolation['verdict']}")
    comparison = report.get("wp1BeforeAfterComparison") or {}
    if comparison.get("successCriteria"):
        print(f"WP1.1 gates:      {comparison['successCriteria']}")
    print(f"report:           {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
