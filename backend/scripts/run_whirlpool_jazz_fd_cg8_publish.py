#!/usr/bin/env python3
"""CG-8 WP1 — Publish Whirlpool Jazz W10322959 manufacturer overlay."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, MANUFACTURER_OVERLAYS_DIR, PROMOTIONS_DIR
from whirlpool_jazz_fd_cg8_gate_publish import (
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


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    print("==> CG-8 Whirlpool Jazz WP1 publish")

    table = _load(TABLE_PATH)
    ledger = _load(LEDGER_PATH)
    if table.get("status") != "gated":
        print(f"FAIL: gate table not gated ({table.get('status')})", file=sys.stderr)
        return 1

    canonical_hash_before = file_sha256(CANONICAL_PATH)
    overlay_seed = scaffold_overlay()
    if OVERLAY_PATH.is_file():
        overlay_seed = _load(OVERLAY_PATH)

    try:
        overlay, plan = apply_gate_delta(overlay_seed, table, ledger, publish=True)
    except GatePublishError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    promotion_id = f"promo-WHIRLPOOL-JAZZ-FD-CG8-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    promo_dir = PROMOTIONS_DIR / promotion_id
    promo_dir.mkdir(parents=True, exist_ok=True)

    OVERLAY_PATH.write_text(json.dumps(overlay, indent=2), encoding="utf-8")
    table["status"] = "published"
    table["publishedAt"] = datetime.now(timezone.utc).isoformat()
    table["promotionId"] = promotion_id
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")

    publication = {
        **build_publication_plan(table, ledger),
        "promotionId": promotion_id,
        "publishedAt": datetime.now(timezone.utc).isoformat(),
        "canonicalHashBefore": canonical_hash_before,
        "canonicalHashAfter": file_sha256(CANONICAL_PATH),
        "overlayFile": str(OVERLAY_PATH.relative_to(ROOT)),
        "applied": plan.get("applied"),
    }
    pub_path = CALIBRATION_DIR / "publication_WHIRLPOOL_JAZZ_FD_CG8.json"
    pub_path.write_text(json.dumps(publication, indent=2), encoding="utf-8")
    (promo_dir / "overlay_published.json").write_text(json.dumps(overlay, indent=2), encoding="utf-8")
    (promo_dir / "publication.json").write_text(json.dumps(publication, indent=2), encoding="utf-8")

    acct = ledger.get("accounting") or {}
    print("\n=== CG-8 Whirlpool Jazz published ===")
    print(f"promotionId:         {promotion_id}")
    print(f"canonical expansion: {acct.get('canonicalExpansion', 0)}")
    print(f"overlay status:      {overlay.get('status')}")
    print(f"canonical hash:      {publication['canonicalHashAfter'][:16]}... (unchanged)")
    print(f"\noverlay:     {OVERLAY_PATH}")
    print(f"publication: {pub_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
