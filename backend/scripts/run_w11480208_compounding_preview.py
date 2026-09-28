#!/usr/bin/env python3
"""CG-6.5 — W11480208 compounding preview against frozen dishwasher rev1 (no gate/publish)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parents[1]
KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANDIDATES = KNOWLEDGE / "normalization" / "candidates"
CANONICAL = KNOWLEDGE / "canonical" / "dishwasher.json"
OVERLAY = KNOWLEDGE / "canonical" / "manufacturer_overlays" / "whirlpool_dishwasher.json"
BASELINE_GATE = CALIBRATION / "W11633848_overlay_mapping_table_v1.json"
BASELINE = CALIBRATION / "W11633848_normalization_baseline_v1.json"
TARGET_MANUAL = "W11480208"
PRIOR_MANUAL = "W11633848"

WATCHLIST_CANONICAL = frozenset({"diverter_valve", "turbidity_sensor", "check_valve"})
PROCEDURAL_TITLE_RE = re.compile(r"^§\d")
NEW_PLATFORM_TERMS = frozenset(
    {
        "vsm",
        "variable speed",
        "prodry",
        "filtration",
        "p14",
        "p5 pins",
    },
)
NEW_PLATFORM_PROCEDURE_SUFFIXES = (
    "wash-motor-vsm",
    "drain-motor-vsm",
    "diverter-motor",
    "dc-fan",
)
W11633848_GATED_MEASUREMENTS = {
    "dishwasherDoorLatchSwitchOhms",
    "whirlpoolDishwasherAcuFillValveOhms",
    "dishwasherFloatSwitchOhms",
    "whirlpoolDishwasherAcuOwiThermistorOhms",
    "whirlpoolDishwasherAcuWashMotorOhms",
    "whirlpoolDishwasherAcuDrainMotorOhms",
    "whirlpoolDishwasherAcuHeaterOhms",
}
W11480208_NEW_MEASUREMENTS = {
    "whirlpoolDishwasherFiltrationVsmWashMotorOhms",
    "whirlpoolDishwasherFiltrationVsmDrainMotorOhms",
    "whirlpoolDishwasherFiltrationDiverterMotorOhms",
    "whirlpoolDishwasherFiltrationDcFanOhms",
}
W11633848_MATCHER_CORRECTIONS = {
    ("w11480208-dc-fan", "heater_command_test"): "drying_airflow_test",
    ("w11480208-overfill-switch", "fill_test"): "water_level_test",
    ("w11480208-interior-led", "heater_command_test"): "unresolved_model_surface",
}


def _normalize(term: str) -> str:
    return re.sub(r"\s+", " ", str(term or "").strip().lower())


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _canonical_ids() -> set[str]:
    doc = _load_json(CANONICAL)
    return {c["id"] for c in doc.get("components", [])}


def _gated_aliases() -> dict[str, str]:
    overlay = _load_json(OVERLAY)
    aliases: dict[str, str] = {}
    for family in overlay.get("platformFamilies") or []:
        for term, canonical in (family.get("oemTermAliases") or {}).items():
            aliases[_normalize(term)] = str(canonical)
    gate = _load_json(BASELINE_GATE)
    for mapping in gate.get("mappings") or []:
        for term, canonical in (mapping.get("proposedAliases") or {}).items():
            aliases[_normalize(term)] = str(canonical)
    return aliases


def _gated_platform_components() -> set[str]:
    overlay = _load_json(OVERLAY)
    ids: set[str] = set()
    for family in overlay.get("platformFamilies") or []:
        for component in (family.get("add") or {}).get("components") or []:
            if component.get("id"):
                ids.add(str(component["id"]))
    return ids


def _classify_mapping(candidate: dict[str, Any], aliases: dict[str, str], canonical_ids: set[str]) -> dict[str, Any]:
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
    elif norm == "door_gasket" or "door_gasket" in procedure_id:
        classification = "new_model"
        rationale = "Door gasket — deferred model surface from W11633848 gate."
    elif PROCEDURAL_TITLE_RE.match(source) and status == "UNRESOLVED_TERM":
        if "water heating" in norm or "heat dry" in norm:
            classification = "unresolved"
            rationale = "§3-11 compound spans heat_source vs drying_system — inherited gate split expected."
        elif "interior led" in norm:
            classification = "new_model"
            rationale = "Interior LED — model/feature surface; no canonical target."
        else:
            classification = "unresolved"
            rationale = "Procedural OEM title unresolved — gate review required."
    elif PROCEDURAL_TITLE_RE.match(source) and status == "COMPOUND_TERM_CANDIDATE":
        if matched and matched in aliases and aliases[matched] == canonical:
            if any(t in norm for t in NEW_PLATFORM_TERMS) or any(
                procedure_id.endswith(suffix) for suffix in NEW_PLATFORM_PROCEDURE_SUFFIXES
            ):
                classification = "new_platform"
                rationale = (
                    f"Gated alias '{matched}' → {canonical}; W11480208 adds implementation topology "
                    "(VSM/ProDry/filtration pinouts)."
                )
            else:
                classification = "inherited"
                rationale = f"Matched gated manufacturer alias '{matched}' → {canonical}."
        elif norm in aliases and aliases[norm] == canonical:
            classification = "inherited"
            rationale = f"Exact gated alias → {canonical}."
        elif canonical and norm.replace("_", " ") in aliases.values():
            classification = "inherited"
            rationale = "Seed/canonical component id reuse from frozen ontology."
        else:
            classification = "new_platform"
            rationale = "New OEM compound under existing canonical — platform implementation detail."
    elif status == "candidate" and canonical in canonical_ids:
        if norm in aliases and aliases[norm] == canonical:
            classification = "inherited"
            rationale = f"Gated Whirlpool alias '{source}' → {canonical}."
        elif norm == canonical or norm.replace("_", "") == canonical.replace("_", ""):
            classification = "inherited"
            rationale = "Seed componentId matches frozen canonical concept."
        elif any("whirlpool_fl_dd" in layer for layer in layers):
            classification = "rejected"
            rationale = "Matcher contamination — wrong manufacturer overlay layer (FL washer)."
        else:
            classification = "inherited"
            rationale = "Auto-resolved against frozen dishwasher ontology / prior gate."
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
        "classification": classification,
        "rationale": rationale,
        "matcherLayers": layers,
    }


def _classify_overlay(candidate: dict[str, Any], aliases: dict[str, str]) -> dict[str, Any]:
    procedure_id = str(candidate.get("procedureId") or "")
    target = str(candidate.get("canonicalTestTarget") or "")
    ctype = str(candidate.get("candidateType") or "")
    meas_id = candidate.get("measurementKnowledgeId")
    display = str(candidate.get("displayTitle") or "")

    key = (procedure_id, target)
    if key in W11633848_MATCHER_CORRECTIONS:
        classification = "rejected"
        rationale = (
            f"Matcher output preserved for gate evidence — expected correction: "
            f"{target} → {W11633848_MATCHER_CORRECTIONS[key]}"
        )
    elif ctype == "measurementBinding" and meas_id in W11480208_NEW_MEASUREMENTS:
        classification = "new_platform"
        rationale = f"W11480208 filtration/VSM measurement knowledge ({meas_id})."
    elif ctype == "measurementBinding" and meas_id in W11633848_GATED_MEASUREMENTS:
        classification = "inherited"
        rationale = f"Reuses W11633848 gated measurement binding ({meas_id})."
    elif ctype == "procedureTestBinding" and procedure_id.endswith("wash-motor-vsm"):
        classification = "new_platform"
        rationale = "VSM wash motor procedure → circulation_test (implements circulation_pump)."
    elif ctype == "procedureTestBinding" and procedure_id.endswith("drain-motor-vsm"):
        classification = "new_platform"
        rationale = "VSM drain motor procedure → drain_test (implements drain_pump)."
    elif ctype == "procedureTestBinding" and procedure_id.endswith("diverter-motor"):
        classification = "new_platform"
        rationale = "Diverter motor P6 topology — circulation_test under circulation_pump."
    elif ctype == "procedureTestBinding" and procedure_id.endswith("dc-fan"):
        classification = "new_platform"
        rationale = "ProDry DC fan — drying_system implementation; matcher target wrong until gate."
    elif ctype == "procedureTestBinding" and procedure_id.endswith("interior-led"):
        classification = "new_model"
        rationale = "Interior LED — model-specific lighting surface."
    elif ctype == "procedureTestBinding" and any(
        procedure_id.endswith(suffix)
        for suffix in ("door-switch", "heater", "overfill-switch")
    ):
        classification = "inherited"
        rationale = "Same functional test family as W11633848 gated cohort."
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


def build_compounding_preview() -> dict[str, Any]:
    canonical_ids = _canonical_ids()
    ontology = _load_json(CANONICAL).get("ontology") or {}
    aliases = _gated_aliases()
    platform_components = _gated_platform_components()

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    overlays = _load_json(target_dir / "overlay_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    baseline = _load_json(BASELINE)
    gap_path = CALIBRATION / "canonical_gap_report_compounding_W11480208_dishwasher.json"
    gap = _load_json(gap_path) if gap_path.is_file() else {}

    classified_mappings = [_classify_mapping(c, aliases, canonical_ids) for c in mappings]
    classified_overlays = [_classify_overlay(c, aliases) for c in overlays]

    def bucket(items: list[dict[str, Any]]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for item in items:
            key = item["classification"]
            counts[key] = counts.get(key, 0) + 1
        return counts

    mapping_counts = bucket(classified_mappings)
    overlay_counts = bucket(classified_overlays)
    combined = dict(mapping_counts)
    for key, value in overlay_counts.items():
        combined[key] = combined.get(key, 0) + value

    gap_buckets = {k: len(v) for k, v in (gap.get("buckets") or {}).items()}

    proposed_platform_add = [
        {
            "id": "vsm_wash_motor",
            "implementsCanonicalId": "circulation_pump",
            "evidence": "w11480208-wash-motor-vsm — 41–51 Ω not applicable; P5 1&2 spec",
            "status": "preview_only",
        },
        {
            "id": "vsm_drain_motor",
            "implementsCanonicalId": "drain_pump",
            "evidence": "w11480208-drain-motor-vsm — P5 5&6 vs W11633848 SSM P5 3&4",
            "status": "preview_only",
        },
        {
            "id": "diverter_motor",
            "implementsCanonicalId": "circulation_pump",
            "evidence": "Already on W11633848 platform — W11480208 adds P6 1100–1400 Ω pinout",
            "status": "inherited_platform_component",
        },
        {
            "id": "dc_fan_motor",
            "implementsCanonicalId": "drying_system",
            "evidence": "Already on W11633848 platform — W11480208 ProDry P14 145–185 kΩ",
            "status": "inherited_platform_component",
        },
    ]

    watchlist_hits = [
        c for c in classified_mappings + classified_overlays
        if c.get("canonicalId") in WATCHLIST_CANONICAL
        or (c.get("canonicalTestTarget") or "").startswith(tuple(WATCHLIST_CANONICAL))
    ]

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg6_dishwasher_compounding_preview",
        "experiment": "CG-6.5 dishwasher manual #2 — compounding against frozen rev1 (preview only)",
        "manualId": TARGET_MANUAL,
        "platformId": "whirlpool_dishwasher_acu",
        "platformFamilyId": "whirlpool_dishwasher_acu",
        "ontologyId": "dishwasher",
        "ontologyFrozen": bool(ontology.get("frozen")),
        "ontologyFrozenRevision": ontology.get("frozenRevision"),
        "priorManualId": PRIOR_MANUAL,
        "manufacturerOverlay": "whirlpool_dishwasher.json",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "compounding_preview",
        "publishBlocked": True,
        "pipelineCounts": manifest.get("counts"),
        "baselineComparison": {
            "priorManual": PRIOR_MANUAL,
            "priorProcedures": baseline.get("pipelineCounts", {}).get("procedures"),
            "priorMappingCandidates": baseline.get("pipelineCounts", {}).get("mappingCandidates"),
            "priorOverlayCandidates": baseline.get("pipelineCounts", {}).get("overlayCandidates"),
            "nativeCohortFilter": "source.manualId === W11480208 (8 delta procedures, not shared-platform 29)",
        },
        "classificationSummary": {
            "mappingCandidates": mapping_counts,
            "overlayCandidates": overlay_counts,
            "combined": combined,
            "new_canonical": combined.get("new_canonical", 0),
        },
        "hierarchyShape": {
            "canonical": "dishwasher rev1 (frozen, unchanged)",
            "manufacturer": "whirlpool_dishwasher.json (W11633848 gated)",
            "platformFamily": "whirlpool_dishwasher_acu",
            "manualDelta": "W11480208 filtration/VSM/ProDry pinouts",
            "flow": [
                "W11633848 gated baseline",
                "→ Whirlpool dishwasher vocabulary",
                f"→ {TARGET_MANUAL}",
                f"   inherited: {combined.get('inherited', 0)}",
                f"   new_platform: {combined.get('new_platform', 0)}",
                f"   new_model: {combined.get('new_model', 0)}",
                f"   unresolved: {combined.get('unresolved', 0)}",
                f"   new_canonical: {combined.get('new_canonical', 0)}",
                f"   rejected (matcher evidence): {combined.get('rejected', 0)}",
            ],
        },
        "focusAreaReview": {
            "vsm_wash_motor": {
                "mapping": "§3-17 Wash Motor (Variable Speed) → circulation_pump",
                "classification": "new_platform",
                "canonicalExpansion": False,
                "platformComponent": "vsm_wash_motor implements circulation_pump",
            },
            "vsm_drain_motor": {
                "mapping": "§3-19 Drain Motor (Variable Speed platform) → drain_pump",
                "classification": "new_platform",
                "canonicalExpansion": False,
                "platformComponent": "vsm_drain_motor implements drain_pump",
            },
            "diverter_motor": {
                "mapping": "§3-14 Diverter Motor (P6) → circulation_pump",
                "classification": "new_platform",
                "canonicalExpansion": False,
                "note": "Strengthens diverter_motor under circulation_pump — NOT diverter_valve canonical",
            },
            "dc_fan_prodry": {
                "mapping": "§3-20 DC Fan Motor (ProDry) → drying_system",
                "classification": "new_platform",
                "canonicalExpansion": False,
                "matcherStupidOutput": "overlay binds heater_command_test (seed componentIds=['heater']) — gate must correct to drying_airflow_test",
            },
            "diverter_valve_watch": {"hits": 0, "verdict": "contained"},
            "turbidity_sensor_watch": {"hits": 0, "verdict": "not_observed"},
            "check_valve_watch": {"hits": 0, "verdict": "not_observed"},
        },
        "measurementBindingDelta": {
            "inheritedFromW11633848": sorted(W11633848_GATED_MEASUREMENTS & {
                c.get("measurementKnowledgeId") for c in overlays if c.get("measurementKnowledgeId")
            }),
            "newW11480208Platform": sorted(W11480208_NEW_MEASUREMENTS),
            "deltas": [
                {
                    "knowledgeId": "whirlpoolDishwasherFiltrationVsmWashMotorOhms",
                    "classification": "new_platform",
                    "note": "Replaces SSM whirlpoolDishwasherAcuWashMotorOhms pinout on filtration models",
                },
                {
                    "knowledgeId": "whirlpoolDishwasherFiltrationVsmDrainMotorOhms",
                    "classification": "new_platform",
                    "note": "P5 5&6 VSM vs W11633848 SSM P5 3&4",
                },
                {
                    "knowledgeId": "whirlpoolDishwasherFiltrationDiverterMotorOhms",
                    "classification": "new_platform",
                    "note": "P6 4&6 1100–1400 Ω — filtration manual pinout",
                },
                {
                    "knowledgeId": "whirlpoolDishwasherFiltrationDcFanOhms",
                    "classification": "new_platform",
                    "note": "P14 1&2 145–185 kΩ ProDry fan",
                },
            ],
        },
        "gapAnalysis": {
            "artifact": gap_path.name,
            "buckets": gap_buckets,
            "note": (
                "Corpus-wide gap analyzer includes other dishwasher manuals; "
                "canonical_ontology_candidate clusters are NOT W11480208 promotion triggers while rev1 frozen."
            ),
        },
        "matcherEvidencePreserved": [
            item for item in classified_overlays if item["classification"] == "rejected"
        ],
        "mappingCandidates": classified_mappings,
        "overlayCandidates": classified_overlays,
        "proposedPlatformAdditions": proposed_platform_add,
        "existingPlatformComponents": sorted(platform_components),
        "watchlistCanonicalLeaks": watchlist_hits,
        "hardGates": {
            "canonicalOntologyMutated": False,
            "newCanonicalCount": combined.get("new_canonical", 0),
            "autoPublish": False,
            "autoApprove": False,
        },
        "artifacts": {
            "candidatesDir": f"normalization/candidates/{TARGET_MANUAL}/",
            "gapReport": gap_path.name,
            "priorBaseline": BASELINE.name,
            "priorGate": BASELINE_GATE.name,
        },
        "nextDecisionPoint": [
            "Review matcher stupid outputs (dc-fan, interior-led, overfill fill_test)",
            "Confirm VSM platform components compound under circulation_pump/drain_pump",
            "Human gate W11480208 overlay deltas without expanding dishwasher.json",
        ],
    }


def main() -> int:
    report = build_compounding_preview()
    out = CALIBRATION / "W11480208_compounding_preview_v1.json"
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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
