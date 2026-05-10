@echo off
REM ============================================================================
REM Counter Billing — One-click license key generator (admin tool)
REM
REM Double-click this file to generate a license key for a customer.
REM Prompts for the shop name, expiry date, and edition. Auto-saves
REM your LICENSE_SECRET to .license-secret on first run (gitignored).
REM Copies the generated key straight to your clipboard.
REM ============================================================================

cd /d "%~dp0"

echo.
echo  +------------------------------------------------------------+
echo  ^|        Counter Billing - License Key Generator             ^|
echo  +------------------------------------------------------------+
echo.

call pnpm --filter @workspace/scripts run gen-license
if errorlevel 1 (
  echo.
  echo [X] Generation failed. See error above.
  pause
  exit /b 1
)

echo.
pause
