from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CLOSURE = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration/CG_REPAIR1_CLOSURE_v1.json"
)
EXPECTED_SEEDS = 825


def test_repair1_closure_artifact():
    assert CLOSURE.is_file()
    data = json.loads(CLOSURE.read_text(encoding="utf-8"))
    assert data["workstream"] == "REPAIR-1"
    assert data["verdict"] == "GREEN"
    assert data["pilot"]["repairProcedureId"] == "w8178558-repair-drain-pump"


def test_repair1_and_gate_regressions_green():
    frontend = REPO_ROOT / "frontend"
    ts_tests = [
        "components/diagnostics/repairs/__tests__/repair1-w8178558-drain-pump.test.ts",
        "components/diagnostics/procedures/__tests__/gate8DiagnosticConclusionIntegration.test.ts",
    ]
    for rel in ts_tests:
        result = subprocess.run(
            ["npx", "tsx", rel],
            cwd=str(frontend),
            capture_output=True,
            text=True,
            shell=True,
        )
        assert result.returncode == 0, f"{rel} failed:\n{result.stderr or result.stdout}"

    gate8_py = subprocess.run(
        [sys.executable, "-m", "pytest", "backend/scripts/tests/test_gate8_diagnostic_conclusion_integration.py", "-q"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert gate8_py.returncode == 0, gate8_py.stderr or gate8_py.stdout

    validator = subprocess.run(
        [sys.executable, "backend/scripts/validate_procedure_seed.py"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert validator.returncode == 0, validator.stderr or validator.stdout
    assert f"Validated {EXPECTED_SEEDS} procedure seed" in validator.stdout
