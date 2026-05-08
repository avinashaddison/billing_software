@echo off
REM ============================================================================
REM LAN-only launcher — no internet tunnel, accessible only on shop WiFi.
REM Use this if internet is down or you don't need phone-camera scanning.
REM Mobile cameras WILL NOT work over plain HTTP — use start.bat for that.
REM ============================================================================

cd /d "%~dp0"

set NODE_ENV=production
if "%PORT%"=="" set PORT=3000

echo.
echo ============================================================
echo   Hira ^& Sons Billing  (LAN-only)
echo   Local PC:    http://localhost:%PORT%
echo   Other devs:  http://YOUR-PC-IP:%PORT%   (run "ipconfig" to find IP)
echo ============================================================
echo.

node --enable-source-maps --env-file-if-exists=.env artifacts\api-server\dist\index.mjs
