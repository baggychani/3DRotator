@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Creating local Python environment...
  py -m venv .venv
  if errorlevel 1 goto error
  ".venv\Scripts\python.exe" -m pip install -r requirements-dev.txt
  if errorlevel 1 goto error
)

echo Starting 3D Rotator...
".venv\Scripts\python.exe" server.py
goto end

:error
echo.
echo Failed to start 3D Rotator. Please check that Python is installed.
pause

:end
