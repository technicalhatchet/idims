#!/usr/bin/env python3
"""CG-5.3 — Corpus expansion and canonical ontology gap analysis."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.calibration.gap_analyzer import (  # noqa: E402
    analyze_corpus_gaps,
    format_gap_report_text,
)
from normalization.paths import CALIBRATION_DIR  # noqa: E402
from normalization.pipeline import (  # noqa: E402
    load_manifest,
    run_global_conflict_pass,
    run_manual_normalization,
    write_global_conflicts,
)
from normalization.review.ledger import load_ledger  # noqa: E402
from normalization.review.review_package import materialize_review_package  # noqa: E402

PROMOTION_BATCH_ORDER = [
    {
        "batchId": "whirlpool_fl",
        "label": "Whirlpool FL washer families",
        "manufacturer": "Whirlpool",
        "platformPatterns": ["whirlpool_fl", "whirlpool_duet_sport", "whirlpool_connected"],
        "exampleManuals": ["W8178558", "W11169652"],
    },
    {
        "batchId": "samsung_fl",
        "label": "Samsung FL washer families",
        "manufacturer": "Samsung",
        "platformPatterns": ["samsung_fl"],
        "exampleManuals": ["SAMSUNG-FL-BB8700-WASHER", "SAMSUNG-FL-WF6000R-WASHER"],
    },
    {
        "batchId": "samsung_tl",
        "label": "Samsung TL washer families",
        "manufacturer": "Samsung",
        "platformPatterns": ["samsung_tl"],
        "exampleManuals": ["SAMSUNG-TL-A50-WASHER", "SAMSUNG-TL-CG71-WASHER"],
    },
]


def _filter_entries(template: str | None, all_manuals: bool) -> list[dict]:
    entries = load_manifest().get("manuals", [])
    if all_manuals:
        return entries
    if template:
        return [entry for entry in entries if entry.get("templateId") == template]
    return entries


def _run_pipeline(entries: list[dict]) -> None:
    manual_runs = []
    for entry in entries:
        manual_id = entry.get("manualId")
        print(f"  normalizing {manual_id} ({entry.get('platformId')})")
        manual_runs.append(run_manual_normalization(entry))
    if len(manual_runs) > 1:
        write_global_conflicts(run_global_conflict_pass(manual_runs))


def _materialize_reviews(entries: list[dict]) -> None:
    ledger = load_ledger()
    for entry in entries:
        manual_id = entry.get("manualId")
        package = materialize_review_package(manual_id, ledger)
        print(f"  review {manual_id}: {package['summary']['total']} records")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--template", default="washer", help="Template filter (default: washer)")
    parser.add_argument("--all", action="store_true", help="Analyze entire manifest corpus")
    parser.add_argument("--normalize", action="store_true", help="Re-run CG-3 pipeline first")
    parser.add_argument("--materialize", action="store_true", help="Refresh CG-4 review packages")
    parser.add_argument("--version", default="v1", help="Report version label")
    parser.add_argument("--json-only", action="store_true", help="Skip text summary")
    args = parser.parse_args()

    entries = _filter_entries(None if args.all else args.template, args.all)
    if not entries:
        print("No manuals matched.", file=sys.stderr)
        return 1

    if args.normalize:
        print(f"==> CG-3 normalize ({len(entries)} manuals)")
        _run_pipeline(entries)

    if args.materialize or args.normalize:
        print("==> CG-4 materialize review packages")
        _materialize_reviews(entries)

    template_filter = None if args.all else args.template
    report = analyze_corpus_gaps(template_id=template_filter)
    report["corpusManualsRequested"] = len(entries)
    report["promotionBatchOrder"] = PROMOTION_BATCH_ORDER

    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    suffix = "" if args.all else f"_{args.template}"
    json_path = CALIBRATION_DIR / f"canonical_gap_report_{args.version}{suffix}.json"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    text_path = CALIBRATION_DIR / f"canonical_gap_report_{args.version}{suffix}.txt"
    text_path.write_text(format_gap_report_text(report), encoding="utf-8")

    if not args.json_only:
        print(format_gap_report_text(report))
        print(f"\nWrote {json_path}")
        print(f"Wrote {text_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
