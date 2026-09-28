from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CLOSURE = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration/CG_REPAIR2_CLOSURE_v1.json"
)
REPAIR1_CLOSURE = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration/CG_REPAIR1_CLOSURE_v1.json"
)
EXPECTED_SEEDS = 825


def test_repair2_closure_artifact():
    assert CLOSURE.is_file()
    data = json.loads(CLOSURE.read_text(encoding="utf-8"))
    assert data["workstream"] == "REPAIR-2"
    assert data["verdict"] == "GREEN"
    assert data["pilot"]["repairProcedureId"] == "w8178558-repair-wash-heater"
    assert REPAIR1_CLOSURE.is_file()


def test_repair2_regression_bundle_green():
    frontend = REPO_ROOT / "frontend"
    ts_tests = [
        "components/diagnostics/repairs/__tests__/repair1-w8178558-drain-pump.test.ts",
        "components/diagnostics/repairs/__tests__/repair2-w8178558-wash-heater.test.ts",
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

    for pytest_rel in [
        "backend/scripts/tests/test_gate8_diagnostic_conclusion_integration.py",
        "backend/scripts/tests/test_repair1_closure.py",
    ]:
        pytest_result = subprocess.run(
            [sys.executable, "-m", "pytest", pytest_rel, "-q"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
        )
        assert pytest_result.returncode == 0, f"{pytest_rel} failed:\n{pytest_result.stderr or pytest_result.stdout}"

    validator = subprocess.run(
        [sys.executable, "backend/scripts/validate_procedure_seed.py"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert validator.returncode == 0, validator.stderr or validator.stdout
    assert f"Validated {EXPECTED_SEEDS} procedure seed" in validator.stdout
