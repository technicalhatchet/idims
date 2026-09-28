from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DESIGN_JSON = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
    / "CG_SCOPED_EVIDENCE_GATE6_DESIGN_v1.json"
)
SCRIPT = REPO_ROOT / "backend/scripts/discover_gate6_scoped_evidence_design.py"

DESIGN_CASES = frozenset(
    {
        "w8178558-door-lock",
        "w11169652-test-01-acu-power",
        "w8178558-inlet-valves",
        "w10864849-test-07-drain-recirc-pump",
        "w11416787-test-07-drain-recirc-pump",
        "w11633848-overfill-switch",
    }
)

NEGATIVE = frozenset(
    {
        "lgotrmw-door-interlock",
        "samsungotrmw-door-interlock",
    }
)


def test_gate6_design_artifact():
    assert DESIGN_JSON.is_file(), "Run discover_gate6_scoped_evidence_design.py"
    data = json.loads(DESIGN_JSON.read_text(encoding="utf-8"))
    assert data.get("noProposedProductionMutations") is True
    assert data.get("gate") == 6
    examples = data.get("procedureExamples", {})
    assert DESIGN_CASES <= set(examples.keys())
    assert NEGATIVE <= set(examples.keys())
    for pid in NEGATIVE:
        assert examples[pid]["role"] == "negative_control"
    tiers = {c["tier"] for c in data["conceptInventory"]}
    assert "REQUIRED" in tiers
    assert len(data["conceptsShouldNotAdd"]) >= 5
    assert data["conceptTierCounts"]["REQUIRED"] >= 5
    witnesses = data.get("provenWitnessesUnchanged", [])
    assert "w8178558-drain-pump" in witnesses
    assert "gate7ImplementationBoundary" in data


def test_gate6_regenerates():
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout
