# Codex API Server Startup Script
Write-Host "=====================================" -ForegroundColor Green
Write-Host "Starting Codex API Server" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

# Add Node.js and npm to PATH for this session
$env:PATH += ";C:\Program Files\nodejs"
$env:PATH += ";$env:APPDATA\npm"

# Check if Node.js is available
try {
    $nodeVersion = & node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: Node.js not found!" -ForegroundColor Red
    Write-Host "Please ensure Node.js is installed." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if pnpm is available
try {
    $pnpmVersion = & pnpm --version
    Write-Host "✓ pnpm found: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "Installing pnpm..." -ForegroundColor Yellow
    & npm install -g pnpm
    $pnpmVersion = & pnpm --version
    Write-Host "✓ pnpm installed: $pnpmVersion" -ForegroundColor Green
}
}

Write-Host ""
Write-Host "Server Information:" -ForegroundColor Cyan
Write-Host "- API URL: http://localhost:4000" -ForegroundColor White
Write-Host "- Health Check: http://localhost:4000/healthz" -ForegroundColor White
Write-Host "- Metrics: http://localhost:4000/metrics" -ForegroundColor White
Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Start the development server
& pnpm --filter @codex/api dev