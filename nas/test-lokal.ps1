# HufMacherin NAS-Server – lokaler Test-Start (Windows)
# ─────────────────────────────────────────────────────────────────────────────
# Startet server.js LOKAL (nicht auf der NAS), sodass die PWA auf dem eigenen
# Smartphone getestet werden kann, bevor die Synology eingerichtet ist.
#
# Voraussetzungen:
#   1. Node.js installiert  (https://nodejs.org – LTS reicht)
#   2. Abhängigkeit installieren:
#        cd <repo>\nas
#        npm install
#   3. Tailscale auf diesem PC aktiv (für Smartphone-Zugriff)
#
# Tailscale-IP herausfinden (in separatem Terminal):
#   tailscale ip -4
#
# Dann auf dem Smartphone im Browser öffnen:
#   http://[TAILSCALE-IP]:3004
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'

# Testverzeichnis: <repo>\nas\test-data (wird von Git ignoriert)
$testBase = Join-Path $PSScriptRoot 'test-data'
New-Item -ItemType Directory -Force -Path $testBase | Out-Null

$env:APP_BASE = $testBase
$env:APP_PORT = '3004'

# Tailscale-IP ermitteln (optional, nur zur Anzeige)
$tailscaleIp = ''
try {
    $tailscaleIp = (& tailscale ip -4 2>$null).Trim()
} catch {}

Write-Host ''
Write-Host '  ╔═══════════════════════════════════════════════════════╗' -ForegroundColor Cyan
Write-Host '  ║   HufMacherin NAS-Server  –  LOKALER TESTMODUS       ║' -ForegroundColor Cyan
Write-Host '  ╚═══════════════════════════════════════════════════════╝' -ForegroundColor Cyan
Write-Host ''
Write-Host "  Testdaten werden gespeichert in:" -ForegroundColor DarkGray
Write-Host "    $testBase" -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Browser auf DIESEM PC (Health-Check):' -ForegroundColor White
Write-Host '    http://localhost:3004/api/health' -ForegroundColor Yellow
Write-Host '    http://localhost:3004            (Upload-PWA)' -ForegroundColor Yellow
Write-Host ''
if ($tailscaleIp) {
    Write-Host "  Smartphone-URL (Tailscale erkannt: $tailscaleIp):" -ForegroundColor White
    Write-Host "    http://${tailscaleIp}:3004" -ForegroundColor Green
} else {
    Write-Host '  Smartphone-URL (Tailscale-IP ermitteln: tailscale ip -4):' -ForegroundColor White
    Write-Host '    http://[TAILSCALE-IP]:3004' -ForegroundColor Yellow
}
Write-Host ''
Write-Host '  Beenden mit  Ctrl+C' -ForegroundColor DarkGray
Write-Host ''

$serverScript = Join-Path $PSScriptRoot 'server.js'
if (-not (Test-Path $serverScript)) {
    Write-Host "FEHLER: server.js nicht gefunden in $PSScriptRoot" -ForegroundColor Red
    exit 1
}

$nodeModules = Join-Path $PSScriptRoot 'node_modules'
if (-not (Test-Path $nodeModules)) {
    Write-Host 'node_modules fehlt – fuehre erst "npm install" im nas-Ordner aus.' -ForegroundColor Red
    exit 1
}

node $serverScript
