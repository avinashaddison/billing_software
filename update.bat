@echo off
REM ============================================================================
REM Counter Billing - One-click update
REM Pulls latest from GitHub, reinstalls deps, rebuilds, syncs DB schema.
REM Double-click this when the developer says "I shipped a fix".
REM ============================================================================

cd /d "%~dp0"

echo.
echo  +------------------------------------------------------------+
echo  ^|     Counter Billing - Update                           ^|
echo  +------------------------------------------------------------+
echo.

echo [..] Pulling latest changes from GitHub...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo [X] Update failed. Check your internet connection.
  echo     If it still fails, call the developer.
  echo.
  pause
  exit /b 1
)
echo [OK] Pulled.

echo.
echo [..] Updating dependencies...
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo [X] Dependency install failed. Call the developer.
  pause
  exit /b 1
)
echo [OK] Dependencies up to date.

echo.
echo [..] Syncing database schema (in case anything changed)...
call pnpm --filter @workspace/db run push
echo [OK] Schema synced.

echo.
echo [..] Building production bundle...
call pnpm run build:prod
if errorlevel 1 (
  echo [X] Build failed. Call the developer.
  pause
  exit /b 1
)
echo [OK] Build complete.

echo.
echo  +------------------------------------------------------------+
echo  ^|     UPDATE DONE                                            ^|
echo  +------------------------------------------------------------+
echo.
echo   IMPORTANT: Close any running "Billing Server" / "Billing Tunnel"
echo   windows, then double-click start.bat to relaunch with the new code.
echo.
pause
