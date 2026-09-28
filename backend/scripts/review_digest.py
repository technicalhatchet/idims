#!/usr/bin/env python3
"""CG-4/5 — Human review digest + batch apply (no JSON spelunking)."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, REVIEW_DIR
from normalization.review.ledger import load_ledger, update_candidate_status
from normalization.review.review_package import load_review_package, materialize_review_package
from resolve_manual_terms import apply_resolutions

TL_TEST_TARGET_REMAP = {
    "door_lock_test": "lid_lock_test",
}


def _needs_human(record: dict) -> bool:
    status = record.get("status")
    level = record.get("approvalLevel")
    if status in {"approved", "promoted", "rejected"}:
        return False
    if level in {"blocked", "careful"}:
        return True
    if level == "normal" and status in {"candidate", "needs_review"}:
        return True
    if level == "easy" and status in {"candidate", "needs_review"}:
        return True
    return False


def _action_bucket(record: dict) -> str:
    level = record.get("approvalLevel")
    ctype = record.get("candidateType")
    if level in {"blocked", "careful"} and ctype == "canonicalMapping":
        return "term_resolution"
    if level == "normal":
        return "procedure_binding"
    if level == "easy":
        return "easy_alias"
    return "other"


def _format_why(record: dict) -> str:
    why = record.get("why")
    if isinstance(why, dict):
        return str(why.get("summary") or why.get("matcherLayer") or "")
    return str(why or "")


def _load_term_manifest(manual_id: str) -> dict | None:
    path = CALIBRATION_DIR / f"{manual_id.lower()}_term_resolutions.json"
    if not path.is_file():
        path = CALIBRATION_DIR / f"{manual_id}_term_resolutions.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def build_digest(manual_id: str) -> dict:
    package = load_review_package(manual_id)
    records = package.get("records") or []
    manifest = _load_term_manifest(manual_id)
    resolution_by_id = {
        row["candidateId"]: row for row in (manifest or {}).get("resolutions") or []
    }

    buckets: dict[str, list[dict]] = {
        "term_resolution": [],
        "procedure_binding": [],
        "easy_alias": [],
        "other": [],
        "no_action": [],
    }

    for record in records:
        bucket = _action_bucket(record) if _needs_human(record) else "no_action"
        entry = {
            "candidateId": record.get("candidateId"),
            "what": record.get("what"),
            "mapsTo": record.get("mapsTo"),
            "status": record.get("status"),
            "approvalLevel": record.get("approvalLevel"),
            "candidateType": record.get("candidateType"),
            "why": _format_why(record),
            "proposedChange": record.get("proposedChange"),
        }
        if bucket == "term_resolution":
            resolution = resolution_by_id.get(record.get("candidateId"))
            if resolution:
                entry["recommendedCanonicalId"] = resolution.get("canonicalId")
                entry["classification"] = resolution.get("classification")
                entry["rationale"] = resolution.get("rationale")
        buckets[bucket].append(entry)

    summary = {
        "total": len(records),
        "needsHuman": sum(len(buckets[k]) for k in buckets if k != "no_action"),
        "termResolutions": len(buckets["term_resolution"]),
        "procedureBindings": len(buckets["procedure_binding"]),
        "easyAliases": len(buckets["easy_alias"]),
        "alreadyDone": len(buckets["no_action"]),
        "byStatus": dict(Counter(r.get("status") for r in records)),
        "byLevel": dict(Counter(r.get("approvalLevel") for r in records)),
    }

    return {
        "manualId": manual_id,
        "platformId": package.get("platformId"),
        "ontologyId": package.get("ontologyId"),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "buckets": buckets,
        "termManifest": str(CALIBRATION_DIR / f"{manual_id.lower()}_term_resolutions.json"),
        "hasTermManifest": manifest is not None,
    }


def format_digest_markdown(digest: dict) -> str:
    manual_id = digest["manualId"]
    summary = digest["summary"]
    lines = [
        f"# {manual_id} review digest",
        "",
        f"Platform: `{digest.get('platformId')}` · Ontology: `{digest.get('ontologyId')}`",
        "",
        "## Your job (~15 minutes)",
        "",
        "1. Skim the **term resolution** table below (the only real decisions).",
        "2. Edit the term manifest if you disagree with any recommendation.",
        "3. Run the three commands at the bottom.",
        "",
        "## Summary",
        "",
        f"| Bucket | Count | Action |",
        f"|--------|------:|--------|",
        f"| Term resolutions (blocked/careful) | {summary['termResolutions']} | Skim table, edit manifest if needed |",
        f"| Procedure/measurement bindings | {summary['procedureBindings']} | Batch-approve (mechanical) |",
        f"| Easy aliases | {summary['easyAliases']} | Auto-approve |",
        f"| Already done / inherited | {summary['alreadyDone']} | None |",
        f"| **Total records** | {summary['total']} | |",
        "",
    ]

    if digest.get("hasTermManifest"):
        lines.extend(
            [
                "## Term resolutions",
                "",
                "Manifest: `" + digest["termManifest"] + "`",
                "",
                "| OEM term | Recommend | Classification | Rationale |",
                "|----------|-----------|----------------|-----------|",
            ],
        )
        for row in digest["buckets"]["term_resolution"]:
            lines.append(
                f"| {row.get('what')} | `{row.get('recommendedCanonicalId') or row.get('mapsTo') or '?'}` "
                f"| {row.get('classification') or '?'} "
                f"| {(row.get('rationale') or '')[:80]} |",
            )
        lines.append("")

    if digest["buckets"]["procedure_binding"]:
        lines.extend(["## Procedure bindings (batch-approve)", ""])
        for row in digest["buckets"]["procedure_binding"]:
            value = (row.get("proposedChange") or {}).get("value") or {}
            target = value.get("testTargetId") or value.get("measurementKnowledgeId")
            lines.append(
                f"- `{value.get('procedureId')}` -> `{target}` ({row.get('candidateType')})",
            )
        lines.append("")

    lines.extend(
        [
            "## Commands",
            "",
            "```bash",
            f"# 1) Apply term resolutions (after optional manifest edit)",
            f"python backend/scripts/resolve_manual_terms.py "
            f"--manifest frontend/components/diagnostics/knowledge/normalization/calibration/{manual_id.lower()}_term_resolutions.json",
            "",
            f"# 2) Batch-approve mechanical bindings",
            f"python backend/scripts/review_digest.py apply-bindings --manual {manual_id}",
            "",
            f"# 3) Auto-approve easy aliases",
            f"python backend/scripts/review_candidates.py auto-approve-easy --manual {manual_id}",
            "",
            f"# 4) Refresh digest / metrics",
            f"python backend/scripts/review_digest.py digest --manual {manual_id}",
            f"python backend/scripts/run_compounding_pipeline.py --manual {manual_id} --skip-promotion",
            "```",
            "",
        ],
    )
    return "\n".join(lines)


def write_digest(manual_id: str) -> Path:
    digest = build_digest(manual_id)
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    json_path = CALIBRATION_DIR / f"review_digest_{manual_id}.json"
    md_path = CALIBRATION_DIR / f"review_digest_{manual_id}.md"
    json_path.write_text(json.dumps(digest, indent=2), encoding="utf-8")
    md_path.write_text(format_digest_markdown(digest), encoding="utf-8")
    return md_path


def apply_bindings(
    manual_id: str,
    *,
    reviewer: str = "batch-review",
    dry_run: bool = False,
) -> dict:
    package = load_review_package(manual_id)
    ontology_id = package.get("ontologyId")
    approved = 0
    skipped = 0
    remapped = 0

    for record in package.get("records") or []:
        if record.get("approvalLevel") != "normal":
            continue
        if record.get("status") not in {"candidate", "needs_review"}:
            continue
        if record.get("candidateType") not in {"procedureTestBinding", "measurementBinding"}:
            continue

        proposed = record.get("proposedChange") or {}
        value = dict(proposed.get("value") or {})
        if ontology_id == "top_load_washer":
            target = value.get("testTargetId")
            if target in TL_TEST_TARGET_REMAP:
                value["testTargetId"] = TL_TEST_TARGET_REMAP[target]
                remapped += 1

        if dry_run:
            print(f"would approve: {record.get('candidateId')}")
            approved += 1
            continue

        update_candidate_status(
            record["candidateId"],
            "approved",
            reviewer=reviewer,
            reason="batch-approved mechanical binding",
            manual_id=manual_id,
        )
        approved += 1

    if not dry_run and approved:
        materialize_review_package(manual_id, load_ledger())

    return {
        "manualId": manual_id,
        "approved": approved,
        "skipped": skipped,
        "tlTestTargetRemapped": remapped,
        "dryRun": dry_run,
    }


def apply_all(manual_id: str, *, dry_run: bool = False) -> dict:
    manifest_path = CALIBRATION_DIR / f"{manual_id.lower()}_term_resolutions.json"
    term_result = None
    if manifest_path.is_file():
        term_result = apply_resolutions(manifest_path, dry_run=dry_run)

    binding_result = apply_bindings(manual_id, dry_run=dry_run)
    easy_count = 0
    if not dry_run:
        from review_candidates import cmd_auto_approve_easy

        class Args:
            manual = manual_id
            reviewer = "auto-easy"
            dry_run = False

        cmd_auto_approve_easy(Args())
        package = load_review_package(manual_id)
        easy_count = sum(
            1 for r in package.get("records", [])
            if r.get("approvalLevel") == "easy" and r.get("status") == "approved"
        )
    return {
        "manualId": manual_id,
        "termResolutions": term_result,
        "bindings": binding_result,
        "easyApproved": easy_count,
        "dryRun": dry_run,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    digest_cmd = sub.add_parser("digest", help="Write markdown + JSON review digest")
    digest_cmd.add_argument("--manual", required=True)
    digest_cmd.add_argument("--print", action="store_true", help="Also print markdown")

    apply_cmd = sub.add_parser("apply-bindings", help="Batch-approve normal procedure bindings")
    apply_cmd.add_argument("--manual", required=True)
    apply_cmd.add_argument("--dry-run", action="store_true")

    all_cmd = sub.add_parser("apply-all", help="Term resolutions + bindings + easy aliases")
    all_cmd.add_argument("--manual", required=True)
    all_cmd.add_argument("--dry-run", action="store_true")

    args = parser.parse_args()

    if args.command == "digest":
        path = write_digest(args.manual)
        print(f"Wrote {path}")
        if args.print:
            print()
            print(path.read_text(encoding="utf-8"))
        return 0

    if args.command == "apply-bindings":
        result = apply_bindings(args.manual, dry_run=args.dry_run)
        print(json.dumps(result, indent=2))
        return 0

    if args.command == "apply-all":
        result = apply_all(args.manual, dry_run=args.dry_run)
        print(json.dumps(result, indent=2))
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
