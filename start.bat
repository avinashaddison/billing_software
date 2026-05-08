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

REM ── Wait for server to be ready, then open in Chrome ──────────────────────
echo.
echo Waiting for server to come up, then opening Chrome...
timeout /t 5 /nobreak >nul

REM Try Chrome first; fall back to default browser if Chrome isn't installed
set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe"        set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"   set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe"        set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME_EXE (
  start "" "%CHROME_EXE%" --new-window "http://localhost:%PORT%"
) else (
  echo Chrome not found. Opening in default browser instead.
  start "" "http://localhost:%PORT%"
)

echo.
echo App opened in browser.
echo Server / Tunnel windows are running in the background.
echo Close them to stop the app.
echo.
pause
