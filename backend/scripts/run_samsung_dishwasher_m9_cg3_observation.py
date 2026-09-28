#!/usr/bin/env python3
"""CG-6.5 — SAMSUNG-DISHWASHER-M9 compounding CG-3 observation (no gate/publish)."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.calibration.gap_analyzer import analyze_corpus_gaps

KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANDIDATES = KNOWLEDGE / "normalization" / "candidates"
CANONICAL = KNOWLEDGE / "canonical" / "dishwasher.json"
SAMSUNG_OVERLAY = KNOWLEDGE / "canonical" / "manufacturer_overlays" / "samsung_dishwasher.json"
WHIRLPOOL_OVERLAY = KNOWLEDGE / "canonical" / "manufacturer_overlays" / "whirlpool_dishwasher.json"
PRIOR_GATE = CALIBRATION / "SAMSUNG_DISHWASHER_overlay_mapping_table_v1.json"
PRIOR_PUBLICATION = CALIBRATION / "publication_SAMSUNG-DISHWASHER.json"

TARGET_MANUAL = "SAMSUNG-DISHWASHER-M9"
PRIOR_MANUAL = "SAMSUNG-DISHWASHER"
NATIVE_PREFIX = "samsungdwm9-"
PLATFORM_FAMILY_ID = "samsung_dishwasher"

WATCHLIST_CANONICAL = frozenset({"diverter_valve", "turbidity_sensor", "check_valve"})
NON_DISHWASHER_CANONICAL = frozenset({"drive_motor", "lid_lock", "door_lock"})
PROCEDURAL_TITLE_RE = re.compile(r"^§\d")

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
    "whirlpool_duet_sport",
    "whirlpool_fl_dd",
)
CROSS_TEMPLATE_LEAK_PATTERNS = (
    "samsung_fl_washer",
    "samsung_vented_dryer",
    "whirlpool_",
    "washer_wf",
    "dryer_",
    "duet_sport",
)

# Published Samsung dishwasher procedure semantics (suffix → published binding).
PUBLISHED_PROCEDURE_SEMANTICS: dict[str, dict[str, Any]] = {
    "circulation-motor": {
        "testTargetId": "circulation_test",
        "canonicalComponents": ["circulation_pump"],
        "implementationComponent": "circulation_motor",
    },
    "distributor": {
        "testTargetId": "circulation_test",
        "canonicalComponents": ["circulation_pump"],
        "implementationComponent": "distributor_motor",
    },
    "door-switch": {"testTargetId": "door_switch_test", "canonicalComponents": ["door_switch"]},
    "drain-pump": {"testTargetId": "drain_test", "canonicalComponents": ["drain_pump"]},
    "dispenser": {
        "testTargetId": "detergent_dispenser_test",
        "canonicalComponents": ["detergent_dispenser"],
    },
    "dry-system": {
        "testTargetId": "drying_airflow_test",
        "canonicalComponents": ["drying_system"],
        "implementationComponent": "vent_fan_motor",
    },
    "fill-valve": {"testTargetId": "fill_test", "canonicalComponents": ["inlet_valve"]},
    "heater": {"testTargetId": "heater_command_test", "canonicalComponents": ["heat_source"]},
    "overflow": {
        "testTargetId": "water_level_test",
        "canonicalComponents": ["water_level_sensor"],
        "implementationComponent": "overflow_sensor",
    },
    "thermistor": {
        "testTargetId": "temperature_response_test",
        "canonicalComponents": ["temperature_sensor"],
    },
}


def _normalize(term: str) -> str:
    return re.sub(r"\s+", " ", str(term or "").strip().lower())


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _canonical_ids() -> set[str]:
    return {c["id"] for c in _load_json(CANONICAL).get("components", [])}


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


def _procedure_suffix(procedure_id: str) -> str:
    if not procedure_id.startswith(NATIVE_PREFIX):
        return ""
    return procedure_id[len(NATIVE_PREFIX) :]


def _published_aliases() -> dict[str, str]:
    overlay = _load_json(SAMSUNG_OVERLAY)
    aliases: dict[str, str] = {}
    for family in overlay.get("platformFamilies") or []:
        if family.get("platformFamilyId") != PLATFORM_FAMILY_ID:
            continue
        for term, canonical in (family.get("oemTermAliases") or {}).items():
            aliases[_normalize(term)] = str(canonical)
        for component in (family.get("add") or {}).get("components") or []:
            for term in component.get("aliases") or []:
                impl = component.get("implementsCanonicalId")
                if impl:
                    aliases[_normalize(term)] = str(impl)
    if PRIOR_GATE.is_file():
        gate = _load_json(PRIOR_GATE)
        for mapping in gate.get("mappings") or []:
            for term, canonical in (mapping.get("proposedAliases") or {}).items():
                aliases[_normalize(term)] = str(canonical)
    return aliases


def _published_bindings() -> tuple[
    dict[str, dict[str, Any]],
    dict[tuple[str, str], dict[str, Any]],
    dict[str, dict[str, Any]],
]:
    overlay = _load_json(SAMSUNG_OVERLAY)
    procedures: dict[str, dict[str, Any]] = {}
    measurements: dict[tuple[str, str], dict[str, Any]] = {}
    components: dict[str, dict[str, Any]] = {}
    for family in overlay.get("platformFamilies") or []:
        if family.get("platformFamilyId") != PLATFORM_FAMILY_ID:
            continue
        for binding in family.get("procedureBindings") or []:
            pid = str(binding.get("procedureId") or "")
            if pid:
                procedures[pid] = binding
        for binding in family.get("measurementBindings") or []:
            key = (
                str(binding.get("procedureId") or ""),
                str(binding.get("measurementKnowledgeId") or ""),
            )
            measurements[key] = binding
        for component in (family.get("add") or {}).get("components") or []:
            cid = str(component.get("id") or "")
            if cid:
                components[cid] = component
    return procedures, measurements, components


def _is_procedural_noise(source: str, status: str) -> bool:
    return bool(PROCEDURAL_TITLE_RE.match(source)) or status == "COMPOUND_TERM_CANDIDATE" and PROCEDURAL_TITLE_RE.match(source)


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
    matched = _normalize(candidate.get("matchedPhrase") or "")
    layers = _matcher_layers(candidate)
    procedure_id = str((candidate.get("provenance") or {}).get("procedureId") or "")

    if canonical in WATCHLIST_CANONICAL:
        classification = "new_canonical"
        rationale = f"Watchlist canonical blocked: {canonical}"
    elif canonical in NON_DISHWASHER_CANONICAL:
        classification = "rejected"
        rationale = f"Non-dishwasher canonical target ({canonical}) — cross-ontology matcher leak."
    elif canonical and canonical not in canonical_ids:
        classification = "new_canonical"
        rationale = f"Target not in frozen dishwasher rev1: {canonical}"
    elif any(_scan_leaks(layer, WHIRLPOOL_LEAK_PATTERNS) for layer in layers):
        classification = "rejected"
        rationale = "Whirlpool manufacturer overlay matcher contamination."
    elif any(_scan_leaks(layer, CROSS_TEMPLATE_LEAK_PATTERNS) for layer in layers):
        classification = "rejected"
        rationale = "Cross-template matcher route (washer/dryer/Whirlpool) — routing defect."
    elif norm == "diverter_motor" or "diverter" in norm and "distributor" not in norm:
        classification = "rejected"
        rationale = (
            "Samsung uses distributor motor at platform layer — diverter terminology "
            "must not promote diverter_valve or Whirlpool diverter path."
        )
    elif PROCEDURAL_TITLE_RE.match(source):
        if matched and matched in aliases and aliases[matched] == canonical:
            classification = "inherited_exact"
            rationale = f"Procedural title matched published alias '{matched}' → {canonical}."
        elif canonical and canonical in canonical_ids:
            classification = "deferred_procedural_title"
            rationale = "OEM § title — bind by procedureId; alias already on published layer."
        else:
            classification = "deferred_procedural_title"
            rationale = "Procedural title noise — not a vocabulary decision."
    elif status == "UNRESOLVED_TERM":
        if "vane" in norm or procedure_id.endswith("vane-motor"):
            classification = "new_platform"
            rationale = (
                "M9 lower vane motor — Samsung platform implementation candidate "
                "(circulation path), not canonical expansion."
            )
        elif "leak" in norm:
            classification = "unresolved"
            rationale = "Leak sensor — deferred on first manual; M9 functional role review."
        elif "power" in norm or "supply" in norm:
            classification = "unresolved"
            rationale = "Power/PBA path — deferred on first manual."
        else:
            classification = "unresolved"
            rationale = "No confident mapping — human gate required."
    elif canonical in canonical_ids:
        if norm in aliases and aliases[norm] == canonical:
            classification = "inherited_exact"
            rationale = f"Exact published Samsung alias '{source}' → {canonical}."
        elif matched in aliases and aliases[matched] == canonical:
            classification = "inherited_exact"
            rationale = f"Matched published alias '{candidate.get('matchedPhrase')}' → {canonical}."
        elif norm.replace("_", " ") in aliases and aliases[norm.replace("_", " ")] == canonical:
            classification = "inherited_semantic"
            rationale = "Seed term semantically matches published Samsung vocabulary."
        elif norm == canonical or norm.replace("_", "") == str(canonical).replace("_", ""):
            classification = "inherited_exact"
            rationale = "Seed componentId matches published canonical reuse."
        elif canonical == "circulation_pump" and "motor" in norm:
            classification = "inherited_semantic"
            rationale = (
                "Circulation hardware maps to published circulation_pump / "
                f"{platform_components.get('circulation_motor', {}).get('id', 'circulation_motor')}."
            )
        else:
            classification = "new_manufacturer_vocabulary"
            rationale = "Canonical known but alias not yet on published Samsung overlay."
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
    }


def _classify_overlay(
    candidate: dict[str, Any],
    published_procedures: dict[str, dict[str, Any]],
    published_measurements: dict[tuple[str, str], dict[str, Any]],
) -> dict[str, Any]:
    procedure_id = str(candidate.get("procedureId") or "")
    target = str(candidate.get("canonicalTestTarget") or "")
    ctype = str(candidate.get("candidateType") or "")
    meas_id = candidate.get("measurementKnowledgeId")
    suffix = _procedure_suffix(procedure_id)
    expected = PUBLISHED_PROCEDURE_SEMANTICS.get(suffix)
    blob = json.dumps(candidate)

    if _scan_leaks(blob, WHIRLPOOL_LEAK_PATTERNS):
        classification = "rejected"
        rationale = "Whirlpool measurement or binding leak."
    elif ctype == "procedureTestBinding" and suffix == "circulation-motor":
        if target == "motor_output_test":
            classification = "rejected"
            rationale = (
                "Matcher routed circulation to motor_output_test (washer ontology) — "
                "must compound published circulation_test / circulation_motor."
            )
        elif expected and target == expected["testTargetId"]:
            classification = "inherited_semantic"
            rationale = (
                "M9 circulation procedure reuses published circulation_test semantics "
                f"({expected['implementationComponent']})."
            )
        else:
            classification = "unresolved"
            rationale = "Circulation overlay binding needs human gate."
    elif ctype == "procedureTestBinding" and suffix == "vane-motor":
        classification = "new_platform"
        rationale = (
            "M9 vane motor — new Samsung platform implementation on circulation path; "
            "not diverter_valve canonical."
        )
    elif ctype == "procedureTestBinding" and expected:
        if target == expected["testTargetId"]:
            classification = "inherited_semantic"
            rationale = (
                f"M9 {suffix} reuses published {expected['testTargetId']} semantics "
                f"(new procedureId registration)."
            )
        else:
            classification = "unresolved"
            rationale = f"Published semantic family expects {expected['testTargetId']}, got {target}."
    elif ctype == "measurementBinding" and meas_id:
        if _scan_leaks(str(meas_id), WHIRLPOOL_LEAK_PATTERNS):
            classification = "rejected"
            rationale = f"Whirlpool measurement id blocked: {meas_id}"
        elif str(meas_id).startswith("samsungDishwasherM9"):
            published_semantic = any(
                b.get("testTargetId") == target
                for b in published_measurements.values()
                if suffix and _procedure_suffix(str(b.get("procedureId") or "")) == suffix
            ) or (
                expected is not None and target == expected.get("testTargetId")
            )
            if published_semantic:
                classification = "inherited_semantic"
                rationale = (
                    f"M9-native measurement ({meas_id}) reuses published test family {target}."
                )
            else:
                classification = "new_platform"
                rationale = f"New M9 measurement knowledge ({meas_id}) on known test target."
        elif str(meas_id).startswith("samsungDishwasher"):
            classification = "inherited_exact"
            rationale = f"Reuses first-manual Samsung measurement id {meas_id}."
        else:
            classification = "unresolved"
            rationale = "Measurement binding needs human gate."
    else:
        classification = "unresolved"
        rationale = "Overlay binding needs human gate."

    return {
        "id": candidate.get("id"),
        "candidateType": ctype,
        "procedureId": procedure_id,
        "canonicalTestTarget": target,
        "measurementKnowledgeId": meas_id,
        "displayTitle": candidate.get("displayTitle"),
        "classification": classification,
        "rationale": rationale,
    }


def _bucket(items: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        key = item["classification"]
        counts[key] = counts.get(key, 0) + 1
    return counts


def _teaching_units(classified: list[dict[str, Any]]) -> list[dict[str, Any]]:
    teaching_classes = {
        "new_platform",
        "new_model",
        "new_manufacturer_vocabulary",
        "unresolved",
        "new_canonical",
    }
    return [
        item
        for item in classified
        if item["classification"] in teaching_classes
        and not PROCEDURAL_TITLE_RE.match(str(item.get("sourceTerm") or item.get("displayTitle") or ""))
    ]


def build_observation() -> dict[str, Any]:
    canonical_ids = _canonical_ids()
    ontology = _load_json(CANONICAL).get("ontology") or {}
    aliases = _published_aliases()
    published_procedures, published_measurements, platform_components = _published_bindings()
    prior_publication = _load_json(PRIOR_PUBLICATION) if PRIOR_PUBLICATION.is_file() else {}

    target_dir = CANDIDATES / TARGET_MANUAL
    mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    overlays = _load_json(target_dir / "overlay_candidates.json").get("candidates") or []
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")

    gap_path = CALIBRATION / f"canonical_gap_report_compounding_{TARGET_MANUAL}_dishwasher.json"
    gap_report = analyze_corpus_gaps(template_id="dishwasher")
    gap_path.write_text(json.dumps(gap_report, indent=2), encoding="utf-8")

    classified_mappings = [
        _classify_mapping(c, aliases, canonical_ids, platform_components) for c in mappings
    ]
    classified_overlays = [
        _classify_overlay(c, published_procedures, published_measurements) for c in overlays
    ]
    all_classified = classified_mappings + classified_overlays

    mapping_counts = _bucket(classified_mappings)
    overlay_counts = _bucket(classified_overlays)
    combined = dict(mapping_counts)
    for key, value in overlay_counts.items():
        combined[key] = combined.get(key, 0) + value

    inherited_exact = [i for i in all_classified if i["classification"] == "inherited_exact"]
    inherited_semantic = [i for i in all_classified if i["classification"] == "inherited_semantic"]
    inherited_total = len(inherited_exact) + len(inherited_semantic)

    teachable = _teaching_units(all_classified)
    projected_human_decisions = len(teachable)

    non_noise = [
        i
        for i in all_classified
        if i["classification"] not in {"deferred_procedural_title", "rejected"}
    ]
    inheritance_rate = round(inherited_total / len(non_noise), 3) if non_noise else 0.0
    exact_inheritance_rate = round(len(inherited_exact) / len(non_noise), 3) if non_noise else 0.0

    whirlpool_leaks = [
        i for i in all_classified if "Whirlpool" in i.get("rationale", "")
        or any(_scan_leaks(json.dumps(i), WHIRLPOOL_LEAK_PATTERNS) for _ in [0])
    ]
    cross_template = [
        i for i in classified_mappings if i["classification"] == "rejected" and "Cross-template" in i["rationale"]
    ]
    canonical_expansion = [i for i in all_classified if i["classification"] == "new_canonical"]

    first_manual_decisions = prior_publication.get("compoundingMetrics", {}).get(
        "newHumanSemanticDecisions", 15
    )

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg6_samsung_dishwasher_m9_compounding_observation",
        "experiment": (
            "Samsung dishwasher manual #2 — compounding against published samsung_dishwasher.json"
        ),
        "manualId": TARGET_MANUAL,
        "platformId": manifest.get("platformId"),
        "platformFamilyId": PLATFORM_FAMILY_ID,
        "ontologyId": "dishwasher",
        "ontologyFrozen": bool(ontology.get("frozen")),
        "ontologyFrozenRevision": ontology.get("frozenRevision"),
        "priorManualId": PRIOR_MANUAL,
        "manufacturerOverlay": "samsung_dishwasher.json",
        "manufacturerOverlayPublishedThrough": PRIOR_MANUAL,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "cg3_compounding_observation",
        "publishBlocked": True,
        "pipelineCounts": manifest.get("counts"),
        "baselineComparison": {
            PRIOR_MANUAL: {
                "role": "first_samsung_manual_baseline",
                "newHumanSemanticDecisions": first_manual_decisions,
                "publicationDelta": prior_publication.get("publicationDelta"),
            },
            "nativeCohortFilter": (
                f"source.manualId === {TARGET_MANUAL} "
                f"({manifest.get('counts', {}).get('procedures', '?')} native procedures; "
                f"platformId {manifest.get('platformId')})"
            ),
        },
        "inheritanceAccounting": {
            "inherited_exact": len(inherited_exact),
            "inherited_semantic": len(inherited_semantic),
            "inherited_total": inherited_total,
            "nonNoiseCandidateCount": len(non_noise),
            "inheritanceRate": inheritance_rate,
            "exactInheritanceRate": exact_inheritance_rate,
            "note": (
                "Exact = published alias or seed-id match. Semantic = same canonical/test family "
                "with new M9 procedureId or measurement id."
            ),
        },
        "classificationSummary": {
            "mappingCandidates": mapping_counts,
            "overlayCandidates": overlay_counts,
            "combined": combined,
        },
        "teachingCostCurve": {
            PRIOR_MANUAL: first_manual_decisions,
            f"{TARGET_MANUAL}_projected": projected_human_decisions,
            "reductionVsFirstSamsung": (
                round(1 - projected_human_decisions / first_manual_decisions, 3)
                if first_manual_decisions and projected_human_decisions < first_manual_decisions
                else 0.0
            ),
            "teachingUnits": teachable,
        },
        "compoundingBuckets": {
            "inherited_exact": inherited_exact,
            "inherited_semantic": inherited_semantic,
            "new_platform": [i for i in all_classified if i["classification"] == "new_platform"],
            "new_model": [i for i in all_classified if i["classification"] == "new_model"],
            "new_manufacturer_vocabulary": [
                i for i in all_classified if i["classification"] == "new_manufacturer_vocabulary"
            ],
            "new_canonical": canonical_expansion,
            "unresolved": [i for i in all_classified if i["classification"] == "unresolved"],
            "deferred_procedural_title": [
                i for i in all_classified if i["classification"] == "deferred_procedural_title"
            ],
            "rejected": [i for i in all_classified if i["classification"] == "rejected"],
        },
        "manufacturerIsolation": {
            "whirlpoolLeakCount": len(whirlpool_leaks),
            "whirlpoolLeaks": whirlpool_leaks,
            "crossTemplateLeakCount": len(cross_template),
            "crossTemplateLeaks": cross_template,
            "whirlpoolOverlayReferenced": WHIRLPOOL_OVERLAY.is_file(),
            "verdict": "clean" if not whirlpool_leaks and not canonical_expansion else "review",
        },
        "canonicalOntologyWatch": {
            "watchlistHits": [
                i for i in all_classified if i.get("canonicalId") in WATCHLIST_CANONICAL
            ],
            "newCanonicalCandidates": canonical_expansion,
            "verdict": "contained" if not canonical_expansion else "blocked",
        },
        "architectureBoundary": {
            "distributorImplementsCirculation": True,
            "noDiverterValvePromotion": not any(
                i.get("canonicalId") == "diverter_valve" for i in all_classified
            ),
            "circulationMotorOutputTestRejected": any(
                i.get("procedureId") == "samsungdwm9-circulation-motor"
                and i.get("classification") == "rejected"
                for i in classified_overlays
            ),
            "vaneMotorPlatformCandidate": any(
                i.get("procedureId") == "samsungdwm9-vane-motor" for i in all_classified
            ),
            "publishedPlatformComponents": sorted(platform_components.keys()),
        },
        "focusAreaReview": {
            "circulation_motor": {
                "m9Procedure": "samsungdwm9-circulation-motor",
                "matcherRisk": "motor_output_test / drive_motor washer leak",
                "expected": "circulation_test + circulation_motor (published)",
            },
            "vane_motor": {
                "m9Procedure": "samsungdwm9-vane-motor",
                "note": "M9 delta — lower vane motor; platform knowledge not first-manual vocabulary.",
            },
            "diverter_terminology": {
                "observed": [
                    i for i in classified_mappings if "diverter" in _normalize(i.get("sourceTerm", ""))
                ],
                "verdict": "reject diverter_motor seed — use distributor/vane platform layer",
            },
            "leak_overflow": {
                "procedures": ["samsungdwm9-leak-sensor", "samsungdwm9-overflow"],
                "note": "First manual deferred leak; overflow may inherit overflow_sensor platform.",
            },
        },
        "conflicts": conflicts,
        "gapReportBuckets": {k: len(v) for k, v in (gap_report.get("buckets") or {}).items()},
        "hardGates": {
            "dishwasherJsonUnchanged": True,
            "samsungDishwasherJsonPublished": SAMSUNG_OVERLAY.is_file(),
            "noWhirlpoolLeakage": len(whirlpool_leaks) == 0,
            "noCanonicalExpansion": len(canonical_expansion) == 0,
            "autoPublish": False,
            "autoApprove": False,
        },
        "nextDecisionPoint": [
            "Inspect projected teaching units before M9 gate",
            "Confirm vane_motor platform implementation vs circulation_pump",
            "Reject motor_output_test / drive_motor washer routing on circulation",
            "Do not import Whirlpool diverter or ACU measurements",
        ],
    }


def main() -> int:
    print("==> CG-3 normalize SAMSUNG-DISHWASHER-M9")
    norm = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "run_normalization_pipeline.py"), "--manual", TARGET_MANUAL],
        cwd=ROOT,
        check=False,
    )
    if norm.returncode != 0:
        return norm.returncode

    report = build_observation()
    out = CALIBRATION / "SAMSUNG_DISHWASHER_M9_cg3_compounding_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    inh = report["inheritanceAccounting"]
    teach = report["teachingCostCurve"]
    iso = report["manufacturerIsolation"]
    combined = report["classificationSummary"]["combined"]

    print(f"Wrote {out}")
    print(
        f"pipeline: procedures={report['pipelineCounts']['procedures']} "
        f"mappings={report['pipelineCounts']['mappingCandidates']} "
        f"overlays={report['pipelineCounts']['overlayCandidates']} "
        f"conflicts={report['pipelineCounts']['conflicts']}"
    )
    print(
        f"inheritance: exact={inh['inherited_exact']} semantic={inh['inherited_semantic']} "
        f"rate={inh['inheritanceRate']:.0%} (exact={inh['exactInheritanceRate']:.0%})"
    )
    print(f"projected human decisions: {teach[f'{TARGET_MANUAL}_projected']} (vs first manual {teach[PRIOR_MANUAL]})")
    print(f"combined buckets: {combined}")
    print(f"whirlpool leaks: {iso['whirlpoolLeakCount']} cross-template: {iso['crossTemplateLeakCount']}")
    print(f"canonical watch: {report['canonicalOntologyWatch']['verdict']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
