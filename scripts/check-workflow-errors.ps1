# Quick Workflow Error Checker

Write-Host "🔍 Checking Recent Workflow Failures..." -ForegroundColor Cyan

Write-Host "`nBased on your screenshot, I can see:" -ForegroundColor Yellow
Write-Host "❌ All 5 recent workflow runs FAILED" -ForegroundColor Red
Write-Host ""

Write-Host "Common causes:" -ForegroundColor Yellow
Write-Host "1. Dockerfile syntax error"
Write-Host "2. Missing dependencies in package.json"
Write-Host "3. TypeScript compilation errors"
Write-Host "4. Workflow YAML syntax errors"
Write-Host "5. GitHub permissions issues"
Write-Host ""

Write-Host "📋 To see the actual error:" -ForegroundColor Cyan
Write-Host "1. Click on the 'v0.1.0-staging' run (3rd one in your screenshot)"
Write-Host "2. Click on the 'Build and Push Image' job"
Write-Host "3. Expand the failing step (will have a red X)"
Write-Host "4. Look for 'ERROR' in the logs"
Write-Host ""

Write-Host "🔗 Direct link:" -ForegroundColor Cyan
Write-Host "https://github.com/rennai455/pos-imagration-service-/actions/runs/YOUR_RUN_ID"
Write-Host ""

Write-Host "⚡ Quick checks we can do locally:" -ForegroundColor Yellow

# Check if Dockerfile exists
if (Test-Path "Dockerfile") {
    Write-Host "✅ Dockerfile exists" -ForegroundColor Green
} else {
    Write-Host "❌ Dockerfile NOT FOUND" -ForegroundColor Red
}

# Check if package.json exists
if (Test-Path "package.json") {
    Write-Host "✅ package.json exists" -ForegroundColor Green
} else {
    Write-Host "❌ package.json NOT FOUND" -ForegroundColor Red
}

# Check if API package.json exists
if (Test-Path "packages/api/package.json") {
    Write-Host "✅ packages/api/package.json exists" -ForegroundColor Green
} else {
    Write-Host "❌ packages/api/package.json NOT FOUND" -ForegroundColor Red
}

# Try to validate Dockerfile syntax
Write-Host "`n📝 Checking Dockerfile syntax..." -ForegroundColor Cyan
try {
    $dockerfile = Get-Content "Dockerfile" -Raw
    if ($dockerfile -match "FROM\s+") {
        Write-Host "✅ Dockerfile has FROM instruction" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Dockerfile may be malformed" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error reading Dockerfile: $_" -ForegroundColor Red
}

# Check if we can build locally
Write-Host "`n🔧 Want to test the build locally?" -ForegroundColor Yellow
Write-Host "Run: docker build -t test-build ."
Write-Host ""

Write-Host "📱 NEXT STEP:" -ForegroundColor Cyan
Write-Host "Click on the failed workflow run in GitHub to see the actual error message."
Write-Host "The error will tell us exactly what's wrong!"
