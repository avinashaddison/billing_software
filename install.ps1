# =============================================================================
# Hira & Sons Billing - One-shot client PC installer
# =============================================================================
# Usage:
#   1. Open PowerShell as Administrator (Win + X -> "Terminal (Admin)")
#   2. cd to the folder containing this script
#   3. Set-ExecutionPolicy -Scope Process Bypass -Force; .\install.ps1
#
# Or even simpler - paste this one line into Admin PowerShell:
#   irm https://raw.githubusercontent.com/avinashaddison/billing_software/main/install.ps1 | iex
# =============================================================================

$ErrorActionPreference = "Stop"
$REPO_URL    = "https://github.com/avinashaddison/billing_software.git"
$INSTALL_DIR = "C:\HiraBilling"

# Make sure the box-drawing + block characters render correctly
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Write-Step($msg) {
  Write-Host ""
  Write-Host "  [>] " -ForegroundColor Green -NoNewline
  Write-Host $msg -ForegroundColor White
}
function Write-Ok($msg)    { Write-Host "      [OK] " -ForegroundColor Green -NoNewline; Write-Host $msg -ForegroundColor Gray }
function Write-Warn2($msg) { Write-Host "      [!]  " -ForegroundColor Yellow -NoNewline; Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "      [X]  " -ForegroundColor Red -NoNewline; Write-Host $msg -ForegroundColor Red }

function Write-Hack($msg, $color = "Green") {
  Write-Host "  [*] " -ForegroundColor DarkGreen -NoNewline
  Write-Host $msg -ForegroundColor $color
}

function Show-Banner {
  Clear-Host
  Write-Host ""
  $logo = @(
    "      ___       ___    ___    ___  ____    ___    _ __    __  __ ",
    "     /   \    |   \  |   \  |_ _| / ___|  / _ \  | '_ \   \ \/ / ",
    "    / ___ \   | |) | | |) |  | |  \___ \ | | | | | | | |   >  <  ",
    "   /_/   \_\  |___/  |___/  |___|  ___) ||_| |_| |_| |_|  /_/\_\ ",
    "                                  |____/                          "
  )
  foreach ($line in $logo) {
    Write-Host $line -ForegroundColor Green
    Start-Sleep -Milliseconds 30
  }
  Write-Host ""
  Write-Host "        S  O  F  T  W  A  R  E " -ForegroundColor DarkGreen -NoNewline
  Write-Host "  +  " -ForegroundColor DarkGray -NoNewline
  Write-Host "Billing System v1.0" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  ================================================================" -ForegroundColor DarkGreen
  Write-Host ""

  # Boot-style scanlines
  $boot = @(
    "Initializing AddisonX installer...",
    "Establishing secure channel..............[ ENCRYPTED ]",
    "Verifying system integrity...............[   PASS    ]",
    "Loading deployment manifest..............[  LOADED   ]",
    "Authenticating package mirrors...........[ TRUSTED   ]",
    "All systems nominal. Beginning install..."
  )
  foreach ($line in $boot) {
    Write-Hack $line
    Start-Sleep -Milliseconds 220
  }
  Start-Sleep -Milliseconds 400
  Write-Host ""
}

function Show-DoneBanner($domain) {
  Write-Host ""
  Write-Host ""
  $done = @(
    "   ____    ___    _   _   _____ ",
    "  |  _ \  / _ \  | \ | | | ____|",
    "  | | | || | | | |  \| | |  _|  ",
    "  | |_| || |_| | | |\  | | |___ ",
    "  |____/  \___/  |_| \_| |_____|"
  )
  foreach ($line in $done) {
    Write-Host $line -ForegroundColor Green
    Start-Sleep -Milliseconds 40
  }
  Write-Host ""
  Write-Host "  ================================================================" -ForegroundColor DarkGreen
  Write-Host "             SOFTWARE INSTALL COMPLETE" -ForegroundColor Green
  Write-Host "  ================================================================" -ForegroundColor DarkGreen
  Write-Host ""
  Write-Host "    Cashier PC URL :  " -ForegroundColor Gray -NoNewline
  Write-Host "http://localhost:3000" -ForegroundColor Cyan
  Write-Host "    Phone scanner :   " -ForegroundColor Gray -NoNewline
  Write-Host "https://$domain" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "    Default login (auto-created on first start):" -ForegroundColor DarkGray
  Write-Host "       Name : " -ForegroundColor DarkGray -NoNewline
  Write-Host "Owner    " -ForegroundColor White -NoNewline
  Write-Host "PIN : " -ForegroundColor DarkGray -NoNewline
  Write-Host "1234" -ForegroundColor White
  Write-Host "    >> Change the PIN immediately from Staff Management <<" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "    Auto-starts on every Windows boot. No further setup needed." -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "                  -- powered by " -ForegroundColor DarkGray -NoNewline
  Write-Host "AddisonX Software" -ForegroundColor Green -NoNewline
  Write-Host " --" -ForegroundColor DarkGray
  Write-Host ""
}

function Ensure-Winget {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err "winget is not available. Update Windows or install 'App Installer' from the Microsoft Store, then re-run."
    exit 1
  }
}

function Ensure-WingetPackage($id, $cmd, $friendlyName) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) {
    Write-Ok "$friendlyName already installed."
    return
  }
  Write-Host "  -> Installing $friendlyName via winget..." -ForegroundColor Gray
  winget install --id $id --silent --accept-source-agreements --accept-package-agreements | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Err "winget install failed for $id. Install manually and re-run."
    exit 1
  }
  Write-Ok "$friendlyName installed."
}

function Refresh-Path {
  # Reload PATH so just-installed binaries become callable in THIS shell.
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path","User")
}

# -----------------------------------------------------------------------------
# 0. Banner + boot sequence
# -----------------------------------------------------------------------------
Show-Banner

# -----------------------------------------------------------------------------
# 1. Prerequisites
# -----------------------------------------------------------------------------
Write-Step "Checking prerequisites"
Ensure-Winget

Ensure-WingetPackage "OpenJS.NodeJS.LTS"  "node" "Node.js (LTS)"
Ensure-WingetPackage "Git.Git"             "git"  "Git"
Refresh-Path

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host "  -> Installing pnpm globally via npm..." -ForegroundColor Gray
  npm install -g pnpm | Out-Null
  Refresh-Path
  Write-Ok "pnpm installed."
} else {
  Write-Ok "pnpm already installed."
}

# -----------------------------------------------------------------------------
# 2. Clone or update the repo
# -----------------------------------------------------------------------------
Write-Step "Fetching the latest code into $INSTALL_DIR"
if (Test-Path "$INSTALL_DIR\.git") {
  Write-Ok "Repo already exists - pulling latest changes."
  Push-Location $INSTALL_DIR
  git pull --ff-only
  Pop-Location
} else {
  if (Test-Path $INSTALL_DIR) {
    Write-Err "$INSTALL_DIR exists but is not a git repo. Move/delete it and re-run."
    exit 1
  }
  git clone $REPO_URL $INSTALL_DIR
  Write-Ok "Cloned into $INSTALL_DIR"
}

Set-Location $INSTALL_DIR

# -----------------------------------------------------------------------------
# 3. Collect secrets and write .env (only if .env doesn't already exist)
# -----------------------------------------------------------------------------
Write-Step "Configuring secrets (.env)"

if (Test-Path ".env") {
  Write-Ok ".env already present - keeping existing values."
} else {
  Write-Host ""
  Write-Host "  Paste the values from your services. Press Enter to skip optional ones." -ForegroundColor Gray
  Write-Host ""

  $neon = Read-Host "  Neon Postgres URL  (required)"
  while ([string]::IsNullOrWhiteSpace($neon)) {
    Write-Warn2 "Neon URL is required. Get it from https://neon.tech/"
    $neon = Read-Host "  Neon Postgres URL"
  }

  $tgToken  = Read-Host "  Telegram bot token (optional)"
  $tgChat   = Read-Host "  Telegram chat ID   (optional)"
  $cloudUrl = Read-Host "  Cloudinary URL     (optional)"
  $storeName = Read-Host "  Store name (e.g. Hira & Sons Gift Shop)"
  if ([string]::IsNullOrWhiteSpace($storeName)) { $storeName = "My Shop" }

  @"
# Generated by install.ps1 - $(Get-Date -Format 'yyyy-MM-dd HH:mm')

NEON_DATABASE_URL="$neon"
DATABASE_URL="$neon"

PORT=3000
API_PORT=8080

TELEGRAM_BOT_TOKEN="$tgToken"
TELEGRAM_CHAT_ID="$tgChat"
STORE_NAME="$storeName"

CLOUDINARY_URL="$cloudUrl"
"@ | Out-File -Encoding utf8 -FilePath ".env"

  Write-Ok "Wrote .env"
}

# -----------------------------------------------------------------------------
# 4. Install dependencies, push DB schema, build production bundle
# -----------------------------------------------------------------------------
Write-Step "Installing dependencies (this can take 3-5 minutes)"
pnpm install --frozen-lockfile
Write-Ok "Dependencies installed."

Write-Step "Syncing database schema"
pnpm --filter "@workspace/db" run push
Write-Ok "Schema synced."

Write-Step "Building production bundle"
pnpm run build:prod
Write-Ok "Build complete."

# -----------------------------------------------------------------------------
# 5. Install + update ngrok, configure authtoken & static domain
# -----------------------------------------------------------------------------
Write-Step "Setting up ngrok (HTTPS tunnel for phone scanning)"
Ensure-WingetPackage "Ngrok.Ngrok" "ngrok" "ngrok"
Refresh-Path

# Resolve ngrok path (winget sometimes doesn't refresh in this session)
$ngrokExe = (Get-Command ngrok -ErrorAction SilentlyContinue).Source
if (-not $ngrokExe) {
  $candidate = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
  if (Test-Path $candidate) { $ngrokExe = $candidate }
}
if (-not $ngrokExe) {
  Write-Err "ngrok install completed but binary not found. Install manually from https://ngrok.com/download"
  exit 1
}

Write-Host "  -> Updating ngrok to latest..." -ForegroundColor Gray
& $ngrokExe update | Out-Null
Write-Ok "ngrok up to date."

Write-Host ""
Write-Host "  Sign up free at https://ngrok.com/ (Google login works)." -ForegroundColor Gray
Write-Host "  Then visit https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Gray
$tok = Read-Host "  ngrok authtoken (required)"
while ([string]::IsNullOrWhiteSpace($tok)) {
  Write-Warn2 "Authtoken is required to start the tunnel."
  $tok = Read-Host "  ngrok authtoken"
}
& $ngrokExe config add-authtoken $tok | Out-Null
Write-Ok "Authtoken saved."

Write-Host ""
Write-Host "  Visit https://dashboard.ngrok.com/domains and copy your free static domain" -ForegroundColor Gray
Write-Host "  (looks like 'word-word-word.ngrok-free.dev')." -ForegroundColor Gray
$dom = Read-Host "  ngrok static domain (required)"
while ([string]::IsNullOrWhiteSpace($dom)) {
  Write-Warn2 "Static domain is required so the URL stays the same across restarts."
  $dom = Read-Host "  ngrok static domain"
}
[System.Environment]::SetEnvironmentVariable("NGROK_DOMAIN", $dom, "User")
$env:NGROK_DOMAIN = $dom
Write-Ok "NGROK_DOMAIN saved (value: $dom)."

# -----------------------------------------------------------------------------
# 6. Add start.bat to Windows Startup so it auto-launches on boot
# -----------------------------------------------------------------------------
Write-Step "Configuring auto-start on Windows boot"
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcut = Join-Path $startupDir "Hira Billing.lnk"
$wshell = New-Object -ComObject WScript.Shell
$lnk = $wshell.CreateShortcut($shortcut)
$lnk.TargetPath       = (Resolve-Path "$INSTALL_DIR\start.bat").Path
$lnk.WorkingDirectory = $INSTALL_DIR
$lnk.WindowStyle      = 1
$lnk.Description      = "Hira & Sons Billing"
$lnk.Save()
Write-Ok "Shortcut created in $startupDir"

# -----------------------------------------------------------------------------
# 7. Done — show the styled finish banner
# -----------------------------------------------------------------------------
Show-DoneBanner $dom

$go = Read-Host "    Launch the app now? (y/n)"
if ($go -eq "y" -or $go -eq "Y") {
  Start-Process -FilePath "$INSTALL_DIR\start.bat" -WorkingDirectory $INSTALL_DIR
  Write-Host ""
  Write-Hack "Launched. Two new windows should open shortly." "Cyan"
  Write-Host ""
}
