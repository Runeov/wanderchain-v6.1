[CmdletBinding()]
param(
  [switch]$Flood,        # enqueue jobs after everything is up
  [switch]$NoOpen,       # don’t open browser tabs
  [switch]$NoMonitoring  # skip Prometheus/Grafana bring-up
)

$ErrorActionPreference = "Stop"

# --- Config (adjust if your ports change)
$RepoRoot = "C:\dev\Wonder\v6.1"
$API_URL  = "http://localhost:4000"
$WEB_URL  = "http://localhost:3000"
$Ports    = @{ Api = 4000; Worker = 4001; Web = 3000 }

# --- Helpers
function Test-PortUp([int]$Port) {
  $r = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
  return $r.TcpTestSucceeded
}

function Wait-PortUp([int]$Port){
  Write-Host "Waiting for :$Port..." -ForegroundColor Yellow
  do {
    $ok = Test-PortUp $Port
    if (-not $ok) { Start-Sleep -Seconds 1 }
  } until ($ok)
  Write-Host "Port :$Port is UP." -ForegroundColor Green
}

function Start-DevIfDown([string]$Pkg, [int]$Port) {
  if (Test-PortUp $Port) {
    Write-Host "$Pkg already running on :$Port" -ForegroundColor Green
    return
  }
  Write-Host "Starting $Pkg (port :$Port)..." -ForegroundColor Cyan
  $cmd = "cd $RepoRoot; pnpm --filter $Pkg dev"
  Start-Process powershell -ArgumentList '-NoExit','-Command', $cmd | Out-Null
}

# --- 0) Repo root sanity
if (-not (Test-Path $RepoRoot)) {
  throw "Repo root not found at $RepoRoot. Edit the script header to match your path."
}
Set-Location $RepoRoot

Write-Host "== Wonder / Wanderchain — status ==" -ForegroundColor Magenta

# --- 1) Start API/Worker/Web if needed
Start-DevIfDown -Pkg "@app/api"    -Port $Ports.Api
Start-DevIfDown -Pkg "@app/worker" -Port $Ports.Worker
Start-DevIfDown -Pkg "@app/web"    -Port $Ports.Web

# --- 2) Wait for ports
Wait-PortUp $Ports.Api
Wait-PortUp $Ports.Worker
Wait-PortUp $Ports.Web

# --- 3) Health & status checks
try {
  Write-Host "`nAPI /healthz:" -ForegroundColor Cyan
  Invoke-RestMethod "$API_URL/healthz" | Out-Host
} catch {
  Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

try {
  Write-Host "`nAPI /status/providers:" -ForegroundColor Cyan
  (Invoke-RestMethod "$API_URL/status/providers") | ConvertTo-Json -Depth 6 | Out-Host
} catch {
  Write-Host "Status check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# --- 4) Monitoring: Prometheus + Grafana (optional; only if compose file exists)
$ComposeFile = Join-Path $RepoRoot "infra/monitoring/docker-compose.grafana.yml"
if (-not $NoMonitoring -and (Test-Path $ComposeFile)) {
  Write-Host "`nBringing up monitoring stack..." -ForegroundColor Cyan
  docker compose -f $ComposeFile up -d | Out-Null
} else {
  Write-Host "`nSkipping monitoring bring-up (file missing or -NoMonitoring)." -ForegroundColor DarkYellow
}

# --- 5) Open UIs unless told not to
if (-not $NoOpen) {
  Start-Process $WEB_URL                            # Web app
  Start-Process "http://localhost:9090/targets"     # Prometheus
  Start-Process "http://localhost:3002"             # Grafana (admin/admin)
}

# --- 6) Optional: generate traffic so metrics move
if ($Flood) {
  Write-Host "`nEnqueuing jobs to generate load..." -ForegroundColor Cyan
  try {
    pnpm tsx infra/queues/flood.ts | Out-Host
    Write-Host "Done." -ForegroundColor Green
  } catch {
    Write-Host "Flood script failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "`nAll set. Happy testing!" -ForegroundColor Magenta
