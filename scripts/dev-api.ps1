# FastAPI on localhost:8010 (matches frontend BACKEND_API_URL; port 8000 is often Docker/WSL).
# Run from repo root: .\scripts\dev-api.ps1

param(
    [int]$Port = 8010
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$venvPython = Join-Path $repoRoot "venv\Scripts\python.exe"

Set-Location $backendDir

$python = if (Test-Path $venvPython) { $venvPython } else { "python" }

& $python -m uvicorn app.main:app --reload --host 127.0.0.1 --port $Port
