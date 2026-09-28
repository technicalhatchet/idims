# Allow inbound TCP for IDIMS Tailscale dev (run elevated).
#   .\scripts\open-firewall-ports.ps1

$ErrorActionPreference = "Stop"

$rules = @(
    @{ Name = "IDIMS Web (3001)"; Port = 3001 }
    @{ Name = "IDIMS API (8010)"; Port = 8010 }
)

foreach ($rule in $rules) {
    netsh advfirewall firewall delete rule name="$($rule.Name)" 2>$null | Out-Null
    netsh advfirewall firewall add rule name="$($rule.Name)" dir=in action=allow protocol=TCP localport=$($rule.Port) profile=any | Out-Null
    Write-Host "Firewall: allowed inbound TCP $($rule.Port) ($($rule.Name))"
}

Write-Host "Done. Phone only needs port 3001 if using the Next.js API proxy."
