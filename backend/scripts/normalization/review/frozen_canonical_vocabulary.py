from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, CANONICAL_DIR, ROOT
from ..range_matcher_scope import load_range_matchable_canonical_ids

FROZEN_HASHES_PATH = CALIBRATION_DIR / "frozen_canonical_hashes_v1.json"

RANGE_ONTOLOGY_IDS = frozenset({"range_oven", "electric_range"})


def _component_ids_from_ontology(ontology_id: str, ontology: dict[str, Any]) -> set[str]:
    if ontology_id in RANGE_ONTOLOGY_IDS:
        return load_range_matchable_canonical_ids(ontology)
    return {str(comp["id"]) for comp in ontology.get("components", []) if comp.get("id")}


@lru_cache(maxsize=1)
def load_frozen_canonical_ids() -> frozenset[str]:
    """Authoritative frozen canonical component/domain ids from the hash-governed ontology files."""
    if not FROZEN_HASHES_PATH.is_file():
        raise FileNotFoundError(f"missing frozen hash registry: {FROZEN_HASHES_PATH}")

    registry = json.loads(FROZEN_HASHES_PATH.read_text(encoding="utf-8"))
    ids: set[str] = set()
    for ontology_id, entry in (registry.get("frozenOntologies") or {}).items():
        rel_path = entry.get("file")
        if not rel_path:
            continue
        path = ROOT / rel_path
        if not path.is_file():
            continue
        ontology = json.loads(path.read_text(encoding="utf-8"))
        ids.update(_component_ids_from_ontology(str(ontology_id), ontology))
    return frozenset(ids)
