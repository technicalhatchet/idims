#!/usr/bin/env python3
"""CG-4 — Corpus metrics across normalized / reviewed candidates."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CANDIDATES_DIR, REVIEW_DIR
from normalization.pipeline import load_manifest
from normalization.review.ledger import load_ledger
from normalization.review.review_package import materialize_review_package, summarize_review_records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--template", help="Filter by templateId (e.g. washer)")
    parser.add_argument("--materialize", action="store_true", help="Refresh review packages first")
    args = parser.parse_args()

    manifest = load_manifest()
    manual_ids = [m["manualId"] for m in manifest.get("manuals", [])]
    if args.template:
        manual_ids = [
            m["manualId"]
            for m in manifest.get("manuals", [])
            if m.get("templateId") == args.template
        ]

    ledger = load_ledger()
    totals = {
        "manuals": 0,
        "candidates": 0,
        "aliases": 0,
        "procedureBindings": 0,
        "measurementBindings": 0,
        "relationships": 0,
        "conflicts": 0,
        "byApprovalLevel": {},
        "byStatus": {},
        "byConfidenceBucket": {
            "high_gte_0.95": 0,
            "medium_0.80_0.94": 0,
            "low_lt_0.80": 0,
            "unresolved": 0,
        },
    }

    candidate_dirs = [
        path for path in CANDIDATES_DIR.iterdir()
        if path.is_dir() and not path.name.startswith("_")
    ]
    if args.template:
        candidate_dirs = [
            path for path in candidate_dirs if path.name in manual_ids
        ]

    for manual_dir in sorted(candidate_dirs):
        manual_id = manual_dir.name
        totals["manuals"] += 1

        if args.materialize or not (REVIEW_DIR / f"{manual_id}_review.json").is_file():
            package = materialize_review_package(manual_id, ledger)
        else:
            package = json.loads(
                (REVIEW_DIR / f"{manual_id}_review.json").read_text(encoding="utf-8"),
            )

        summary = package.get("summary") or summarize_review_records(package.get("records", []))
        totals["candidates"] += summary.get("total", 0)

        for key, count in (summary.get("byType") or {}).items():
            if key == "canonicalMapping":
                totals["aliases"] += count
            elif key == "procedureTestBinding":
                totals["procedureBindings"] += count
            elif key == "measurementBinding":
                totals["measurementBindings"] += count
            else:
                totals["relationships"] += count

        for record in package.get("records", []):
            totals["conflicts"] += len(record.get("conflicts") or [])

        for key, count in (summary.get("byApprovalLevel") or {}).items():
            totals["byApprovalLevel"][key] = totals.get("byApprovalLevel", {}).get(key, 0) + count
        for key, count in (summary.get("byStatus") or {}).items():
            totals["byStatus"][key] = totals.get("byStatus", {}).get(key, 0) + count
        for key, count in (summary.get("byConfidenceBucket") or {}).items():
            totals["byConfidenceBucket"][key] += count

    print("=== Normalization / Review Metrics ===")
    print(f"Manuals:              {totals['manuals']}")
    print(f"Total candidates:     {totals['candidates']}")
    print(f"  Aliases:            {totals['aliases']}")
    print(f"  Procedure bindings: {totals['procedureBindings']}")
    print(f"  Measurement binds:  {totals['measurementBindings']}")
    print(f"  Relationships:      {totals['relationships']}")
    print(f"Conflict refs:        {totals['conflicts']} (informational attachments)")
    print("\nBy approval level:")
    for key, count in sorted(totals["byApprovalLevel"].items()):
        print(f"  {key}: {count}")
    print("\nBy status:")
    for key, count in sorted(totals["byStatus"].items()):
        print(f"  {key}: {count}")
    print("\nConfidence buckets:")
    for key, count in totals["byConfidenceBucket"].items():
        print(f"  {key}: {count}")

    if totals["candidates"]:
        easy = totals["byApprovalLevel"].get("easy", 0)
        print(f"\nEasy-alias share: {round(100 * easy / totals['candidates'], 1)}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
