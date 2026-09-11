#!/usr/bin/env python3
"""Run generate → attach → registry codegen → validate for a registered service manual."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = (
    ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "procedures"
    / "procedureManualManifest.json"
)


def load_manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def find_manual(manifest: dict, manual_id: str) -> dict:
    for entry in manifest.get("manuals", []):
        if entry.get("manualId") == manual_id:
            return entry
    raise SystemExit(f"Manual '{manual_id}' not found in {MANIFEST_PATH.relative_to(ROOT)}")


def run_script(relative_path: str | None, label: str) -> None:
    if not relative_path:
        return
    script = ROOT / relative_path
    if not script.is_file():
        raise SystemExit(f"{label} script not found: {script.relative_to(ROOT)}")
    print(f"\n==> {label}: {script.relative_to(ROOT)}")
    subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manual",
        required=True,
        help="manualId from procedureManualManifest.json (e.g. W11169652)",
    )
    parser.add_argument(
        "--skip-generate",
        action="store_true",
        help="Skip seed generation; only attach, codegen registry, and validate.",
    )
    args = parser.parse_args()

    if not MANIFEST_PATH.is_file():
        print(f"Manifest not found: {MANIFEST_PATH}", file=sys.stderr)
        return 1

    manual = find_manual(load_manifest(), args.manual)
    pipeline = manual.get("pipeline") or {}

    print(
        f"Procedure pipeline for {manual['manualId']} "
        f"({manual['platformId']} / {manual['templateId']})"
    )

    if not args.skip_generate:
        run_script(pipeline.get("generate"), "Generate procedure seeds")

    run_script(pipeline.get("attachDiagrams"), "Attach diagram assets")
    run_script(pipeline.get("attachAccessDiagrams"), "Attach access diagram assets")
    run_script(pipeline.get("attachDiagnosticEffects"), "Attach diagnostic effects")
    run_script(pipeline.get("attachServiceModes"), "Attach service modes")

    registry_script = ROOT / "backend" / "scripts" / "generate_procedure_registry.py"
    print(f"\n==> Codegen registry: {registry_script.relative_to(ROOT)}")
    subprocess.run([sys.executable, str(registry_script)], check=True, cwd=ROOT)

    validate_script = ROOT / "backend" / "scripts" / "validate_procedure_seed.py"
    print(f"\n==> Validate seeds: {validate_script.relative_to(ROOT)}")
    subprocess.run([sys.executable, str(validate_script)], check=True, cwd=ROOT)

    print(f"\nDone — {manual['manualId']} pipeline complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
