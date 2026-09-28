#!/usr/bin/env python3
"""CG-9.5 WP1 — Samsung RS28 SxS promotion dry-run (fail-closed, no publish)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from samsung_rs28_sxs_cg95_gate_publish import (
    CG7_DISCOVERY_LEAK_TERMS,
    EXPECTED_CANONICAL_HASH,
    GATE_KIND,
    JAZZ_OVERLAY_PATH,
    LG_OVERLAY_PATH,
    MANUAL_ID,
    OVERLAY_FILE,
    RF23BB_LEAK_TERMS,
    RF23BB_OVERLAY_PATH,
    GatePublishError,
    apply_gate_delta,
    build_publication_plan,
    file_sha256,
    scaffold_overlay,
)
from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, MANUFACTURER_OVERLAYS_DIR

TABLE_PATH = CALIBRATION_DIR / "SAMSUNG_RS28_SXS_overlay_mapping_table_v1.json"
LEDGER_PATH = CALIBRATION_DIR / "SAMSUNG_RS28_SXS_gate_decision_ledger_v1.json"
CANONICAL_PATH = CANONICAL_DIR / "french_door_refrigerator.json"
OVERLAY_PATH = MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _family(overlay: dict) -> dict:
    return (overlay.get("platformFamilies") or [{}])[0]


def _implementation_blob(overlay: dict) -> str:
    family = _family(overlay)
    return json.dumps(
        {
            "aliases": family.get("oemTermAliases") or {},
            "components": (family.get("add") or {}).get("components") or [],
            "bindings": family.get("procedureBindings") or [],
            "displayTerms": family.get("displayTerms") or {},
            "deferred": family.get("deferredArtifacts") or [],
        }
    ).lower()


def main() -> int:
    print("==> CG-9.5 Samsung RS28 SxS WP1 promotion dry-run")

    if not TABLE_PATH.is_file() or not LEDGER_PATH.is_file():
        print("FAIL: run apply_samsung_rs28_sxs_cg95_human_gate.py first", file=sys.stderr)
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
    jazz_hash_before = file_sha256(JAZZ_OVERLAY_PATH)
    rf23bb_hash_before = file_sha256(RF23BB_OVERLAY_PATH)
    lg_hash_before = file_sha256(LG_OVERLAY_PATH)

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
    jazz_hash_after = file_sha256(JAZZ_OVERLAY_PATH)
    rf23bb_hash_after = file_sha256(RF23BB_OVERLAY_PATH)
    lg_hash_after = file_sha256(LG_OVERLAY_PATH)
    impl_blob = _implementation_blob(overlay_after)
    acct = ledger.get("accounting") or {}
    family = _family(overlay_after)

    checks = {
        "canonicalHashStable": canonical_hash_before == canonical_hash_after == EXPECTED_CANONICAL_HASH,
        "canonicalExpansionZero": acct.get("canonicalExpansion", -1) == 0,
        "discoveryCorpusInheritanceZero": acct.get("discoveryCorpusInheritance", -1) == 0,
        "canonicalInheritancesFive": acct.get("canonicalInheritances", 0) == 5,
        "conditionalBindingsSeven": acct.get("conditionalBindings", 0) == 7,
        "overlayLearningTen": acct.get("overlayLearningEvents", 0) == 10,
        "intentionalAbstentionsFour": acct.get("intentionalAbstentions", 0) == 4,
        "jazzOverlayByteStable": jazz_hash_before == jazz_hash_after,
        "rf23bbOverlayByteStable": rf23bb_hash_before == rf23bb_hash_after,
        "lgOverlayByteStable": lg_hash_before == lg_hash_after,
        "noPriorOverlayLeak": all(term not in impl_blob for term in RF23BB_LEAK_TERMS),
        "noDiscoveryCorpusLeak": all(term not in impl_blob for term in CG7_DISCOVERY_LEAK_TERMS),
        "overlayStatusDraft": overlay_after.get("status") == "draft",
        "platformIdAuthoritative": family.get("platformId") == "samsung_sxs",
        "condenserFanNotConditionalBound": not any(
            b.get("conditionalConceptId") == "condenser_fan"
            for b in (family.get("conditionalConceptBindings") or [])
        ),
        "doorSwitchNotInProcedureBindings": not any(
            "door_switch" in (b.get("canonicalComponents") or [])
            for b in (family.get("procedureBindings") or [])
            if str(b.get("procedureId", "")).startswith("samsungrs28-")
            or str(b.get("procedureId", "")).startswith("samsungrf260b-")
        ),
        "noSamsungBespokeProcedureBindings": not any(
            str(b.get("procedureId", "")).startswith("samsungbespoke-")
            for b in (family.get("procedureBindings") or [])
        ),
        "platformComponentsOnlyInAdd": all(
            c.get("id")
            in {
                "inverter_board",
                "io_expander",
                "damper_motor",
                "freezer_defrost_ntc",
                "fridge_defrost_ntc",
                "ice_pipe_heater",
                "ice_maker_module",
                "c_fan_convertible",
                "wifi_modem",
                "dispenser_panel",
            }
            for c in (family.get("add", {}).get("components") or [])
        ),
    }

    plan_path = CALIBRATION_DIR / "publication_plan_SAMSUNG_RS28_SXS_CG95.json"
    plan_path.write_text(
        json.dumps(
            {
                **build_publication_plan(table, ledger),
                "dryRunChecks": checks,
                "priorOverlayHashes": {
                    "whirlpool_jazz": jazz_hash_before,
                    "samsung_rf23bb": rf23bb_hash_before,
                    "lg_lrmvs": lg_hash_before,
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    failed = [k for k, v in checks.items() if not v]
    print("\n=== Dry-run checks ===")
    for key, ok in checks.items():
        print(f"  {'OK' if ok else 'FAIL'} {key}")

    if failed:
        print(f"\nFAIL: {failed}", file=sys.stderr)
        return 1
    print("\nDry-run PASSED — ready for publish")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
