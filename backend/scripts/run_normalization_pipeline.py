#!/usr/bin/env python3
"""CG-3 — Generate normalization candidates from existing procedure seeds (no prod mutation)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.pipeline import (  # noqa: E402
    find_manual_entry,
    load_manifest,
    run_global_conflict_pass,
    run_manual_normalization,
    write_global_conflicts,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manual", help="manualId from procedureManualManifest.json")
    parser.add_argument("--all", action="store_true", help="Process all registered manuals")
    parser.add_argument(
        "--template",
        help="Only manuals with this templateId (e.g. washer)",
    )
    args = parser.parse_args()

    if not args.manual and not args.all:
        parser.error("Specify --manual <id> or --all")

    manifest = load_manifest()
    entries = manifest.get("manuals", [])
    if args.template:
        entries = [e for e in entries if e.get("templateId") == args.template]

    if args.manual:
        entries = [find_manual_entry(manifest, args.manual)]

    if not entries:
        print("No manuals matched.", file=sys.stderr)
        return 1

    manual_runs = []
    for entry in entries:
        manual_id = entry.get("manualId")
        print(f"\n==> Normalizing {manual_id} ({entry.get('platformId')})")
        run = run_manual_normalization(
            entry,
            global_mapping_candidates=[],
            global_overlay_candidates=[],
        )
        manual_runs.append(run)
        counts = run["manifest"]["counts"]
        print(
            f"    procedures={counts['procedures']} "
            f"mappings={counts['mappingCandidates']} "
            f"overlays={counts['overlayCandidates']} "
            f"conflicts={counts['conflicts']}",
        )

    if len(manual_runs) > 1:
        global_conflicts = run_global_conflict_pass(manual_runs)
        write_global_conflicts(global_conflicts)
        print(f"\n==> Global conflicts: {len(global_conflicts)} (see candidates/_global_conflicts.json)")

    print("\nNormalization pipeline complete — candidates only, no production overlays modified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
