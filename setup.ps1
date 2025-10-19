# Codex Retail OS - PowerShell Setup Script
# Run this script after installing Node.js 20 LTS

Write-Host "====================================" -ForegroundColor Green
Write-Host "Codex Retail OS - Setup Script" -ForegroundColor Green  
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js 20 LTS from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Then run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if pnpm is installed
try {
    $pnpmVersion = pnpm --version
    Write-Host "✓ pnpm found: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ERROR: Failed to install pnpm" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    $pnpmVersion = pnpm --version
    Write-Host "✓ pnpm installed: $pnpmVersion" -ForegroundColor Green
}

Write-Host ""
Write-Host "Installing project dependencies..." -ForegroundColor Yellow
pnpm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green

Write-Host ""
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
pnpm --filter @codex/db prisma generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ WARNING: Prisma generation failed (this is OK if database isn't configured yet)" -ForegroundColor Yellow
} else {
    Write-Host "✓ Prisma client generated" -ForegroundColor Green
}

Write-Host ""
Write-Host "Building API package..." -ForegroundColor Yellow
pnpm --filter @codex/api build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: API build failed" -ForegroundColor Red
    Write-Host "This might be due to missing dependencies or TypeScript errors" -ForegroundColor Yellow
} else {
    Write-Host "✓ API built successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "Building Admin package..." -ForegroundColor Yellow
pnpm --filter @codex/admin build

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ WARNING: Admin build failed (dependencies may be missing)" -ForegroundColor Yellow
} else {
    Write-Host "✓ Admin built successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "Setting up environment file..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item "infra\app\environments\dev.env.example" ".env"
    Write-Host "✓ Created .env file from template" -ForegroundColor Green
    Write-Host "IMPORTANT: Edit .env file with your actual configuration values" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Check if Docker is available
Write-Host ""
Write-Host "Checking Docker availability..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker found: $dockerVersion" -ForegroundColor Green
    
    Write-Host "Testing Docker build..." -ForegroundColor Yellow
    docker build -t codex-api-test . --quiet
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker build successful" -ForegroundColor Green
        docker rmi codex-api-test --force | Out-Null
    } else {
        Write-Host "⚠ Docker build failed - check Dockerfile and dependencies" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Docker not found - install Docker Desktop if you plan to use containers" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file with your configuration" -ForegroundColor White
Write-Host "2. Set up Supabase database connection" -ForegroundColor White
Write-Host "3. Start development server:" -ForegroundColor White
Write-Host "   pnpm --filter @codex/api dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Optional commands:" -ForegroundColor Cyan
Write-Host "- Start admin dashboard: pnpm --filter @codex/admin dev" -ForegroundColor Gray
Write-Host "- Start mobile SDK: pnpm --filter @codex/sdk start" -ForegroundColor Gray
Write-Host "- Run tests: pnpm --filter @codex/api test" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to continue"