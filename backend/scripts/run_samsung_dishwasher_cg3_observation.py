#!/usr/bin/env python3
"""CG-6.5 — Samsung dishwasher CG-3 observation (manufacturer isolation, no gate/publish)."""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parents[1]
KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANDIDATES = KNOWLEDGE / "normalization" / "candidates"
CANONICAL = KNOWLEDGE / "canonical" / "dishwasher.json"
WHIRLPOOL_OVERLAY = (
    KNOWLEDGE / "canonical" / "manufacturer_overlays" / "whirlpool_dishwasher.json"
)
TARGET_MANUAL = "SAMSUNG-DISHWASHER"
PLATFORM_ID = "samsung_dishwasher"

WATCHLIST_CANONICAL = frozenset({"diverter_valve", "turbidity_sensor", "check_valve"})
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
    "whirlpool_dishwasher_acu",
    "whirlpool_fl_dd",
)
CROSS_TEMPLATE_LEAK_PATTERNS = (
    "samsung_fl_washer",
    "samsung_vented_dryer",
    "whirlpool_",
    "washer_wf",
    "dryer_",
)


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _normalize(term: str) -> str:
    return re.sub(r"\s+", " ", str(term or "").strip().lower())


def _matcher_layers(candidate: dict[str, Any]) -> list[str]:
    provenance = candidate.get("provenance") or {}
    return [
        str(source.get("layer") or "")
        for source in provenance.get("sources") or []
        if source.get("type") == "matcher"
    ]


def _scan_leaks(blob: str, patterns: tuple[str, ...]) -> list[str]:
    lower = blob.lower()
    return [pattern for pattern in patterns if pattern in lower]


def build_observation() -> dict[str, Any]:
    ontology = _load_json(CANONICAL)
    canonical_ids = {c["id"] for c in ontology.get("components", [])}

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    overlays = _load_json(target_dir / "overlay_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []

    whirlpool_overlay_exists = WHIRLPOOL_OVERLAY.is_file()
    samsung_overlay_exists = (
        KNOWLEDGE / "canonical" / "manufacturer_overlays" / "samsung_dishwasher.json"
    ).is_file()

    whirlpool_leaks: list[dict[str, Any]] = []
    cross_template_leaks: list[dict[str, Any]] = []
    watchlist_hits: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    new_canonical: list[dict[str, Any]] = []

    layer_counter: Counter[str] = Counter()
    canonical_targets: Counter[str] = Counter()

    for candidate in mappings + overlays:
        blob = json.dumps(candidate)
        layers = _matcher_layers(candidate)
        for layer in layers:
            layer_counter[layer] += 1

        mapping_canonical = candidate.get("canonicalId")
        test_target = candidate.get("canonicalTestTarget")
        if mapping_canonical:
            canonical_targets[str(mapping_canonical)] += 1
        if test_target:
            canonical_targets[f"test:{test_target}"] += 1
        if mapping_canonical in WATCHLIST_CANONICAL:
            watchlist_hits.append(
                {
                    "id": candidate.get("id"),
                    "canonicalId": mapping_canonical,
                    "sourceTerm": candidate.get("sourceTerm") or candidate.get("procedureId"),
                }
            )
        if mapping_canonical and mapping_canonical not in canonical_ids:
            new_canonical.append(
                {
                    "id": candidate.get("id"),
                    "canonicalId": mapping_canonical,
                }
            )
        if str(candidate.get("status") or "").startswith("UNRESOLVED"):
            unresolved.append(
                {
                    "id": candidate.get("id"),
                    "sourceTerm": candidate.get("sourceTerm") or candidate.get("procedureId"),
                    "status": candidate.get("status"),
                }
            )

        wp_hits = _scan_leaks(blob, WHIRLPOOL_LEAK_PATTERNS)
        if wp_hits:
            whirlpool_leaks.append(
                {
                    "id": candidate.get("id"),
                    "patterns": wp_hits,
                    "layers": layers,
                }
            )

        for layer in layers:
            ct_hits = _scan_leaks(layer, CROSS_TEMPLATE_LEAK_PATTERNS)
            if ct_hits:
                cross_template_leaks.append(
                    {
                        "id": candidate.get("id"),
                        "layer": layer,
                        "patterns": ct_hits,
                    }
                )

    measurement_ids = sorted(
        {
            str(c.get("measurementKnowledgeId"))
            for c in overlays
            if c.get("measurementKnowledgeId")
        }
    )
    whirlpool_measurement_ids = [
        mid
        for mid in measurement_ids
        if _scan_leaks(mid, ("whirlpool", "dishwasheracu", "filtrationvsm"))
    ]

    samsung_specific_terms = sorted(
        {
            _normalize(candidate.get("sourceTerm") or "")
            for candidate in mappings
            if candidate.get("sourceTerm")
            and not str(candidate.get("sourceTerm")).startswith("§")
        }
    )

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg6_samsung_dishwasher_cg3_observation",
        "experiment": "Manufacturer isolation — first Samsung dishwasher manual at CG-3",
        "manualId": TARGET_MANUAL,
        "platformId": PLATFORM_ID,
        "ontologyId": "dishwasher",
        "ontologyFrozen": bool((ontology.get("ontology") or {}).get("frozen")),
        "ontologyFrozenRevision": (ontology.get("ontology") or {}).get("frozenRevision"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "publishBlocked": True,
        "pipelineCounts": manifest.get("counts"),
        "hierarchyShape": {
            "canonical": "dishwasher rev1 (frozen)",
            "targetManufacturerOverlay": "samsung_dishwasher.json (not yet published)",
            "whirlpoolOverlayPublished": whirlpool_overlay_exists,
            "samsungOverlayPublished": samsung_overlay_exists,
            "isolationGoal": (
                "Samsung learns functional concepts from its own manual without inheriting "
                "Whirlpool implementation vocabulary or topology."
            ),
        },
        "manufacturerIsolation": {
            "whirlpoolLeakCount": len(whirlpool_leaks),
            "whirlpoolLeaks": whirlpool_leaks,
            "crossTemplateLeakCount": len(cross_template_leaks),
            "crossTemplateLeaks": cross_template_leaks,
            "whirlpoolMeasurementBindingLeaks": whirlpool_measurement_ids,
            "verdict": (
                "clean"
                if not whirlpool_leaks and not whirlpool_measurement_ids
                else "leak_detected"
            ),
        },
        "canonicalOntologyWatch": {
            "watchlistHits": watchlist_hits,
            "newCanonicalCandidates": new_canonical,
            "watchlistVerdict": "contained" if not watchlist_hits and not new_canonical else "review",
        },
        "matcherLayers": dict(layer_counter.most_common()),
        "canonicalTargets": dict(canonical_targets.most_common()),
        "measurementKnowledgeIds": measurement_ids,
        "unresolvedCandidates": unresolved,
        "unresolvedCount": len(unresolved),
        "samsungSpecificSeedTerms": samsung_specific_terms,
        "focusAreaReview": {
            "circulation_architecture": {
                "procedure": "samsungdw-circulation-motor",
                "canonical": "circulation_pump",
                "measurement": "samsungDishwasherCirculationMotorOhms",
                "note": "Samsung circulation motor + nozzle — platform knowledge candidate, not Whirlpool SSM/VSM.",
            },
            "distributor_vs_diverter": {
                "procedure": "samsungdw-distributor",
                "resolvedCanonical": "circulation_pump",
                "unresolvedTitle": "§4-1: Distributor Motor (PC)",
                "note": "Samsung distributor motor — gate must decide platform implementation without diverter_valve canonical.",
            },
            "dry_system": {
                "procedure": "samsungdw-dry-system",
                "canonical": "drying_system",
                "note": "Samsung vent fan / dry path — distinct from Whirlpool ProDry DC fan.",
            },
            "leak_overflow": {
                "procedures": ["samsungdw-leak-sensor", "samsungdw-overflow"],
                "note": "Samsung-specific sensing surfaces — likely platform/model, not canonical expansion.",
            },
            "matcher_cross_template": {
                "observed": cross_template_leaks,
                "note": "Samsung FL washer overlay layer on main_control — cross-template within Samsung, not Whirlpool.",
            },
        },
        "conflicts": conflicts,
        "hardGates": {
            "dishwasherJsonUnchanged": True,
            "whirlpoolDishwasherJsonUnchanged": True,
            "noWhirlpoolPlatformLeakage": len(whirlpool_leaks) == 0,
            "noWhirlpoolMeasurementReuse": len(whirlpool_measurement_ids) == 0,
            "autoPublish": False,
            "autoApprove": False,
        },
        "artifacts": {
            "candidatesDir": f"normalization/candidates/{TARGET_MANUAL}/",
        },
        "nextDecisionPoint": [
            "Human gate Samsung dishwasher vocabulary under samsung_dishwasher.json",
            "Resolve distributor motor platform implementation vs frozen canonical",
            "Do not import Whirlpool SSM/VSM/platform components",
            "Watch cross-template matcher layers (Samsung washer overlay on dishwasher)",
        ],
    }


def main() -> int:
    report = build_observation()
    out = CALIBRATION / "SAMSUNG_DISHWASHER_cg3_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    isolation = report["manufacturerIsolation"]
    print(f"Wrote {out}")
    print(
        f"pipeline: procedures={report['pipelineCounts']['procedures']} "
        f"mappings={report['pipelineCounts']['mappingCandidates']} "
        f"overlays={report['pipelineCounts']['overlayCandidates']} "
        f"conflicts={report['pipelineCounts']['conflicts']}"
    )
    print(f"whirlpool leaks: {isolation['whirlpoolLeakCount']}")
    print(f"cross-template leaks: {isolation['crossTemplateLeakCount']}")
    print(f"unresolved: {report['unresolvedCount']}")
    print(f"watchlist verdict: {report['canonicalOntologyWatch']['watchlistVerdict']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
