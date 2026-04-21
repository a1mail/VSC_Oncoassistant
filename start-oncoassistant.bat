@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo OncoAssistant - System startup
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found! Download from https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm not found!
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies... This may take 2-5 minutes
  echo.
  call npm install
  if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
  )
)

echo.
echo Starting server... Opening browser on http://localhost:3000
echo Press Ctrl+C to exit
echo.

timeout /t 2 /nobreak >nul 2>&1
start "" http://localhost:3000

call npm run dev

pause
