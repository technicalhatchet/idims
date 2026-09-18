from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import MANUFACTURER_OVERLAYS_DIR, PROMOTIONS_DIR, ROOT
from ..review.ledger import mark_candidates_promoted
from .planner import find_platform_family, load_overlay_file


def load_promotion_plan(promotion_id: str) -> dict[str, Any]:
    path = PROMOTIONS_DIR / f"{promotion_id}.json"
    if not path.is_file():
        raise FileNotFoundError(f"Promotion plan not found: {promotion_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def apply_promotion_diff(
    overlay: dict[str, Any],
    platform_family_id: str,
    diff: dict[str, Any],
) -> dict[str, Any]:
    family = find_platform_family(overlay, platform_family_id)
    if not family:
        raise ValueError(f"Platform family {platform_family_id} not found")

    alias_add = (diff.get("oemTermAliases") or {}).get("add") or {}
    family.setdefault("oemTermAliases", {}).update(alias_add)

    display_add = (diff.get("displayTerms") or {}).get("add") or {}
    family.setdefault("displayTerms", {}).update(display_add)

    proc_add = (diff.get("procedureBindings") or {}).get("add") or []
    existing_proc_ids = {
        b.get("procedureId") for b in family.get("procedureBindings") or []
    }
    for binding in proc_add:
        if binding.get("procedureId") not in existing_proc_ids:
            family.setdefault("procedureBindings", []).append(binding)

    meas_add = (diff.get("measurementBindings") or {}).get("add") or []
    existing_meas = {
        f"{b.get('procedureId')}:{b.get('measurementKnowledgeId')}"
        for b in family.get("measurementBindings") or []
    }
    for binding in meas_add:
        key = f"{binding.get('procedureId')}:{binding.get('measurementKnowledgeId')}"
        if key not in existing_meas:
            family.setdefault("measurementBindings", []).append(binding)

    return overlay


def validate_overlay() -> None:
    script = ROOT / "backend" / "scripts" / "validate_canonical_graph.py"
    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "validate_canonical_graph failed after promotion:\n"
            f"{result.stdout}\n{result.stderr}",
        )


def publish_promotion(
    promotion_id: str,
    force: bool = False,
) -> dict[str, Any]:
    plan = load_promotion_plan(promotion_id)
    if plan.get("blocked") and not force:
        raise RuntimeError(
            "Promotion is blocked. Resolve conflicts or use --force (not recommended). "
            f"Reasons: {plan.get('blockReasons')}",
        )

    overlay_file = plan.get("overlayFile")
    platform_family_id = plan.get("platformFamilyId")
    overlay_path = MANUFACTURER_OVERLAYS_DIR / overlay_file

    overlay_before = load_overlay_file(overlay_file)
    overlay_after = apply_promotion_diff(
        json.loads(json.dumps(overlay_before)),
        platform_family_id,
        plan.get("diff") or {},
    )

    backup_dir = PROMOTIONS_DIR / promotion_id
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(overlay_path, backup_dir / "overlay_before.json")
    (backup_dir / "overlay_after.json").write_text(
        json.dumps(overlay_after, indent=2),
        encoding="utf-8",
    )

    overlay_path.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")
    validate_overlay()

    mark_candidates_promoted(plan.get("approvedCandidateIds") or [], promotion_id)

    plan["status"] = "published"
    plan["publishedAt"] = datetime.now(timezone.utc).isoformat()
    (PROMOTIONS_DIR / f"{promotion_id}.json").write_text(
        json.dumps(plan, indent=2),
        encoding="utf-8",
    )

    return plan
