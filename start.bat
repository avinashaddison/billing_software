@echo off
REM ============================================================================
REM Hira & Sons Billing - production launcher
REM Runs the local server (port 3000) and the ngrok tunnel for phone access.
REM Does NOT auto-update on boot - updates are deliberate via update.bat
REM (run from the developer's AnyDesk session) so a broken push can never
REM stop the shop from billing.
REM ============================================================================

cd /d "%~dp0"

set NODE_ENV=production
if "%PORT%"=="" set PORT=3000

echo.
echo ============================================================
echo   Hira ^& Sons Billing
echo   Local URL:  http://localhost:%PORT%
echo ============================================================
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
