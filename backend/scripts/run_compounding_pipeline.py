#!/usr/bin/env python3
"""CG-5.4 — Normalize, gap-check, and measure compounding for a manual (no approve-all)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from human_decision_metrics import (
    WHIRLPOOL_TL_PRIOR_ORDER,
    compare_compounding,
    collect_manual_decision_metrics,
    format_tl_platform_compounding_report,
    resolve_promotion_prior_manual_ids,
    write_tl_platform_compounding_report,
)
from normalization.calibration.gap_analyzer import analyze_corpus_gaps
from normalization.paths import CALIBRATION_DIR
from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization
from normalization.promotion.planner import resolve_overlay_target
from normalization.review.ledger import load_ledger
from normalization.review.review_package import materialize_review_package
from run_compiler_loop import run_compiler_loop

WHIRLPOOL_FL_BASELINE = "W8178558"


def run_compounding_pipeline(
    manual_id: str,
    *,
    baseline_manual_id: str = WHIRLPOOL_FL_BASELINE,
    prior_manual_ids: list[str] | None = None,
    dry_run_promotion: bool = True,
    publish: bool = False,
    run_ds7: bool = False,
) -> dict:
    manifest = load_manifest()
    entry = find_manual_entry(manifest, manual_id)
    target = resolve_overlay_target(manual_id, entry.get("platformId"))

    print(f"==> CG-3 normalize {manual_id}")
    run_manual_normalization(entry)

    print("==> CG-5.3 gap analysis (washer corpus)")
    gap_report = analyze_corpus_gaps(template_id="washer")
    gap_path = CALIBRATION_DIR / f"canonical_gap_report_compounding_{manual_id}.json"
    gap_path.write_text(json.dumps(gap_report, indent=2), encoding="utf-8")
    buckets = gap_report.get("buckets") or {}
    gap_summary = {
        "canonical_alias": len(buckets.get("canonical_alias") or []),
        "canonical_ontology_candidate": len(buckets.get("canonical_ontology_candidate") or []),
        "platform_overlay": len(buckets.get("platform_overlay") or []),
        "human_review": len(buckets.get("human_review") or []),
        "unresolved": len(buckets.get("unresolved") or []),
    }
    print(f"    alias={gap_summary['canonical_alias']} "
          f"ontology={gap_summary['canonical_ontology_candidate']} "
          f"platform={gap_summary['platform_overlay']} "
          f"unresolved={gap_summary['unresolved']}")

    print("==> CG-4 materialize review (no approve-all)")
    package = materialize_review_package(manual_id, load_ledger())
    print(f"    {package['summary']['total']} review records")

    if prior_manual_ids is None:
        prior_manual_ids = resolve_promotion_prior_manual_ids(manual_id) or [baseline_manual_id]

    metrics = collect_manual_decision_metrics(
        manual_id,
        prior_manual_ids=prior_manual_ids,
    )
    tl_platform_report = None
    if manual_id in set(WHIRLPOOL_TL_PRIOR_ORDER):
        tl_report_path = write_tl_platform_compounding_report()
        tl_platform_report = json.loads(tl_report_path.read_text(encoding="utf-8"))
    comparison = compare_compounding(
        baseline_manual_id,
        manual_id,
        prior_manual_ids=prior_manual_ids,
    )

    promotion_result = None
    if dry_run_promotion or publish:
        print("==> compiler loop (no auto-approve)")
        promotion_result = run_compiler_loop(
            manual_id,
            publish=publish,
            auto_approve=False,
        )

    report = {
        "manualId": manual_id,
        "platformFamilyId": target["platformFamilyId"],
        "overlayFile": target["overlayFile"],
        "gapSummary": gap_summary,
        "gapReportPath": str(gap_path),
        "reviewSummary": package.get("summary"),
        "metrics": metrics,
        "compoundingComparison": comparison,
        "tlPlatformCompounding": tl_platform_report,
        "promotion": promotion_result,
        "published": publish,
    }

    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    out = CALIBRATION_DIR / f"compounding_pipeline_{manual_id}.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {out}")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manual", default="W11169652")
    parser.add_argument("--baseline", default=WHIRLPOOL_FL_BASELINE)
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--skip-promotion", action="store_true")
    parser.add_argument("--run-ds7", action="store_true")
    args = parser.parse_args()

    report = run_compounding_pipeline(
        args.manual,
        baseline_manual_id=args.baseline,
        dry_run_promotion=not args.skip_promotion,
        publish=args.publish,
        run_ds7=args.run_ds7,
    )

    metrics = report.get("metrics") or {}
    knowledge = metrics.get("knowledgeClassification") or {}
    print(
        f"\n{args.manual}: "
        f"records={metrics.get('totalReviewRecords')} "
        f"approved={metrics.get('approved')} "
        f"newHumanDecisions={metrics.get('newHumanDecisionCount')} "
        f"inherited={metrics.get('inheritedResolvedAutomatically')} "
        f"tlPlatformInherited={knowledge.get('inheritedPlatformFamilyKnowledge')} "
        f"flCorpusInherited={knowledge.get('inheritedCorpusKnowledge')} "
        f"newPlatform={knowledge.get('newPlatformKnowledge')} "
        f"newModelSpecific={knowledge.get('newModelSpecificKnowledge')} "
        f"newCanonical={knowledge.get('newCanonicalKnowledge')}",
    )

    if report.get("promotion"):
        equiv = (report["promotion"].get("equivalence") or {}).get("equivalent")
        print(f"promotion_equivalence={equiv}")

    tl_report = report.get("tlPlatformCompounding")
    if tl_report:
        print()
        print(format_tl_platform_compounding_report(tl_report))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
