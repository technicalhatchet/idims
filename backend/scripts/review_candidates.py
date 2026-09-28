#!/usr/bin/env python3
"""CG-4 — Human-gated candidate review (CLI, no UI)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.ledger import load_ledger, update_candidate_status
from normalization.review.review_package import (
    load_review_package,
    materialize_review_package,
)


def cmd_materialize(args: argparse.Namespace) -> int:
    ledger = load_ledger()
    if args.manual:
        package = materialize_review_package(args.manual, ledger)
        print(f"Materialized {args.manual}: {package['summary']['total']} review records")
        return 0

    from normalization.paths import CANDIDATES_DIR

    for manual_dir in sorted(CANDIDATES_DIR.iterdir()):
        if not manual_dir.is_dir() or manual_dir.name.startswith("_"):
            continue
        package = materialize_review_package(manual_dir.name, ledger)
        print(f"  {manual_dir.name}: {package['summary']['total']} records")
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    package = load_review_package(args.manual)
    records = package.get("records", [])
    if args.status:
        records = [r for r in records if r.get("status") == args.status]
    if args.level:
        records = [r for r in records if r.get("approvalLevel") == args.level]

    for record in records:
        print(
            f"{record.get('candidateId')}\t"
            f"{record.get('status')}\t"
            f"{record.get('approvalLevel')}\t"
            f"{record.get('candidateType')}\t"
            f"{record.get('what')} → {record.get('mapsTo')}",
        )
    print(f"\n{len(records)} record(s)")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    package = load_review_package(args.manual)
    record = next(
        (r for r in package.get("records", []) if r.get("candidateId") == args.candidate_id),
        None,
    )
    if not record:
        print(f"Candidate not found: {args.candidate_id}", file=sys.stderr)
        return 1
    print(json.dumps(record, indent=2))
    return 0


def _set_status(args: argparse.Namespace, status: str) -> int:
    update_candidate_status(
        args.candidate_id,
        status,
        reviewer=args.reviewer,
        reason=args.reason,
        manual_id=args.manual,
    )
    materialize_review_package(args.manual, load_ledger())
    print(f"{args.candidate_id} → {status}")
    return 0


def cmd_auto_approve_easy(args: argparse.Namespace) -> int:
    package = load_review_package(args.manual)
    count = 0
    for record in package.get("records", []):
        if record.get("approvalLevel") != "easy":
            continue
        if record.get("status") not in {"candidate", "needs_review"}:
            continue
        if args.dry_run:
            print(f"would approve: {record.get('candidateId')}")
        else:
            update_candidate_status(
                record["candidateId"],
                "approved",
                reviewer=args.reviewer or "auto-easy",
                reason="auto-approved (easy alias)",
                manual_id=args.manual,
            )
        count += 1
    if not args.dry_run:
        materialize_review_package(args.manual, load_ledger())
    print(f"{'Would approve' if args.dry_run else 'Approved'} {count} easy candidate(s)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    materialize = sub.add_parser("materialize", help="Build review packages from CG-3 candidates")
    materialize.add_argument("--manual")
    materialize.set_defaults(func=cmd_materialize)

    list_cmd = sub.add_parser("list", help="List review records")
    list_cmd.add_argument("--manual", required=True)
    list_cmd.add_argument("--status")
    list_cmd.add_argument("--level")
    list_cmd.set_defaults(func=cmd_list)

    show = sub.add_parser("show", help="Show one review record as JSON")
    show.add_argument("--manual", required=True)
    show.add_argument("candidate_id")
    show.set_defaults(func=cmd_show)

    def _make_status_handler(status: str):
        def handler(cli_args: argparse.Namespace) -> int:
            return _set_status(cli_args, status)
        return handler

    for name, status in [
        ("approve", "approved"),
        ("reject", "rejected"),
        ("needs-review", "needs_review"),
    ]:
        cmd = sub.add_parser(name)
        cmd.add_argument("--manual", required=True)
        cmd.add_argument("candidate_id")
        cmd.add_argument("--reviewer", default="cli")
        cmd.add_argument("--reason")
        cmd.set_defaults(func=_make_status_handler(status))

    auto = sub.add_parser("auto-approve-easy", help="Approve easy alias candidates")
    auto.add_argument("--manual", required=True)
    auto.add_argument("--reviewer", default="auto-easy")
    auto.add_argument("--dry-run", action="store_true")
    auto.set_defaults(func=cmd_auto_approve_easy)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
