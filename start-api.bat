@echo off
echo Starting Codex API Server...
echo.

REM Add Node.js and npm to PATH for this session
set PATH=%PATH%;C:\Program Files\nodejs
set PATH=%PATH%;%APPDATA%\npm

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo Please ensure Node.js is installed.
    pause
    exit /b 1
)

REM Check if pnpm is available
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing pnpm...
    npm install -g pnpm
)

echo Node.js: 
node --version
echo pnpm: 
pnpm --version
echo.

echo Starting API development server...
echo Access the API at: http://localhost:4000
echo Health check: http://localhost:4000/healthz
echo Metrics: http://localhost:4000/metrics
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the development server
pnpm --filter @codex/api dev