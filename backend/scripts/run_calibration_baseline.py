#!/usr/bin/env python3
"""CG-5 — Versioned corpus normalization baseline (measurement + tuning, not mass promotion)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.calibration.baseline_metrics import (  # noqa: E402
    collect_baseline_metrics,
    compare_baselines,
    write_baseline,
)
from normalization.paths import CALIBRATION_DIR  # noqa: E402
from normalization.pipeline import (  # noqa: E402
    load_manifest,
    run_global_conflict_pass,
    run_manual_normalization,
    write_global_conflicts,
)


def _filter_manual_ids(template: str | None) -> list[str] | None:
    if not template:
        return None
    manifest = load_manifest()
    return [
        entry["manualId"]
        for entry in manifest.get("manuals", [])
        if entry.get("templateId") == template
    ]


def _run_normalization(template: str | None) -> None:
    manifest = load_manifest()
    entries = manifest.get("manuals", [])
    if template:
        entries = [entry for entry in entries if entry.get("templateId") == template]

    manual_runs = []
    for entry in entries:
        manual_id = entry.get("manualId")
        print(f"  normalizing {manual_id} ({entry.get('platformId')})")
        manual_runs.append(run_manual_normalization(entry))

    if len(manual_runs) > 1:
        global_conflicts = run_global_conflict_pass(manual_runs)
        write_global_conflicts(global_conflicts)
        print(f"  global conflicts: {len(global_conflicts)}")


def _print_summary(metrics: dict) -> None:
    quality = metrics.get("qualityIndicators") or {}
    print("\n=== CG-5 Baseline Metrics ===")
    print(f"Manuals normalized:     {metrics.get('manuals')}")
    print(f"Total candidates:       {metrics.get('candidates')}")
    print(f"  Aliases/mappings:     {metrics.get('byType', {}).get('canonicalMapping', 0)}")
    print(f"  Procedure bindings:   {metrics.get('byType', {}).get('procedureTestBinding', 0)}")
    print(f"  Measurement binds:    {metrics.get('byType', {}).get('measurementBinding', 0)}")
    print(f"Compound candidates:    {metrics.get('compoundCandidates', 0)}")
    print(f"Blocked:                {metrics.get('byApprovalLevel', {}).get('blocked', 0)}")
    print(f"Careful review:         {metrics.get('byApprovalLevel', {}).get('careful', 0)}")
    print(f"Promotion-ready:        {metrics.get('promotionReady', 0)}")
    print(f"Already in overlay:     {metrics.get('alreadyPublished', 0)}")
    print(f"Global conflicts:       {metrics.get('globalConflicts', {}).get('total', 0)}")
    print(f"Extraction filtered:    {metrics.get('extractionFiltered', 0)}")
    print(f"  Procedural noise:     {metrics.get('extractionFilteredProcedural', 0)}")
    print(f"  Structural tokens:    {metrics.get('extractionFilteredStructural', 0)}")
    print("\nBlocked by reason:")
    for key, count in sorted((metrics.get("byBlockedReason") or {}).items()):
        print(f"  {key}: {count}")
    print("\nQuality indicators:")
    for key, value in sorted(quality.items()):
        print(f"  {key}: {value}")
    print("\nTop unresolved terms:")
    for term, count in metrics.get("unresolvedTermsTop", [])[:10]:
        print(f"  {term}: {count}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="v1", help="Baseline version label (e.g. v1)")
    parser.add_argument("--template", help="Filter by templateId (e.g. washer)")
    parser.add_argument(
        "--normalize",
        action="store_true",
        help="Re-run CG-3 normalization before collecting metrics",
    )
    parser.add_argument(
        "--materialize",
        action="store_true",
        help="Force refresh CG-4 review packages",
    )
    parser.add_argument(
        "--compare",
        help="Compare against an existing baseline version (e.g. v1)",
    )
    parser.add_argument(
        "--matcher-version",
        default="cg5-v1",
        help="Matcher version tag stored in baseline metadata",
    )
    args = parser.parse_args()

    if args.normalize:
        print("==> Running CG-3 normalization")
        _run_normalization(args.template)

    manual_ids = _filter_manual_ids(args.template)
    metrics = collect_baseline_metrics(
        manual_ids=manual_ids,
        materialize_reviews=args.materialize or True,
    )
    path = write_baseline(
        metrics,
        args.version,
        template_filter=args.template,
        matcher_version=args.matcher_version,
    )
    _print_summary(metrics)
    print(f"\nWrote baseline: {path}")

    if args.compare:
        compare_name = f"normalization_metrics_{args.compare}.json"
        if args.template:
            compare_name = f"normalization_metrics_{args.compare}_{args.template}.json"
        compare_path = CALIBRATION_DIR / compare_name
        if compare_path.is_file():
            before = json.loads(compare_path.read_text(encoding="utf-8"))
            after = json.loads(path.read_text(encoding="utf-8"))
            comparison = compare_baselines(before, after)
            print("\n=== Baseline comparison ===")
            print(json.dumps(comparison, indent=2))
        else:
            print(f"\nCompare baseline not found: {compare_path}", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
