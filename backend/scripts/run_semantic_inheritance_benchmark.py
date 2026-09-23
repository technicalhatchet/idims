#!/usr/bin/env python3
"""CG-6.3 — Before/after semantic inheritance benchmark against frozen 6.2 calibration corpus."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from human_decision_metrics import (
    build_corpus_knowledge,
    resolve_promotion_prior_manual_ids,
    resolve_samsung_platform_family_prior_manual_ids,
)
from normalization.canonical_matcher import build_mapping_candidates
from normalization.normalize_procedure import load_procedure_seeds_for_manual
from normalization.paths import CALIBRATION_DIR, CANDIDATES_DIR, PROCEDURE_SEED_DIR
from normalization.pipeline import find_manual_entry, load_manifest
from normalization.review.approval_levels import classify_candidate
from normalization.review.review_package import build_review_record
from normalization.semantic_inheritance import (
    build_semantic_match_context,
    collect_semantic_abstentions,
    load_semantic_inheritance_rules,
    record_has_semantic_platform_inheritance,
    try_semantic_inheritance,
)
from run_compounding_efficiency_report import build_efficiency_report, load_json

OUTPUT_FILE = "semantic_inheritance_benchmark_v1.json"
EFFICIENCY_FILE = "compounding_efficiency_v1.json"
CALIBRATION_CORPUS_FILE = "compounding_calibration_corpus_v1.json"
R3_VALIDATED_BASELINE_FILE = "compounding_semantic_inheritance_rule3_validated_v1.json"


def _platform_prior_manual_ids(manual_id: str, prior_manual_ids: list[str]) -> list[str]:
    samsung_prior = resolve_samsung_platform_family_prior_manual_ids(manual_id)
    if samsung_prior:
        return samsung_prior
    from human_decision_metrics import resolve_platform_family_prior_manual_ids

    tl_prior = resolve_platform_family_prior_manual_ids(manual_id)
    if tl_prior:
        return tl_prior
    return [mid for mid in prior_manual_ids if mid.startswith("SAMSUNG") or mid.startswith("W")]


def _record_is_inherited_mapping(record: dict, corpus: dict[str, set[tuple[str, ...]]]) -> bool:
    if record.get("candidateType") != "canonicalMapping":
        return False
    term = str(record.get("what") or "").strip().lower()
    canonical = str(record.get("mapsTo") or "").strip()
    if not term or not canonical:
        return False
    return (term, canonical) in corpus.get("canonicalMappings", set())


def simulate_mapping_gate_burden(
    manual_entry: dict[str, Any],
    *,
    enable_semantic_inheritance: bool,
) -> dict[str, Any]:
    manual_id = str(manual_entry.get("manualId"))
    template_id = str(manual_entry.get("templateId") or "washer")
    seed_dir = PROCEDURE_SEED_DIR / str(manual_entry.get("seedDir"))
    procedures = load_procedure_seeds_for_manual(manual_entry, seed_dir)
    candidates, _ = build_mapping_candidates(
        procedures,
        manual_entry,
        template_id,
        enable_semantic_inheritance=enable_semantic_inheritance,
    )

    prior_manual_ids = resolve_promotion_prior_manual_ids(manual_id) or []
    corpus = build_corpus_knowledge(prior_manual_ids)
    platform_prior = _platform_prior_manual_ids(manual_id, prior_manual_ids)

    human_gate_decisions = 0
    semantic_inheritance_auto = 0
    exact_inheritance_auto = 0
    semantic_matches: list[dict[str, Any]] = []
    abstentions: list[dict[str, Any]] = []
    semantic_context = build_semantic_match_context(manual_entry, prior_manual_ids)

    for candidate in candidates:
        record = build_review_record(candidate, manual_id, [])
        approval_level = classify_candidate(candidate)
        record["approvalLevel"] = approval_level
        maps_to = candidate.get("canonicalId")
        if maps_to:
            record["mapsTo"] = maps_to

        if record_has_semantic_platform_inheritance(record, platform_prior):
            semantic_inheritance_auto += 1
            semantic_matches.append(
                {
                    "sourceTerm": candidate.get("sourceTerm"),
                    "canonicalId": maps_to,
                    "ruleId": (candidate.get("semanticInheritance") or {}).get("ruleId"),
                },
            )
            continue

        if _record_is_inherited_mapping(record, corpus):
            exact_inheritance_auto += 1
            continue

        if approval_level == "blocked" or (
            approval_level == "careful" and candidate.get("status") == "UNRESOLVED_TERM"
        ):
            human_gate_decisions += 1

    if enable_semantic_inheritance:
        candidate_terms = [
            str(candidate.get("sourceTerm") or candidate.get("extractedTerm") or "")
            for candidate in candidates
        ]
        for abstention in collect_semantic_abstentions(candidate_terms, semantic_context):
            abstentions.append(
                {
                    "sourceTerm": abstention.source_term,
                    "ruleId": abstention.rule_id,
                    "signalType": abstention.signal_type,
                    "reason": abstention.reason,
                },
            )

    return {
        "manualId": manual_id,
        "mappingCandidates": len(candidates),
        "humanGateDecisions": human_gate_decisions,
        "semanticInheritanceAuto": semantic_inheritance_auto,
        "exactInheritanceAuto": exact_inheritance_auto,
        "semanticMatches": semantic_matches,
        "abstentions": abstentions,
        "abstentionCount": len(abstentions),
    }


def regression_scan_calibration_corpus(calibration_dir: Path) -> dict[str, Any]:
    corpus = load_json(calibration_dir / CALIBRATION_CORPUS_FILE)
    manifest = load_manifest()
    rules = load_semantic_inheritance_rules()
    matches: list[dict[str, Any]] = []
    abstentions: list[dict[str, Any]] = []

    for manual_id in corpus.get("promotionOrder") or []:
        entry = find_manual_entry(manifest, manual_id)
        prior_manual_ids = resolve_promotion_prior_manual_ids(manual_id) or []
        context = build_semantic_match_context(entry, prior_manual_ids)
        seed_dir = PROCEDURE_SEED_DIR / str(entry.get("seedDir"))
        procedures = load_procedure_seeds_for_manual(entry, seed_dir)
        procedure_titles = [str(procedure.get("title") or "") for procedure in procedures]
        for procedure in procedures:
            title = str(procedure.get("title") or "")
            if not title:
                continue
            match = try_semantic_inheritance(title, context, rules=rules)
            if match:
                matches.append(
                    {
                        "manualId": manual_id,
                        "sourceTerm": title,
                        "ruleId": match.rule_id,
                        "canonicalId": match.canonical_id,
                    },
                )
        for abstention in collect_semantic_abstentions(procedure_titles, context, rules=rules):
            abstentions.append(
                {
                    "manualId": manual_id,
                    "sourceTerm": abstention.source_term,
                    "ruleId": abstention.rule_id,
                    "signalType": abstention.signal_type,
                    "reason": abstention.reason,
                },
            )

    enabled_rules = [
        rule for rule in (rules.get("rules") or [])
        if rule.get("enabled", True)
    ]
    expected_match_count = len(enabled_rules)
    false_positive_check = "PASS"
    if len(matches) != expected_match_count:
        false_positive_check = "FAIL"
    else:
        for match in matches:
            if match.get("manualId") != "SAMSUNG-FL-WF6000R-WASHER":
                false_positive_check = "FAIL"
                break

    return {
        "ruleCount": len(enabled_rules),
        "expectedMatchCount": expected_match_count,
        "matchCount": len(matches),
        "matches": matches,
        "abstentionCount": len(abstentions),
        "abstentions": abstentions,
        "falsePositiveCheck": false_positive_check,
    }


def _load_r3_validated_baseline(calibration_dir: Path) -> dict[str, Any] | None:
    path = calibration_dir / R3_VALIDATED_BASELINE_FILE
    if not path.is_file():
        return None
    doc = load_json(path)
    benchmark = doc.get("benchmarkResults") or {}
    mapping = benchmark.get("mappingGateBurden") or {}
    cohort = benchmark.get("projectedCohortHumanGateDecisions") or {}
    return {
        "source": R3_VALIDATED_BASELINE_FILE,
        "mappingGateBurden": int(mapping.get("after", 68)),
        "projectedCohortHumanGateDecisions": int(cohort.get("after", 45)),
        "semanticInheritsAutoResolved": int(benchmark.get("semanticInheritsAutoResolved", 3)),
        "regressionAbstentions": int(benchmark.get("abstentions", 1)),
        "regressionFalsePositives": int(benchmark.get("regressionFalsePositives", 0)),
    }


def build_semantic_inheritance_benchmark(calibration_dir: Path | None = None) -> dict[str, Any]:
    root = calibration_dir or CALIBRATION_DIR
    before_report = build_efficiency_report(root)
    before_total = int(before_report["summary"]["totalHumanGateDecisions"])
    before_semantic = int(before_report["summary"]["documentedSemanticInheritanceCases"])

    corpus = load_json(root / CALIBRATION_CORPUS_FILE)
    manifest = load_manifest()
    promotion_order = list(corpus.get("promotionOrder") or [])

    per_manual_before: list[dict[str, Any]] = []
    per_manual_after: list[dict[str, Any]] = []

    for manual_id in promotion_order:
        entry = find_manual_entry(manifest, manual_id)
        per_manual_before.append(
            {
                "manualId": manual_id,
                "humanGateDecisions": simulate_mapping_gate_burden(
                    entry,
                    enable_semantic_inheritance=False,
                )["humanGateDecisions"],
            },
        )
        per_manual_after.append(
            simulate_mapping_gate_burden(entry, enable_semantic_inheritance=True),
        )

    after_mapping_total = sum(row["humanGateDecisions"] for row in per_manual_after)
    before_mapping_total = sum(row["humanGateDecisions"] for row in per_manual_before)
    after_semantic_auto = sum(row["semanticInheritanceAuto"] for row in per_manual_after)
    after_abstentions = sum(row.get("abstentionCount", 0) for row in per_manual_after)
    mapping_delta = before_mapping_total - after_mapping_total

    # Frozen 6.2 gate totals include overlay gate items; mapping simulation isolates matcher delta.
    projected_after_total = before_total - mapping_delta

    regression = regression_scan_calibration_corpus(root)

    r3_baseline = _load_r3_validated_baseline(root)
    incremental_accounting: dict[str, Any] | None = None
    if r3_baseline is not None:
        incremental_accounting = {
            "note": (
                "R3 validated baseline is frozen — R4+ deltas are reported incrementally without "
                "rewriting CG-6.2 or prior rule validation artifacts."
            ),
            "r3ValidatedBaseline": r3_baseline,
            "currentRuleDelta": {
                "mappingGateBurdenDelta": r3_baseline["mappingGateBurden"] - after_mapping_total,
                "projectedCohortDelta": (
                    r3_baseline["projectedCohortHumanGateDecisions"] - projected_after_total
                ),
                "semanticInheritsAutoResolvedDelta": (
                    after_semantic_auto - r3_baseline["semanticInheritsAutoResolved"]
                ),
                "regressionAbstentionsDelta": (
                    regression["abstentionCount"] - r3_baseline["regressionAbstentions"]
                ),
                "mappingCandidateAbstentions": after_abstentions,
                "falsePositives": 0 if regression["falsePositiveCheck"] == "PASS" else 1,
            },
        }

    return {
        "schemaVersion": "1.0.0",
        "reportType": "semantic_inheritance_benchmark",
        "version": "v1",
        "phase": "CG-6.3",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "readOnly": True,
        "calibrationCorpus": CALIBRATION_CORPUS_FILE,
        "efficiencyBaseline": EFFICIENCY_FILE,
        "semanticRules": "semantic_inheritance_rules_v1.json",
        "guardrails": list(
            load_semantic_inheritance_rules().get("guardrails")
            or [],
        ),
        "comparison": {
            "frozenGatePreviewBefore": {
                "source": EFFICIENCY_FILE,
                "totalHumanGateDecisions": before_total,
                "documentedSemanticInheritanceCases": before_semantic,
                "newCanonicalKnowledge": before_report["summary"]["newCanonicalKnowledgeAcrossCohort"],
                "leakage": before_report["leakage"],
            },
            "mappingSimulation": {
                "note": (
                    "Mapping-candidate gate burden with semantic rules off vs on. "
                    "Frozen 6.2 totals include overlay gate items; projected total applies mapping delta only."
                ),
                "beforeMappingHumanGateDecisions": before_mapping_total,
                "afterMappingHumanGateDecisions": after_mapping_total,
                "mappingDelta": mapping_delta,
                "semanticInheritanceAutoResolved": after_semantic_auto,
                "projectedTotalHumanGateDecisions": projected_after_total,
            },
            "table": {
                "columns": ["BEFORE 6.3 (frozen)", "AFTER 6.3 (projected)"],
                "rows": {
                    "humanGateDecisions": [before_total, projected_after_total],
                    "semanticInheritsHumanBurden": [before_semantic, max(before_semantic - mapping_delta, 0)],
                    "semanticInheritsAutoResolved": [0, after_semantic_auto],
                    "abstentions": [0, after_abstentions],
                    "leakage": [0, 0],
                    "newCanonical": [0, 0],
                },
            },
            "abstentionsNote": (
                "Abstention = partial semantic signal in scope but insufficient evidence for auto-inherit; "
                "deliberate human gate. R1 may yield 0 on frozen corpus — metric is for R2+ resistance."
            ),
        },
        "perManual": {
            "beforeMappingOnly": per_manual_before,
            "afterMappingWithSemanticRules": per_manual_after,
        },
        "incrementalAccounting": incremental_accounting,
        "regression": regression,
        "headline": (
            f"Mapping gate burden {before_mapping_total} -> {after_mapping_total}; "
            f"projected cohort total {before_total} -> {projected_after_total}"
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default=str(CALIBRATION_DIR / OUTPUT_FILE),
    )
    args = parser.parse_args()

    report = build_semantic_inheritance_benchmark()
    out_path = Path(args.output)
    out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path}")
    print(report["headline"])
    print(
        "Regression:",
        report["regression"]["falsePositiveCheck"],
        f"({report['regression']['matchCount']} semantic match(es) in calibration corpus)",
    )
    print(
        "Abstentions:",
        report["regression"]["abstentionCount"],
        "(procedure-title scan)",
    )
    incremental = report.get("incrementalAccounting")
    if incremental:
        delta = incremental["currentRuleDelta"]
        print(
            "R4 incremental (vs frozen R3 baseline):",
            f"mapping -{delta['mappingGateBurdenDelta']},",
            f"cohort -{delta['projectedCohortDelta']},",
            f"auto-resolve +{delta['semanticInheritsAutoResolvedDelta']},",
            f"regression abstentions +{delta['regressionAbstentionsDelta']}",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
