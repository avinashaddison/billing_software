@echo off
REM ============================================================================
REM AddisonX Billing Software - One-click update
REM
REM cmd.exe reads .bat files line-by-line FROM DISK as it runs them. If
REM "git pull" rewrites this file mid-execution, cmd resumes reading at the
REM old byte offset into the new file content and lands mid-word, breaking
REM the script. To avoid that, the pull happens first, THEN the script
REM re-launches a fresh copy of itself with --continue to do the rest.
REM ============================================================================

cd /d "%~dp0"

REM If we were re-launched after the pull, skip straight to the build steps
if /i "%~1"=="--continue" goto AfterPull

echo.
echo  +------------------------------------------------------------+
echo  ^|     AddisonX Billing Software - Update                     ^|
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
echo [..] Re-launching with the latest update.bat...
REM Use cmd /c with a fresh process so the re-pulled update.bat is loaded
REM cleanly. /wait makes us inherit its exit code.
cmd /c ""%~f0" --continue"
exit /b %ERRORLEVEL%

:AfterPull
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
echo  ^|     UPDATE DONE - Restarting now...                        ^|
echo  +------------------------------------------------------------+
echo.

REM Kill the running server + tunnel so the new code can take over.
REM /T also kills any child processes (vite, scripts) just in case.
echo [..] Stopping old server windows...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM ngrok.exe /T >nul 2>&1

REM Give the OS a moment to release port 3000 before start.bat rebinds
timeout /t 2 /nobreak >nul

echo [..] Launching new server...
start "" "%~dp0start.bat"

echo.
echo  +------------------------------------------------------------+
echo  ^|  ALL DONE                                                  ^|
echo  ^|  The browser will refresh automatically. If you don't see  ^|
echo  ^|  the new look, press Ctrl+F5 in the browser once.          ^|
echo  +------------------------------------------------------------+
echo.
timeout /t 5 /nobreak >nul
