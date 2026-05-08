@echo off
REM ============================================================================
REM Hira & Sons Billing - production launcher
REM Runs both the local server (port 3000) and the ngrok tunnel for phone access.
REM Auto-pulls and rebuilds latest code on launch (best-effort, skips if offline).
REM Double-click to start. Close the window or press Ctrl+C to stop.
REM ============================================================================

cd /d "%~dp0"

set NODE_ENV=production
if "%PORT%"=="" set PORT=3000

echo.
echo ============================================================
echo   Hira ^& Sons Billing
echo ============================================================
echo.

REM ── Best-effort auto-update (skips silently if no internet) ────────────────
echo [..] Checking for updates...
git pull --ff-only >nul 2>&1
if errorlevel 1 (
  echo [!] Skipping update - no internet or unmerged local changes.
) else (
  for /f %%H in ('git rev-parse HEAD') do set NEW_HEAD=%%H
  if not exist .last_build_head goto build_now
  set /p LAST_HEAD=<.last_build_head
  if "%LAST_HEAD%"=="%NEW_HEAD%" (
    echo [OK] Already up to date. Skipping rebuild.
    goto run_server
  )
  :build_now
  echo [..] New code pulled. Rebuilding ^(takes ~1 min^)...
  call pnpm install --frozen-lockfile >nul 2>&1
  call pnpm --filter @workspace/db run push >nul 2>&1
  call pnpm run build:prod >nul 2>&1
  if errorlevel 1 (
    echo [X] Build failed. Starting previous build instead.
  ) else (
    echo %NEW_HEAD%>.last_build_head
    echo [OK] Update complete.
  )
)

:run_server
echo.
echo   Local URL:  http://localhost:%PORT%
echo.

REM ── Start the API server in a new window ────────────────────────────────────
start "Billing Server" cmd /k node --enable-source-maps --env-file-if-exists=.env artifacts\api-server\dist\index.mjs

REM ── Wait a couple seconds for the server to bind, then start ngrok ─────────
timeout /t 3 /nobreak >nul

REM Use the static domain set during setup; if it's unset, ngrok will pick a random one
if defined NGROK_DOMAIN (
  start "Billing Tunnel" cmd /k ngrok http --domain=%NGROK_DOMAIN% %PORT%
) else (
  start "Billing Tunnel" cmd /k ngrok http %PORT%
)

echo.
echo Both windows are running. Close them to stop the app.
echo The HTTPS phone-scanner URL is shown in the "Billing Tunnel" window.
echo.
pause
