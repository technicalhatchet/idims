#!/usr/bin/env python3
"""CG-5.4 — Approve cross-manual alias families from gap report (preserve each OEM term)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.alias_families import (  # noqa: E402
    approve_alias_family,
    approve_all_alias_families_from_gap,
    collect_alias_family_candidates,
    load_alias_families_from_gap_report,
    summarize_alias_family,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    list_cmd = sub.add_parser("list", help="List alias families from gap report")
    list_cmd.set_defaults(func="list")

    show = sub.add_parser("show", help="Show candidates for one canonical id")
    show.add_argument("canonical_id")
    show.set_defaults(func="show")

    approve_one = sub.add_parser("approve", help="Approve one alias family")
    approve_one.add_argument("canonical_id")
    approve_one.add_argument("--reviewer", default="alias-family")
    approve_one.add_argument("--dry-run", action="store_true")
    approve_one.set_defaults(func="approve_one")

    approve_all = sub.add_parser("approve-all", help="Approve all 12 washer alias families")
    approve_all.add_argument("--reviewer", default="alias-family")
    approve_all.add_argument("--dry-run", action="store_true")
    approve_all.set_defaults(func="approve_all")

    args = parser.parse_args()

    if args.func == "list":
        families = load_alias_families_from_gap_report()
        print(f"{'Canonical':<24} {'Manuals':>8} {'Mfrs':>6} {'Sample OEM terms'}")
        for family in families:
            terms = ", ".join((family.get("sampleTerms") or [])[:4])
            print(
                f"{family.get('canonicalId', ''):<24} "
                f"{family.get('manualCount', 0):>8} "
                f"{family.get('manufacturerCount', 0):>6} "
                f"{terms}",
            )
        print(f"\n{len(families)} alias families")
        return 0

    if args.func == "show":
        candidates = collect_alias_family_candidates(args.canonical_id)
        print(json.dumps(summarize_alias_family(args.canonical_id, candidates), indent=2))
        print(f"\n{candidates}")
        return 0

    if args.func == "approve_one":
        result = approve_alias_family(
            args.canonical_id,
            reviewer=args.reviewer,
            dry_run=args.dry_run,
        )
        print(json.dumps(result, indent=2))
        return 0

    if args.func == "approve_all":
        result = approve_all_alias_families_from_gap(
            reviewer=args.reviewer,
            dry_run=args.dry_run,
        )
        print(f"Families: {result['familyCount']}")
        print(f"Approved: {result['totalApproved']} candidates")
        if args.dry_run:
            print("(dry run — no ledger changes)")
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
