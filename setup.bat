@echo off
echo ====================================
echo Codex Retail OS - Setup Script
echo ====================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js 20 LTS from https://nodejs.org/
    echo Then run this script again.
    pause
    exit /b 1
)

echo ✓ Node.js found: 
node --version

REM Check if pnpm is installed
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing pnpm...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install pnpm
        pause
        exit /b 1
    )
)

echo ✓ pnpm found:
pnpm --version

echo.
echo Installing project dependencies...
pnpm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Generating Prisma client...
pnpm --filter @codex/db prisma generate
if %errorlevel% neq 0 (
    echo WARNING: Prisma generation failed (this is OK if database isn't configured yet)
)

echo.
echo Building API package...
pnpm --filter @codex/api build
if %errorlevel% neq 0 (
    echo ERROR: API build failed
    pause
    exit /b 1
)

echo.
echo Building Admin package...
pnpm --filter @codex/admin build
if %errorlevel% neq 0 (
    echo WARNING: Admin build failed (dependencies may be missing)
)

echo.
echo Setting up environment file...
if not exist .env (
    copy "infra\app\environments\dev.env.example" .env
    echo ✓ Created .env file from template
    echo IMPORTANT: Edit .env file with your actual configuration values
) else (
    echo ✓ .env file already exists
)

echo.
echo ====================================
echo Setup Complete! 
echo ====================================
echo.
echo Next steps:
echo 1. Edit .env file with your configuration
echo 2. Set up Supabase database connection
echo 3. Run: pnpm --filter @codex/api dev
echo.
echo Optional: Test Docker build with:
echo   docker build -t codex-api .
echo.
pause