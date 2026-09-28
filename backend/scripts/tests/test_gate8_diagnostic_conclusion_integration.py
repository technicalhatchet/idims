from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CAL = REPO_ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
GATE8_JSON = CAL / "CG_SCOPED_EVIDENCE_GATE8_CLOSURE_v1.json"
EXPECTED_SEEDS = 825


def test_gate8_closure_artifact():
    assert GATE8_JSON.is_file(), "Missing CG_SCOPED_EVIDENCE_GATE8_CLOSURE_v1.json"
    closure = json.loads(GATE8_JSON.read_text(encoding="utf-8"))
    assert closure.get("gate") == 8
    assert closure.get("verdict") == "GREEN"
    assert len(closure.get("goldenWitnesses", [])) == 7


def test_gate8_integration_and_regression_bundle():
    frontend = REPO_ROOT / "frontend"
    ts_tests = [
        "components/diagnostics/procedures/__tests__/gate8DiagnosticConclusionIntegration.test.ts",
        "components/diagnostics/procedures/__tests__/scopedProcedureEffectsAndRepair.test.ts",
        "components/diagnostics/procedures/__tests__/w8178558-drain-pump-scopedSemantics.test.ts",
        "components/diagnostics/procedures/__tests__/w8178558-wash-heater-ntc-scopedSemantics.test.ts",
        "components/diagnostics/procedures/__tests__/w8178558-inlet-valves-cold-coil-scopedSemantics.test.ts",
        "components/diagnostics/procedures/__tests__/w10864849-test-07-drain-recirc-pump-scopedSemantics.test.ts",
        "components/diagnostics/procedures/__tests__/w11633848-overfill-switch-evidenceSubject.test.ts",
        "components/diagnostics/procedures/__tests__/w8178558-door-lock-evidenceSubject.test.ts",
        "components/diagnostics/procedures/__tests__/w11169652-test-01-acu-power-evidenceSubject.test.ts",
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

    pytest_result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "backend/scripts/tests/test_scoped_evidence_corpus_discovery.py",
            "backend/scripts/tests/test_gate5_scoped_evidence_discovery.py",
            "backend/scripts/tests/test_gate6_scoped_evidence_design.py",
            "backend/scripts/tests/test_gate7_scoped_evidence_closure.py",
            "-q",
        ],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert pytest_result.returncode == 0, pytest_result.stderr or pytest_result.stdout

    validator = subprocess.run(
        [sys.executable, "backend/scripts/validate_procedure_seed.py"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert validator.returncode == 0, validator.stderr or validator.stdout
    assert f"Validated {EXPECTED_SEEDS} procedure seed" in validator.stdout
