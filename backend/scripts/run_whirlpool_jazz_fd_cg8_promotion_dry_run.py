#!/usr/bin/env python3
"""CG-8 WP1 — Whirlpool Jazz promotion dry-run (fail-closed, no publish)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, MANUFACTURER_OVERLAYS_DIR
from whirlpool_jazz_fd_cg8_gate_publish import (
    EXPECTED_CANONICAL_HASH,
    GATE_KIND,
    MANUAL_ID,
    OVERLAY_FILE,
    GatePublishError,
    apply_gate_delta,
    build_publication_plan,
    file_sha256,
    scaffold_overlay,
)

TABLE_PATH = CALIBRATION_DIR / "WHIRLPOOL_JAZZ_FD_overlay_mapping_table_v1.json"
LEDGER_PATH = CALIBRATION_DIR / "WHIRLPOOL_JAZZ_FD_gate_decision_ledger_v1.json"
CANONICAL_PATH = CANONICAL_DIR / "french_door_refrigerator.json"
OVERLAY_PATH = MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE
DISHWASHER_OVERLAY = MANUFACTURER_OVERLAYS_DIR / "whirlpool_dishwasher.json"


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    print("==> CG-8 Whirlpool Jazz WP1 promotion dry-run")

    if TABLE_PATH.is_file() is False or LEDGER_PATH.is_file() is False:
        print("FAIL: run apply_whirlpool_jazz_fd_cg8_human_gate.py first", file=sys.stderr)
        return 1

    table = _load(TABLE_PATH)
    ledger = _load(LEDGER_PATH)
    if table.get("status") != "gated":
        print(f"FAIL: gate table status {table.get('status')}", file=sys.stderr)
        return 1
    if ledger.get("gateKind") != GATE_KIND:
        print(f"FAIL: gateKind {ledger.get('gateKind')}", file=sys.stderr)
        return 1

    canonical_hash_before = file_sha256(CANONICAL_PATH)
    dishwasher_hash_before = file_sha256(DISHWASHER_OVERLAY)
    overlay_existed = OVERLAY_PATH.is_file()
    overlay_before = _load(OVERLAY_PATH) if overlay_existed else scaffold_overlay()

    try:
        overlay_after, plan = apply_gate_delta(
            json.loads(json.dumps(scaffold_overlay())),
            table,
            ledger,
            publish=False,
        )
    except GatePublishError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    OVERLAY_PATH.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")

    canonical_hash_after = file_sha256(CANONICAL_PATH)
    dishwasher_hash_after = file_sha256(DISHWASHER_OVERLAY)
    acct = ledger.get("accounting") or {}

    checks = {
        "canonicalHashStable": canonical_hash_before == canonical_hash_after == EXPECTED_CANONICAL_HASH,
        "canonicalExpansionZero": acct.get("canonicalExpansion", -1) == 0,
        "canonicalInheritancesSix": acct.get("canonicalInheritances", 0) == 6,
        "conditionalBindingsFour": acct.get("conditionalBindings", 0) == 4,
        "overlayLearningFour": acct.get("overlayLearningEvents", 0) == 4,
        "intentionalAbstentionsFour": acct.get("intentionalAbstentions", 0) == 4,
        "dishwasherOverlayByteStable": dishwasher_hash_before == dishwasher_hash_after,
        "overlayStatusDraft": overlay_after.get("status") == "draft",
        "conditionalBindingsInOverlay": len(
            (_family(overlay_after).get("conditionalConceptBindings") or [])
        )
        == 4,
        "platformComponentsOnlyInAdd": all(
            c.get("id")
            in {
                "defrost_thermostat",
                "damper_motor",
                "compressor_relay",
                "start_capacitor",
                "em2y60_compressor",
            }
            for c in (_family(overlay_after).get("add", {}).get("components") or [])
        ),
    }

    plan_path = CALIBRATION_DIR / "publication_plan_WHIRLPOOL_JAZZ_FD_CG8.json"
    plan_path.write_text(
        json.dumps({**build_publication_plan(table, ledger), "dryRunChecks": checks}, indent=2),
        encoding="utf-8",
    )

    failed = [k for k, v in checks.items() if not v]
    print("\n=== Dry-run checks ===")
    for key, ok in checks.items():
        print(f"  {'OK' if ok else 'FAIL'} {key}")
    print(f"\noverlay: {OVERLAY_PATH} (draft)")
    print(f"plan:    {plan_path}")

    if failed:
        print(f"\nFAIL: {failed}", file=sys.stderr)
        return 1
    print("\nDry-run PASSED — ready for publish")
    return 0


def _family(overlay: dict) -> dict:
    return (overlay.get("platformFamilies") or [{}])[0]


if __name__ == "__main__":
    raise SystemExit(main())
