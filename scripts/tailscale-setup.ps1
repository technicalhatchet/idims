# Wire IDIMS for Tailscale phone dev (keeps idfms on :3000; IDIMS uses :3001).
# Run from repo root: .\scripts\tailscale-setup.ps1

param(
    [int]$WebPort = 3001,
    [int]$ApiPort = 8010
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

$tailscale = "C:\Program Files\Tailscale\tailscale.exe"
if (-not (Test-Path $tailscale)) {
    $tailscale = "$env:LOCALAPPDATA\Programs\Tailscale\tailscale.exe"
}
if (-not (Test-Path $tailscale)) {
    Write-Error "Tailscale CLI not found. Install Tailscale and sign in first."
}

$ip = & $tailscale ip -4
if (-not $ip) {
    Write-Error "No Tailscale IPv4 address. Open Tailscale and ensure this device is connected."
}

$frontendEnv = Join-Path $repoRoot "frontend\.env.local"
$backendEnv = Join-Path $repoRoot "backend\.env"
$webOrigin = "http://${ip}:$WebPort"

function Set-EnvLine {
    param([string]$Path, [string]$Key, [string]$Value)
    $lines = @()
    if (Test-Path $Path) {
        $lines = Get-Content $Path
    }
    $found = $false
    $out = foreach ($line in $lines) {
        if ($line -match "^$Key=") {
            $found = $true
            "$Key=$Value"
        } else {
            $line
        }
    }
    if (-not $found) {
        $out += "$Key=$Value"
    }
    Set-Content -Path $Path -Value $out -Encoding utf8
}

Set-EnvLine $frontendEnv "AUTH0_BASE_URL" $webOrigin
# Keep API on localhost — Next.js /api/proxy forwards when the phone origin differs.
$apiUrl = "http://localhost:$ApiPort"
Set-EnvLine $frontendEnv "NEXT_PUBLIC_API_URL" "$apiUrl/"
Set-EnvLine $frontendEnv "NEXT_PUBLIC_BACKEND_API_URL" $apiUrl
Set-EnvLine $frontendEnv "BACKEND_API_URL" $apiUrl
Set-EnvLine $backendEnv "CORS_EXTRA_ORIGINS" $webOrigin

Write-Host ""
Write-Host "IDIMS Tailscale setup complete" -ForegroundColor Green
Write-Host "  PC Tailscale IP: $ip"
Write-Host "  IDIMS (phone):   $webOrigin"
Write-Host "  API:             localhost:$ApiPort (proxied via Next on $WebPort)"
Write-Host ""
Write-Host "Auth0: add these in your Auth0 app settings if login fails from phone:"
Write-Host "  Allowed Callback URLs:     $webOrigin/api/auth/callback"
Write-Host "  Allowed Logout URLs:       $webOrigin"
Write-Host "  Allowed Web Origins:       $webOrigin"
Write-Host ""
Write-Host "Start servers:"
Write-Host "  Backend:  .\scripts\dev-api.ps1"
Write-Host "  Frontend: cd frontend && npm run dev:tailscale"
Write-Host ""
Write-Host "Run both idims + idfms: idfms stays on :3000, idims on :$WebPort"
Write-Host ""
