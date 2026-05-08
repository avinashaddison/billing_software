@echo off
REM ============================================================================
REM Hira & Sons Billing — first-time client PC setup
REM Run this ONCE on the client's PC after cloning the repo.
REM ============================================================================

setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   Hira ^& Sons Billing — First-time Setup
echo ============================================================
echo.

REM ── 1. Verify Node.js is installed ──────────────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js is not installed.
  echo.
  echo     Install Node.js 24 LTS from https://nodejs.org/
  echo     Then re-run this script.
  echo.
  pause
  exit /b 1
)
echo [OK] Node.js detected:
node --version

REM ── 2. Verify pnpm is installed ─────────────────────────────────────────────
where pnpm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [..] Installing pnpm globally...
  call npm install -g pnpm
  if errorlevel 1 (
    echo [X] pnpm install failed. Run "npm install -g pnpm" manually.
    pause
    exit /b 1
  )
)
echo [OK] pnpm detected:
pnpm --version

REM ── 3. Check for .env ───────────────────────────────────────────────────────
if not exist ".env" (
  echo.
  echo [!] .env file not found.
  echo     Copy .env.example to .env and fill in:
  echo       - NEON_DATABASE_URL  (Postgres connection string)
  echo       - TELEGRAM_BOT_TOKEN ^(optional^)
  echo       - TELEGRAM_CHAT_ID   ^(optional^)
  echo       - CLOUDINARY_URL     ^(optional, for image uploads^)
  echo.
  echo     Then re-run this script.
  pause
  exit /b 1
)
echo [OK] .env present.

REM ── 4. Install dependencies ─────────────────────────────────────────────────
echo.
echo [..] Installing dependencies (this may take a few minutes)...
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo [X] pnpm install failed.
  pause
  exit /b 1
)
echo [OK] Dependencies installed.

REM ── 5. Push DB schema (idempotent — safe to run on existing DB) ─────────────
echo.
echo [..] Syncing database schema with Neon...
call pnpm --filter @workspace/db run push
if errorlevel 1 (
  echo [!] Schema push had warnings — check above. Continuing.
)

REM ── 6. Build production bundle ──────────────────────────────────────────────
echo.
echo [..] Building production bundle...
call pnpm run build:prod
if errorlevel 1 (
  echo [X] Build failed.
  pause
  exit /b 1
)
echo [OK] Build complete.

REM ── 7. Try to install ngrok via winget ──────────────────────────────────────
where ngrok >nul 2>nul
if errorlevel 1 (
  echo.
  echo [..] ngrok not found. Installing via winget...
  winget install ngrok.ngrok --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo [!] winget install failed. Install ngrok manually from https://ngrok.com/download
  )
) else (
  echo [OK] ngrok already installed.
)

REM ── 8. Done ─────────────────────────────────────────────────────────────────
echo.
echo ============================================================
echo   Setup complete!
echo ============================================================
echo.
echo   Next steps:
echo.
echo   1. Sign up at https://ngrok.com/ (free, Google login works)
echo.
echo   2. Copy your authtoken from the ngrok dashboard, then run:
echo        ngrok config add-authtoken YOUR_TOKEN_HERE
echo.
echo   3. (Recommended) Reserve a free static domain at
echo      https://dashboard.ngrok.com/domains
echo      Then save it on this PC:
echo        setx NGROK_DOMAIN your-name.ngrok-free.app
echo      (close and reopen this terminal after running setx)
echo.
echo   4. Double-click start.bat to launch the billing software.
echo.
echo   See CLIENT_DEPLOY.md for full instructions.
echo.
pause
