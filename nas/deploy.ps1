# HufMacherin – Deployment auf Synology DS124
# ─────────────────────────────────────────────────────────────────────────────
# Uebertraegt alle NAS-Dateien via SSH-Pipe auf die Synology und richtet den
# Server ein. Laeuft von diesem PC aus, NAS muss per Tailscale erreichbar sein.
#
# Voraussetzungen (einmalig):
#   - Tailscale auf diesem PC aktiv, NAS im selben Tailscale-Netzwerk
#   - SSH-Client auf diesem PC (Windows 10/11: vorinstalliert)
#   - Beim ersten Aufruf: SSH fragt "Are you sure?" -> mit "yes" bestaetigen
#
# Aufruf:
#   cd <repo>\nas
#   .\deploy.ps1
#
# Optional: nur Dateien uebertragen ohne npm install:
#   .\deploy.ps1 -NurDateien
# ─────────────────────────────────────────────────────────────────────────────
param(
    [switch]$NurDateien
)

$ErrorActionPreference = 'Stop'

# ── Konfiguration ─────────────────────────────────────────────────────────────
$NAS_HOST    = '100.121.103.107'
$NAS_USER    = 'admin'
$NAS_PORT    = 22
$SSH_KEY     = "$HOME\.ssh\hufmacherin_nas"
$REMOTE_BASE = '/volume1/Tenny/HufMacherin App'
$APP_PORT    = '3004'
$NODE_CMD    = '/var/packages/Node.js_v20/target/usr/local/bin/node'
$NODE_PATH   = '/var/packages/Node.js_v20/target/usr/local/bin:/bin:/usr/bin:/usr/local/bin'
$NPM_CLI     = '/usr/local/lib/node_modules/npm/bin/npm-cli.js'

# Lokales Quellverzeichnis (= das nas/-Verzeichnis dieses Repos)
$LOCAL_NAS = $PSScriptRoot

# SSH-Kurzform (passwortlos via Key)
function Ssh([string]$cmd) {
    ssh -i $SSH_KEY -p $NAS_PORT "${NAS_USER}@${NAS_HOST}" $cmd
}

function SshPipe([string]$localFile, [string]$remotePath) {
    $content = Get-Content $localFile -Encoding UTF8 -Raw
    # Sonderzeichen: unsere Dateien nutzen HTML-Entities, sind ASCII-sicher
    $content | ssh -i $SSH_KEY -p $NAS_PORT "${NAS_USER}@${NAS_HOST}" "cat > '$remotePath'"
}

# ── Header ────────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '  ╔══════════════════════════════════════════════════════════╗' -ForegroundColor Cyan
Write-Host '  ║   HufMacherin – Deployment auf Synology DS124           ║' -ForegroundColor Cyan
Write-Host '  ╚══════════════════════════════════════════════════════════╝' -ForegroundColor Cyan
Write-Host ''
Write-Host "  NAS:       ${NAS_USER}@${NAS_HOST}:${NAS_PORT}" -ForegroundColor DarkGray
Write-Host "  Zielpfad:  ${REMOTE_BASE}/nas/" -ForegroundColor DarkGray
Write-Host "  Port:      ${APP_PORT}" -ForegroundColor DarkGray
Write-Host ''

# ── 1. SSH-Verbindung testen ──────────────────────────────────────────────────
Write-Host '[1/5] SSH-Verbindung testen...' -ForegroundColor White
try {
    $result = Ssh "echo OK" 2>&1
    if ($result -notmatch 'OK') { throw "Unerwartete Antwort: $result" }
    Write-Host '      OK' -ForegroundColor Green
} catch {
    Write-Host "FEHLER: SSH-Verbindung fehlgeschlagen." -ForegroundColor Red
    Write-Host "        Tailscale aktiv? NAS erreichbar? SSH aktiviert?" -ForegroundColor Red
    Write-Host "        Meldung: $_" -ForegroundColor Red
    exit 1
}

# ── 2. Verzeichnisse anlegen ──────────────────────────────────────────────────
Write-Host '[2/5] Verzeichnisse auf NAS anlegen...' -ForegroundColor White
Ssh "mkdir -p '/volume1/Tenny/HufMacherin App/nas/public/icons'"
Ssh "mkdir -p '/volume1/Tenny/HufMacherin App/nas/database'"
Ssh "mkdir -p '/volume1/Tenny/HufMacherin App/nas/backups'"
Ssh "mkdir -p '/volume1/Tenny/HufMacherin App/nas/_untagged'"
Write-Host '      OK' -ForegroundColor Green

# ── 3. Dateien uebertragen ────────────────────────────────────────────────────
Write-Host '[3/5] Dateien uebertragen (SSH-Pipe)...' -ForegroundColor White

$files = @(
    @{ local = 'server.js';          remote = 'nas/server.js'          },
    @{ local = 'package.json';       remote = 'nas/package.json'       },
    @{ local = 'public\index.html';  remote = 'nas/public/index.html'  },
    @{ local = 'public\upload.html'; remote = 'nas/public/upload.html' },
    @{ local = 'public\manifest.json'; remote = 'nas/public/manifest.json' },
    @{ local = 'public\sw.js';       remote = 'nas/public/sw.js'       }
)

foreach ($f in $files) {
    $localPath  = Join-Path $LOCAL_NAS $f.local
    $remotePath = "${REMOTE_BASE}/$($f.remote)"
    if (-not (Test-Path $localPath)) {
        Write-Host "  WARNUNG: $($f.local) nicht gefunden, uebersprungen." -ForegroundColor Yellow
        continue
    }
    Write-Host "  $($f.local) -> $($f.remote)" -ForegroundColor DarkGray
    SshPipe $localPath $remotePath
}

Write-Host '      OK' -ForegroundColor Green

if ($NurDateien) {
    Write-Host ''
    Write-Host 'Nur-Dateien-Modus: npm install und Health-Check uebersprungen.' -ForegroundColor Yellow
    exit 0
}

# ── 4. npm install auf NAS ────────────────────────────────────────────────────
Write-Host '[4/5] npm install auf NAS ausfuehren (kann 1-2 Minuten dauern)...' -ForegroundColor White
Write-Host '      (sharp wird fuer ARM64 kompiliert – bitte warten)' -ForegroundColor DarkGray

try {
    Ssh "export PATH=${NODE_PATH}:$PATH && cd '/volume1/Tenny/HufMacherin App/nas' && node ${NPM_CLI} install --unsafe-perm 2>&1"
    Write-Host '      OK' -ForegroundColor Green
} catch {
    Write-Host "  WARNUNG: npm install meldete Fehler." -ForegroundColor Yellow
    Write-Host "           Falls sharp-Fehler: Schritt 4 manuell ausfuehren:" -ForegroundColor Yellow
    Write-Host "           ssh ${NAS_USER}@${NAS_HOST}" -ForegroundColor Yellow
    Write-Host "           cd '/volume1/Tenny/HufMacherin App/nas'" -ForegroundColor Yellow
    Write-Host "           npm install --unsafe-perm" -ForegroundColor Yellow
}

# ── 5. Server starten + Health-Check ─────────────────────────────────────────
Write-Host '[5/5] Server-Test auf der NAS...' -ForegroundColor White
Write-Host '      Server wird kurz gestartet, Health-Check, dann gestoppt.' -ForegroundColor DarkGray

# Server im Hintergrund starten, Health-Check, dann killen
$checkResult = Ssh @"
APP_BASE='/volume1/Tenny/HufMacherin App/nas' APP_PORT=${APP_PORT} nohup ${NODE_CMD} '/volume1/Tenny/HufMacherin App/nas/server.js' &
SERVER_PID=\$!
sleep 3
curl -s http://localhost:${APP_PORT}/api/health
kill \$SERVER_PID 2>/dev/null
"@

if ($checkResult -match '"success":true') {
    Write-Host '      Health-Check OK!' -ForegroundColor Green
} else {
    Write-Host "  WARNUNG: Health-Check nicht eindeutig. Manuell pruefen:" -ForegroundColor Yellow
    Write-Host "           $checkResult" -ForegroundColor DarkGray
}

# ── Ergebnis & naechste Schritte ──────────────────────────────────────────────
Write-Host ''
Write-Host '  ╔══════════════════════════════════════════════════════════╗' -ForegroundColor Green
Write-Host '  ║   Deployment abgeschlossen!                             ║' -ForegroundColor Green
Write-Host '  ╚══════════════════════════════════════════════════════════╝' -ForegroundColor Green
Write-Host ''
Write-Host '  Naechster Schritt: Autostart in DSM einrichten' -ForegroundColor White
Write-Host ''
Write-Host '  DSM -> Systemsteuerung -> Aufgabenplaner -> Erstellen' -ForegroundColor Cyan
Write-Host '  -> Getriggerte Aufgabe -> Benutzerdefiniertes Script' -ForegroundColor Cyan
Write-Host ''
Write-Host '  Allgemein:' -ForegroundColor DarkGray
Write-Host '    Aufgabenname:  HufMacherin API Server' -ForegroundColor White
Write-Host '    Benutzer:      root' -ForegroundColor White
Write-Host '    Ereignis:      Systemstart' -ForegroundColor White
Write-Host ''
Write-Host '  Aufgaben (Script):' -ForegroundColor DarkGray
Write-Host "    APP_BASE='/volume1/Tenny/HufMacherin App/nas' \" -ForegroundColor White
Write-Host "    APP_PORT=${APP_PORT} \" -ForegroundColor White
Write-Host "    ${NODE_CMD} '/volume1/Tenny/HufMacherin App/nas/server.js' &" -ForegroundColor White
Write-Host ''
Write-Host '  PWA-URL fuer Smartphone (Tailscale muss aktiv sein):' -ForegroundColor DarkGray
Write-Host "    http://${NAS_HOST}:${APP_PORT}" -ForegroundColor Green
Write-Host ''
