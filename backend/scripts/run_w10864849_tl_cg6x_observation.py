#!/usr/bin/env python3
"""CG-6.x — W10864849 fresh CG-3 observation vs TL candidate graph (no gate/publish)."""

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
CANONICAL_LEGACY = KNOWLEDGE / "canonical" / "top_load_washer.json"
CANONICAL_CANDIDATE = CALIBRATION / "top_load_washer_cg6x_candidate_v1.json"
WHIRLPOOL_OVERLAY = (
    KNOWLEDGE / "canonical" / "manufacturer_overlays" / "whirlpool_top_load_washer.json"
)
TARGET_MANUAL = "W10864849"
PLATFORM_ID = "whirlpool_tl_dd"

# Legacy canonical id → CG-6.x candidate id (functional rename / split)
LEGACY_TO_CANDIDATE = {
    "supply": "power_supply",
    "mode_shifter": "transmission_or_shifter",
    "wash_ntc": "temperature_sensor",
    "pressure_sensor": "water_level_sensor",
    "suspension": "suspension_system",
}

# W10864849 seed/platform terms expected to remain overlay-only
OVERLAY_ONLY_EXPECTED = frozenset(
    {
        "mode_shifter",
        "pressure_sensor",
        "recirc_pump",
        "wash_heater",
        "wash_ntc",
        "bulk_level_switch",
        "motor_controller",
        "drum_bearing",
        "dosing_pump",
        "pressure_hose",
        "pressure_chamber",
    }
)

CANDIDATE_ONLY = frozenset(
    {
        "lid_switch",
        "drain_path",
        "drive_system",
        "agitator_or_impeller",
        "spin_system",
        "tub",
        "basket",
    }
)


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _component_ids(ontology: dict) -> set[str]:
    return {c["id"] for c in ontology.get("components", [])}


def _normalize(term: str) -> str:
    return re.sub(r"\s+", " ", str(term or "").strip().lower())


def _run_fresh_cg3() -> dict[str, Any]:
    import sys

    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization

    manifest = load_manifest()
    entry = find_manual_entry(manifest, TARGET_MANUAL)
    print(f"==> CG-3 normalize {TARGET_MANUAL} (fresh)")
    return run_manual_normalization(entry)


def _classify_target(
    canonical_id: str | None,
    *,
    legacy_ids: set[str],
    candidate_ids: set[str],
) -> dict[str, Any]:
    if not canonical_id:
        return {"bucket": "unresolved", "legacy": False, "candidate": False}

    in_legacy = canonical_id in legacy_ids
    mapped = LEGACY_TO_CANDIDATE.get(canonical_id, canonical_id)
    in_candidate = mapped in candidate_ids
    overlay_only = canonical_id in OVERLAY_ONLY_EXPECTED

    if in_legacy and in_candidate:
        bucket = "both_graphs"
    elif in_legacy and not in_candidate and overlay_only:
        bucket = "legacy_and_overlay_expected"
    elif in_legacy and not in_candidate:
        bucket = "legacy_only_gap_in_candidate"
    elif not in_legacy and in_candidate:
        bucket = "candidate_only"
    else:
        bucket = "neither_graph"

    return {
        "bucket": bucket,
        "legacy": in_legacy,
        "candidate": in_candidate,
        "candidateMappedId": mapped if mapped != canonical_id else None,
        "overlayOnlyExpected": overlay_only,
    }


def _overlay_platform_components(overlay: dict) -> set[str]:
    family = next(
        (
            f
            for f in overlay.get("platformFamilies") or []
            if f.get("platformFamilyId") == "whirlpool_tl_dd_direct_drive"
        ),
        {},
    )
    return {c.get("id") for c in (family.get("add") or {}).get("components") or [] if c.get("id")}


def _overlay_aliases(overlay: dict) -> dict[str, str]:
    family = next(
        (
            f
            for f in overlay.get("platformFamilies") or []
            if f.get("platformFamilyId") == "whirlpool_tl_dd_direct_drive"
        ),
        {},
    )
    return dict(family.get("oemTermAliases") or {})


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    legacy = _load_json(CANONICAL_LEGACY)
    candidate = _load_json(CANONICAL_CANDIDATE)
    overlay = _load_json(WHIRLPOOL_OVERLAY)

    legacy_ids = _component_ids(legacy)
    candidate_ids = _component_ids(candidate)

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    overlays = _load_json(target_dir / "overlay_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []

    bucket_counter: Counter[str] = Counter()
    canonical_targets: Counter[str] = Counter()
    mapping_rows: list[dict[str, Any]] = []

    for row in mappings:
        cid = row.get("canonicalId")
        if cid:
            canonical_targets[str(cid)] += 1
        classification = _classify_target(cid, legacy_ids=legacy_ids, candidate_ids=candidate_ids)
        bucket_counter[classification["bucket"]] += 1
        mapping_rows.append(
            {
                "id": row.get("id"),
                "sourceTerm": row.get("sourceTerm"),
                "canonicalId": cid,
                "procedureId": (row.get("provenance") or {}).get("procedureId"),
                "classification": classification,
            }
        )

    overlay_test_targets: Counter[str] = Counter()
    for row in overlays:
        target = row.get("canonicalTestTarget")
        if target:
            overlay_test_targets[str(target)] += 1

    published_aliases = _overlay_aliases(overlay)
    platform_components = _overlay_platform_components(overlay)

    # Open-question evidence
    lid_terms = [
        r for r in mapping_rows if r.get("canonicalId") in {"lid_lock", "door_lock"}
    ]
    shifter_terms = [
        r for r in mapping_rows if r.get("canonicalId") == "mode_shifter"
        or "shifter" in _normalize(r.get("sourceTerm") or "")
    ]
    drive_terms = [
        r for r in mapping_rows if r.get("canonicalId") == "drive_motor"
        or "drive system" in _normalize(r.get("sourceTerm") or "")
    ]

    open_questions = {
        "transmission_or_shifter_canonical": {
            "verdict": "candidate_supported_with_overlay_implementation",
            "evidence": (
                f"W10864849 maps {len(shifter_terms)} shifter-related terms to mode_shifter "
                "(legacy) / transmission_or_shifter (candidate). Platform overlay teaches "
                "splutch/clutch implementation — not canonical."
            ),
            "w10864849ShifterMappings": len(shifter_terms),
            "overlayUsesModeShifter": "mode_shifter" in platform_components
            or "mode_shifter" in published_aliases.values(),
        },
        "lid_switch_vs_lid_lock": {
            "verdict": "split_supported_candidate_not_observed_in_w10864849",
            "evidence": (
                f"W10864849 maps {len(lid_terms)} terms to lid_lock only (door_lock seed). "
                "No separate lid_switch mapping in first manual — split remains candidate "
                "hypothesis for multi-platform evidence, not contradicted."
            ),
            "w10864849LidLockMappings": len(lid_terms),
            "candidateHasLidSwitch": "lid_switch" in candidate_ids,
        },
        "drive_system_abstraction": {
            "verdict": "scrutinize_hardest_abstraction",
            "evidence": (
                f"W10864849 has {len(drive_terms)} drive-system-related mappings targeting "
                "drive_motor at canonical layer. Candidate drive_system node has no direct "
                "matcher hits — functional aggregate may be overlay/orchestration only."
            ),
            "w10864849DriveMappings": len(drive_terms),
            "candidateDriveSystemDirectHits": 0,
            "recommendation": (
                "Keep drive_system as candidate-only until a second TL manual requires it "
                "at canonical layer; procedure orchestration may suffice."
            ),
        },
    }

    legacy_only_gaps = sorted(
        {
            row["canonicalId"]
            for row in mapping_rows
            if row["classification"]["bucket"] == "legacy_only_gap_in_candidate"
        }
    )
    overlay_expected_hits = sorted(
        {
            row["canonicalId"]
            for row in mapping_rows
            if row["classification"]["bucket"] == "legacy_and_overlay_expected"
        }
    )

    architecture_comparison = {
        "publishedOverlayFamily": "whirlpool_tl_dd_direct_drive",
        "oemAliasCount": len(published_aliases),
        "platformComponentCount": len(platform_components),
        "procedureBindingCount": len(
            [
                b
                for b in (
                    next(
                        (
                            f
                            for f in overlay.get("platformFamilies") or []
                            if f.get("platformFamilyId") == "whirlpool_tl_dd_direct_drive"
                        ),
                        {},
                    ).get("procedureBindings")
                    or []
                )
                if str(b.get("procedureId", "")).startswith("w10864849-")
            ]
        ),
        "keyOverlayOnlyConcepts": sorted(OVERLAY_ONLY_EXPECTED & legacy_ids),
        "candidateConceptsNotInLegacy": sorted(CANDIDATE_ONLY),
    }

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg6x_tl_washer_cg3_observation",
        "experiment": (
            "First Whirlpool TL manual — fresh CG-3 vs CG-6.x candidate graph "
            "(no dishwasher assumptions carried forward)"
        ),
        "manualId": TARGET_MANUAL,
        "platformId": PLATFORM_ID,
        "ontologyId": "top_load_washer",
        "ontologyFrozen": False,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "fresh_cg3_observation",
        "publishBlocked": True,
        "priorPhaseLocked": "CG65_DISHWASHER_FAMILY_LOCK_v1.json",
        "graphArtifacts": {
            "legacyCanonical": str(CANONICAL_LEGACY.relative_to(ROOT)),
            "cg6xCandidate": str(CANONICAL_CANDIDATE.relative_to(ROOT)),
            "publishedOverlay": str(WHIRLPOOL_OVERLAY.relative_to(ROOT)),
        },
        "pipelineCounts": manifest.get("counts") or {},
        "normalizeRun": {
            "manualId": normalize_result.get("manualId"),
            "generatedAt": normalize_result.get("generatedAt"),
        },
        "conflicts": len(conflicts),
        "classificationSummary": {
            "mappingBuckets": dict(bucket_counter),
            "uniqueCanonicalTargets": len(canonical_targets),
            "overlayTestTargets": dict(overlay_test_targets),
        },
        "canonicalTargetHistogram": dict(canonical_targets.most_common()),
        "legacyOnlyGapsInCandidate": legacy_only_gaps,
        "overlayExpectedInLegacy": overlay_expected_hits,
        "openQuestions": open_questions,
        "architectureComparison": architecture_comparison,
        "candidateVsLegacy": {
            "legacyComponentCount": len(legacy_ids),
            "candidateComponentCount": len(candidate_ids),
            "sharedAfterMapping": len(
                {
                    LEGACY_TO_CANDIDATE.get(cid, cid)
                    for cid in legacy_ids
                    if LEGACY_TO_CANDIDATE.get(cid, cid) in candidate_ids or cid in candidate_ids
                }
            ),
            "legacyToCandidateRenames": LEGACY_TO_CANDIDATE,
        },
        "recommendation": {
            "freezeCandidateNow": False,
            "rationale": (
                "W10864849 CG-3 supports functional TL candidate direction but exposes "
                "legacy-only platform concepts (pressure_sensor, recirc_pump, wash_heater, "
                "bulk_level_switch) that belong in overlay. Run W11697231 / W11416787 CG-3 "
                "before freezing rev1. Do not fix Samsung dishwasher matcher defects here."
            ),
            "nextManuals": ["W11697231", "W11416787"],
        },
        "mappingSample": mapping_rows[:20],
        "compoundingNote": (
            "W10864849 overlay already published under legacy top_load_washer.json. "
            "This observation informs candidate freeze — it does not republish overlay."
        ),
    }


def main() -> int:
    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)
    out = CALIBRATION / "W10864849_tl_cg6x_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    buckets = report["classificationSummary"]["mappingBuckets"]
    print(f"\n=== W10864849 TL CG-6.x Observation ===")
    print(f"procedures:       {report['pipelineCounts'].get('procedures')}")
    print(f"mappings:         {report['pipelineCounts'].get('mappingCandidates')}")
    print(f"overlay bindings: {report['pipelineCounts'].get('overlayCandidates')}")
    print(f"conflicts:        {report['conflicts']}")
    print(f"mapping buckets:  {buckets}")
    print(f"legacy-only gaps: {report['legacyOnlyGapsInCandidate']}")
    print(f"freeze now?       {report['recommendation']['freezeCandidateNow']}")
    print(f"report:           {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
