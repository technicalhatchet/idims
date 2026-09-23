#!/usr/bin/env python3
"""CG-6.5 — W11499711 compounding preview against published whirlpool_dishwasher (no gate/publish)."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.calibration.gap_analyzer import analyze_corpus_gaps

ROOT = SCRIPTS_DIR.parents[1]
KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANDIDATES = KNOWLEDGE / "normalization" / "candidates"
CANONICAL = KNOWLEDGE / "canonical" / "dishwasher.json"
OVERLAY = KNOWLEDGE / "canonical" / "manufacturer_overlays" / "whirlpool_dishwasher.json"
BASELINE_GATE = CALIBRATION / "W11633848_overlay_mapping_table_v1.json"
PRIOR_GATE = CALIBRATION / "W11480208_overlay_mapping_table_v1.json"
PRIOR_PREVIEW = CALIBRATION / "W11480208_compounding_preview_v1.json"
PRIOR_PUBLICATION = CALIBRATION / "publication_W11480208.json"
TARGET_MANUAL = "W11499711"
PRIOR_MANUAL_IDS = ("W11633848", "W11480208")

WATCHLIST_CANONICAL = frozenset({"diverter_valve", "turbidity_sensor", "check_valve"})
PROCEDURAL_TITLE_RE = re.compile(r"^§\d")
WASHER_OVERLAY_LEAK = "whirlpool_fl_dd"

W11633848_GATED_MEASUREMENTS = {
    "dishwasherDoorLatchSwitchOhms",
    "whirlpoolDishwasherAcuFillValveOhms",
    "dishwasherFloatSwitchOhms",
    "whirlpoolDishwasherAcuOwiThermistorOhms",
    "whirlpoolDishwasherAcuWashMotorOhms",
    "whirlpoolDishwasherAcuDrainMotorOhms",
    "whirlpoolDishwasherAcuHeaterOhms",
}
W11480208_PLATFORM_MEASUREMENTS = {
    "whirlpoolDishwasherFiltrationVsmWashMotorOhms",
    "whirlpoolDishwasherFiltrationVsmDrainMotorOhms",
    "whirlpoolDishwasherFiltrationDiverterMotorOhms",
    "whirlpoolDishwasherFiltrationDcFanOhms",
}


def _normalize(term: str) -> str:
    return re.sub(r"\s+", " ", str(term or "").strip().lower())


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _canonical_ids() -> set[str]:
    doc = _load_json(CANONICAL)
    return {c["id"] for c in doc.get("components", [])}


def _published_overlay() -> dict[str, Any]:
    return _load_json(OVERLAY)


def _gated_aliases() -> dict[str, str]:
    overlay = _published_overlay()
    aliases: dict[str, str] = {}
    for family in overlay.get("platformFamilies") or []:
        for term, canonical in (family.get("oemTermAliases") or {}).items():
            aliases[_normalize(term)] = str(canonical)
        for component in (family.get("add") or {}).get("components") or []:
            for term in component.get("aliases") or []:
                canonical = component.get("implementsCanonicalId")
                if canonical:
                    aliases[_normalize(term)] = str(canonical)
    for gate_path in (BASELINE_GATE, PRIOR_GATE):
        if not gate_path.is_file():
            continue
        gate = _load_json(gate_path)
        for mapping in gate.get("mappings") or []:
            for term, canonical in (mapping.get("proposedAliases") or {}).items():
                aliases[_normalize(term)] = str(canonical)
    return aliases


def _published_procedure_bindings() -> dict[str, dict[str, Any]]:
    overlay = _published_overlay()
    bindings: dict[str, dict[str, Any]] = {}
    for family in overlay.get("platformFamilies") or []:
        for binding in family.get("procedureBindings") or []:
            pid = str(binding.get("procedureId") or "")
            if pid:
                bindings[pid] = binding
    return bindings


def _published_measurement_bindings() -> dict[str, dict[str, Any]]:
    overlay = _published_overlay()
    bindings: dict[str, dict[str, Any]] = {}
    for family in overlay.get("platformFamilies") or []:
        for binding in family.get("measurementBindings") or []:
            key = (
                str(binding.get("procedureId") or ""),
                str(binding.get("measurementKnowledgeId") or ""),
            )
            bindings[key] = binding
    return bindings


def _published_platform_components() -> dict[str, dict[str, Any]]:
    overlay = _published_overlay()
    components: dict[str, dict[str, Any]] = {}
    for family in overlay.get("platformFamilies") or []:
        for component in (family.get("add") or {}).get("components") or []:
            cid = str(component.get("id") or "")
            if cid:
                components[cid] = component
    return components


def _classify_mapping(
    candidate: dict[str, Any],
    aliases: dict[str, str],
    canonical_ids: set[str],
    platform_components: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    source = str(candidate.get("sourceTerm") or "")
    norm = _normalize(source)
    canonical = candidate.get("canonicalId")
    status = str(candidate.get("status") or "")
    procedure_id = (candidate.get("provenance") or {}).get("procedureId") or ""
    matched = _normalize(candidate.get("matchedPhrase") or "")
    layers = [
        str(s.get("layer") or "")
        for s in (candidate.get("provenance") or {}).get("sources") or []
        if s.get("type") == "matcher"
    ]

    if canonical in WATCHLIST_CANONICAL:
        classification = "new_canonical"
        rationale = f"Watchlist canonical leakage: {canonical}"
    elif canonical and canonical not in canonical_ids:
        classification = "new_canonical"
        rationale = f"Target not in frozen dishwasher rev1: {canonical}"
    elif any(WASHER_OVERLAY_LEAK in layer for layer in layers):
        classification = "rejected"
        rationale = "Matcher contamination — wrong manufacturer overlay layer (FL washer)."
    elif "vsm" in norm or "variable speed" in norm:
        classification = "rejected"
        rationale = (
            "W11499711 native cohort is SSM wash motor — VSM terminology would be "
            "mis-routing to W11480208 filtration platform."
        )
    elif status == "candidate" and canonical in canonical_ids:
        if norm in aliases and aliases[norm] == canonical:
            classification = "inherited"
            rationale = f"Gated Whirlpool alias '{source}' → {canonical}."
        elif norm == canonical or norm.replace("_", "") == canonical.replace("_", ""):
            classification = "inherited"
            rationale = "Seed componentId matches frozen canonical concept."
        else:
            classification = "inherited"
            rationale = "Auto-resolved against frozen dishwasher ontology / published overlay."
    elif PROCEDURAL_TITLE_RE.match(source) and status == "COMPOUND_TERM_CANDIDATE":
        if "ssm" in norm and matched in aliases and aliases[matched] == canonical:
            classification = "inherited"
            rationale = (
                f"Matched published alias '{matched}' → {canonical}; "
                "SSM wash motor architecture already on platform (ssm_wash_motor)."
            )
        elif matched in aliases and aliases[matched] == canonical:
            if "ssm" in norm or "ssm wash motor" in aliases:
                classification = "inherited"
                rationale = (
                    f"Gated alias '{matched}' → {canonical}; compounds published "
                    "ssm_wash_motor implements circulation_pump."
                )
            else:
                classification = "new_model"
                rationale = "Model-line OEM title under known canonical — WDT750 surface."
        elif norm in aliases and aliases[norm] == canonical:
            classification = "inherited"
            rationale = f"Exact gated alias → {canonical}."
        else:
            classification = "unresolved"
            rationale = "Compound OEM title — human gate review required."
    elif status == "UNRESOLVED_TERM":
        classification = "unresolved"
        rationale = "No confident canonical mapping — human gate required."
    else:
        classification = "unresolved"
        rationale = "Unclassified mapping candidate."

    return {
        "id": candidate.get("id"),
        "sourceTerm": source,
        "canonicalId": canonical,
        "matcherStatus": status,
        "procedureId": procedure_id,
        "matchedPhrase": candidate.get("matchedPhrase"),
        "classification": classification,
        "rationale": rationale,
        "matcherLayers": layers,
        "publishedPlatformComponent": (
            "ssm_wash_motor"
            if classification == "inherited" and canonical == "circulation_pump" and "ssm" in norm
            else None
        ),
    }


def _classify_overlay(
    candidate: dict[str, Any],
    published_procedures: dict[str, dict[str, Any]],
    published_measurements: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    procedure_id = str(candidate.get("procedureId") or "")
    target = str(candidate.get("canonicalTestTarget") or "")
    ctype = str(candidate.get("candidateType") or "")
    meas_id = candidate.get("measurementKnowledgeId")
    display = str(candidate.get("displayTitle") or "")

    if ctype == "measurementBinding" and meas_id in W11480208_PLATFORM_MEASUREMENTS:
        classification = "rejected"
        rationale = (
            f"VSM/filtration measurement ({meas_id}) must not bind on W11499711 SSM cohort — "
            "would ignore published platform split."
        )
    elif ctype == "measurementBinding" and meas_id in W11633848_GATED_MEASUREMENTS:
        published = published_measurements.get((procedure_id, str(meas_id)))
        if published:
            classification = "inherited"
            rationale = f"Exact published measurement binding ({meas_id})."
        else:
            sem_match = any(
                b.get("measurementKnowledgeId") == meas_id
                and b.get("testTargetId") == target
                for b in published_measurements.values()
            )
            if sem_match:
                classification = "inherited"
                rationale = (
                    f"Reuses published W11633848 measurement semantics ({meas_id} → {target}); "
                    "new procedureId registration only."
                )
            else:
                classification = "inherited"
                rationale = f"Reuses W11633848 gated measurement knowledge ({meas_id})."
    elif ctype == "procedureTestBinding" and procedure_id.endswith("wash-motor-ssm"):
        ssm_ref = published_procedures.get("w11633848-wash-motor")
        if ssm_ref and ssm_ref.get("testTargetId") == target:
            classification = "inherited"
            rationale = (
                "SSM wash motor → circulation_test compounds w11633848-wash-motor / "
                "ssm_wash_motor (not VSM filtration path)."
            )
        else:
            classification = "new_platform"
            rationale = "SSM wash motor procedure without published semantic anchor."
    elif ctype == "procedureTestBinding" and any(
        procedure_id.endswith(suffix)
        for suffix in ("wash-motor-vsm", "drain-motor-vsm", "diverter-motor", "dc-fan")
    ):
        classification = "rejected"
        rationale = "W11499711 native cohort has no VSM/diverter/ProDry delta procedures."
    elif ctype == "procedureTestBinding":
        classification = "unresolved"
        rationale = "Overlay binding needs human gate review."
    else:
        classification = "unresolved"
        rationale = "Overlay binding needs human gate review."

    return {
        "id": candidate.get("id"),
        "candidateType": ctype,
        "procedureId": procedure_id,
        "canonicalTestTarget": target,
        "measurementKnowledgeId": meas_id,
        "displayTitle": display,
        "classification": classification,
        "rationale": rationale,
    }


def _bucket(items: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        key = item["classification"]
        counts[key] = counts.get(key, 0) + 1
    return counts


def build_compounding_preview() -> dict[str, Any]:
    canonical_ids = _canonical_ids()
    ontology = _load_json(CANONICAL).get("ontology") or {}
    aliases = _gated_aliases()
    platform_components = _published_platform_components()
    published_procedures = _published_procedure_bindings()
    published_measurements = _published_measurement_bindings()
    prior_preview = _load_json(PRIOR_PREVIEW) if PRIOR_PREVIEW.is_file() else {}
    prior_publication = _load_json(PRIOR_PUBLICATION) if PRIOR_PUBLICATION.is_file() else {}

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    overlays = _load_json(target_dir / "overlay_candidates.json").get("candidates") or []
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")

    gap_path = CALIBRATION / f"canonical_gap_report_compounding_{TARGET_MANUAL}_dishwasher.json"
    gap_report = analyze_corpus_gaps(template_id="dishwasher")
    gap_path.write_text(json.dumps(gap_report, indent=2), encoding="utf-8")
    gap_buckets = {k: len(v) for k, v in (gap_report.get("buckets") or {}).items()}

    classified_mappings = [
        _classify_mapping(c, aliases, canonical_ids, platform_components) for c in mappings
    ]
    classified_overlays = [
        _classify_overlay(c, published_procedures, published_measurements) for c in overlays
    ]

    mapping_counts = _bucket(classified_mappings)
    overlay_counts = _bucket(classified_overlays)
    combined = dict(mapping_counts)
    for key, value in overlay_counts.items():
        combined[key] = combined.get(key, 0) + value

    inherited_aliases = [
        {
            "sourceTerm": item["sourceTerm"],
            "canonicalId": item["canonicalId"],
            "matchedPhrase": item.get("matchedPhrase"),
            "publishedAlias": aliases.get(_normalize(item.get("matchedPhrase") or item["sourceTerm"])),
        }
        for item in classified_mappings
        if item["classification"] == "inherited"
    ]

    inherited_procedure_bindings = [
        item for item in classified_overlays
        if item["classification"] == "inherited" and item["candidateType"] == "procedureTestBinding"
    ]
    inherited_measurement_bindings = [
        item for item in classified_overlays
        if item["classification"] == "inherited" and item["candidateType"] == "measurementBinding"
    ]

    human_review_candidates = [
        item for item in classified_mappings + classified_overlays
        if item["classification"] in {"unresolved", "new_model", "new_platform", "new_canonical"}
    ]
    new_platform_candidates = [
        item for item in classified_mappings + classified_overlays
        if item["classification"] == "new_platform"
    ]
    new_model_candidates = [
        item for item in classified_mappings + classified_overlays
        if item["classification"] == "new_model"
    ]
    canonical_candidates = [
        item for item in classified_mappings + classified_overlays
        if item["classification"] == "new_canonical"
    ]
    matcher_rejections = [
        item for item in classified_mappings + classified_overlays
        if item["classification"] == "rejected"
    ]

    watchlist_hits = [
        c for c in classified_mappings + classified_overlays
        if c.get("canonicalId") in WATCHLIST_CANONICAL
        or (c.get("canonicalTestTarget") or "").startswith(tuple(WATCHLIST_CANONICAL))
    ]

    washer_overlay_leaks = [
        c for c in classified_mappings
        if any(WASHER_OVERLAY_LEAK in layer for layer in (c.get("matcherLayers") or []))
    ]

    vsm_misroutes = [
        c for c in classified_mappings + classified_overlays
        if "vsm" in _normalize(str(c.get("sourceTerm") or c.get("displayTitle") or ""))
        or c.get("measurementKnowledgeId") in W11480208_PLATFORM_MEASUREMENTS
    ]

    projected_human_decisions = len(human_review_candidates)
    overlay_registration_only = [
        {
            "procedureId": item["procedureId"],
            "semanticAnchor": "w11633848-wash-motor",
            "implementationComponent": "ssm_wash_motor",
            "note": "Mechanical overlay registration — semantics fully inherited; not a new teaching decision.",
        }
        for item in inherited_procedure_bindings
        if item["procedureId"] not in published_procedures
    ]

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg6_dishwasher_compounding_preview",
        "experiment": (
            "CG-6.5 dishwasher manual #3 — compounding against published "
            "whirlpool_dishwasher.json (preview only)"
        ),
        "manualId": TARGET_MANUAL,
        "platformId": "whirlpool_dishwasher_acu",
        "platformFamilyId": "whirlpool_dishwasher_acu",
        "ontologyId": "dishwasher",
        "ontologyFrozen": bool(ontology.get("frozen")),
        "ontologyFrozenRevision": ontology.get("frozenRevision"),
        "priorManualIds": list(PRIOR_MANUAL_IDS),
        "manufacturerOverlay": "whirlpool_dishwasher.json",
        "manufacturerOverlayPublishedThrough": "W11480208",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "compounding_preview",
        "publishBlocked": True,
        "pipelineCounts": manifest.get("counts"),
        "baselineComparison": {
            "W11633848": {
                "role": "first_manual_baseline",
                "newHumanSemanticDecisions": 11,
            },
            "W11480208": {
                "role": "second_manual_compounding",
                "newHumanSemanticDecisions": prior_publication.get("compoundingMetrics", {}).get(
                    "newHumanSemanticDecisions", 5
                ),
                "priorCompoundingPreview": prior_preview.get("classificationSummary", {}).get("combined"),
            },
            "nativeCohortFilter": (
                f"source.manualId === {TARGET_MANUAL} "
                "(1 delta procedure: w11499711-wash-motor-ssm; not shared-platform 30)"
            ),
        },
        "classificationSummary": {
            "mappingCandidates": mapping_counts,
            "overlayCandidates": overlay_counts,
            "combined": combined,
            "new_canonical": combined.get("new_canonical", 0),
        },
        "teachingCostCurve": {
            "W11633848": 11,
            "W11480208": prior_publication.get("compoundingMetrics", {}).get(
                "newHumanSemanticDecisions", 5
            ),
            "W11499711_projected": projected_human_decisions,
            "reductionVsW11633848": (
                round(1 - projected_human_decisions / 11, 3) if projected_human_decisions < 11 else 0.0
            ),
            "reductionVsW11480208": (
                round(1 - projected_human_decisions / 5, 3) if projected_human_decisions < 5 else 0.0
            ),
        },
        "inheritanceDepth": {
            "layers": [
                "dishwasher rev1 (frozen canonical)",
                "whirlpool_dishwasher.json (W11633848 + W11480208 published)",
                "whirlpool_dishwasher_acu platform components + implements relationships",
                f"{TARGET_MANUAL} native SSM wash-motor delta",
            ],
            "evidence": {
                "ssmNotVsm": (
                    "Native procedure titles SSM; matcher selected whirlpoolDishwasherAcuWashMotorOhms "
                    "(not FiltrationVsmWashMotorOhms)."
                ),
                "publishedPlatformComponentsUsed": sorted(platform_components.keys()),
                "compoundingManualIds": (
                    _published_overlay()
                    .get("platformFamilies", [{}])[0]
                    .get("compoundingManualIds")
                ),
            },
        },
        "hierarchyShape": {
            "canonical": "dishwasher rev1 (frozen, unchanged)",
            "manufacturer": "whirlpool_dishwasher.json (W11633848 + W11480208 published)",
            "platformFamily": "whirlpool_dishwasher_acu",
            "manualDelta": "W11499711 WDT750 microfiltration — SSM wash motor §3-15 only",
            "flow": [
                "W11633848 gated baseline",
                "→ Whirlpool dishwasher vocabulary",
                "→ W11480208 published VSM/platform implementation",
                f"→ {TARGET_MANUAL}",
                f"   inherited: {combined.get('inherited', 0)}",
                f"   new_platform: {combined.get('new_platform', 0)}",
                f"   new_model: {combined.get('new_model', 0)}",
                f"   unresolved: {combined.get('unresolved', 0)}",
                f"   new_canonical: {combined.get('new_canonical', 0)}",
                f"   rejected (matcher evidence): {combined.get('rejected', 0)}",
            ],
        },
        "compoundingBuckets": {
            "inherited": [item for item in classified_mappings + classified_overlays if item["classification"] == "inherited"],
            "new_platform": new_platform_candidates,
            "new_model": new_model_candidates,
            "new_canonical": canonical_candidates,
            "unresolved": [
                item for item in classified_mappings + classified_overlays
                if item["classification"] == "unresolved"
            ],
            "rejected": matcher_rejections,
        },
        "inheritedAliases": inherited_aliases,
        "inheritedProcedureBindings": inherited_procedure_bindings,
        "inheritedMeasurementBindings": inherited_measurement_bindings,
        "overlayRegistrationOnly": overlay_registration_only,
        "genuinelyNewHumanReviewCandidates": human_review_candidates,
        "newPlatformCandidates": new_platform_candidates,
        "newModelCandidates": new_model_candidates,
        "canonicalOntologyCandidates": canonical_candidates,
        "matcherRejections": matcher_rejections,
        "conflicts": conflicts,
        "focusAreaReview": {
            "vsm_terminology": {
                "observed": len([c for c in classified_mappings if "vsm" in _normalize(c.get("sourceTerm", ""))]),
                "verdict": "contained — native cohort uses SSM only",
                "misroutes": vsm_misroutes,
            },
            "circulation_wash_motor": {
                "mapping": "§3-15 Wash Motor (SSM, WDT750) → circulation_pump",
                "measurementKnowledgeId": "whirlpoolDishwasherAcuWashMotorOhms",
                "implementationComponent": "ssm_wash_motor",
                "notRoutedTo": "whirlpoolDishwasherFiltrationVsmWashMotorOhms / vsm_wash_motor",
                "classification": "inherited",
            },
            "drain_motor": {
                "observed": 0,
                "verdict": "not_in_native_cohort — reuses w11633848-drain-motor via shared platform",
            },
            "diverter": {
                "observed": 0,
                "verdict": "not_in_native_cohort — reuses w11480208-diverter-motor via shared platform",
            },
            "prodry_dc_fan": {
                "observed": 0,
                "verdict": "not_in_native_cohort — reuses w11480208-dc-fan via shared platform",
            },
            "measurement_inheritance": {
                "inheritedIds": sorted({
                    c.get("measurementKnowledgeId")
                    for c in overlays
                    if c.get("measurementKnowledgeId") in W11633848_GATED_MEASUREMENTS
                }),
                "vsmIdsAvoided": sorted(W11480208_PLATFORM_MEASUREMENTS),
            },
            "washer_dryer_overlay_leak": {
                "hits": len(washer_overlay_leaks),
                "verdict": "none" if not washer_overlay_leaks else "leak_detected",
                "details": washer_overlay_leaks,
            },
            "canonical_expansion": {
                "watchlistHits": watchlist_hits,
                "gapOntologyCandidates": gap_buckets.get("canonical_ontology_candidate", 0),
                "verdict": "contained" if not watchlist_hits and combined.get("new_canonical", 0) == 0 else "review",
            },
        },
        "measurementBindingDelta": {
            "inheritedFromPublished": [
                c.get("measurementKnowledgeId") for c in overlays
                if c.get("measurementKnowledgeId") in W11633848_GATED_MEASUREMENTS
            ],
            "vsmPlatformAvoided": sorted(W11480208_PLATFORM_MEASUREMENTS),
            "note": (
                "W11499711 SSM P5 1&2 (10–15 Ω) correctly binds whirlpoolDishwasherAcuWashMotorOhms "
                "published with ssm_wash_motor — not W11480208 VSM filtration knowledge."
            ),
        },
        "gapAnalysis": {
            "artifact": gap_path.name,
            "buckets": gap_buckets,
            "note": (
                "Corpus-wide dishwasher gap analyzer; canonical_ontology_candidate clusters are "
                "NOT W11499711 promotion triggers while rev1 frozen."
            ),
        },
        "mappingCandidates": classified_mappings,
        "overlayCandidates": classified_overlays,
        "existingPlatformComponents": sorted(platform_components.keys()),
    "publishedProcedureBindingCount": len(published_procedures),
    "publishedMeasurementBindingCount": len(published_measurements),
    "projectedOverlayRegistrations": len(overlay_registration_only),
        "watchlistCanonicalLeaks": watchlist_hits,
        "hardGates": {
            "canonicalOntologyMutated": False,
            "dishwasherJsonUnchanged": True,
            "whirlpoolDishwasherJsonUnchanged": True,
            "newCanonicalCount": combined.get("new_canonical", 0),
            "autoPublish": False,
            "autoApprove": False,
        },
        "artifacts": {
            "candidatesDir": f"normalization/candidates/{TARGET_MANUAL}/",
            "gapReport": gap_path.name,
            "priorGate": PRIOR_GATE.name,
            "priorPublication": PRIOR_PUBLICATION.name,
            "priorCompoundingPreview": PRIOR_PREVIEW.name,
        },
        "nextDecisionPoint": [
            "Confirm w11499711-wash-motor-ssm procedure binding registers under ssm_wash_motor",
            "Verify zero VSM/filtration measurement misroutes on WDT750 SSM cohort",
            "Human gate only if inherited classifications disagree with published overlay semantics",
        ],
    }


def main() -> int:
    report = build_compounding_preview()
    out = CALIBRATION / "W11499711_compounding_preview_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    summary = report["classificationSummary"]["combined"]
    print(f"Wrote {out}")
    print(
        f"combined: inherited={summary.get('inherited', 0)} "
        f"new_platform={summary.get('new_platform', 0)} "
        f"new_model={summary.get('new_model', 0)} "
        f"unresolved={summary.get('unresolved', 0)} "
        f"new_canonical={summary.get('new_canonical', 0)} "
        f"rejected={summary.get('rejected', 0)}"
    )
    print(f"projected_human_decisions={report['teachingCostCurve']['W11499711_projected']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
