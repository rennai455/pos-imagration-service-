#!/usr/bin/env pwsh
# Test migration creation and validation
# Run this AFTER starting Docker Desktop

Write-Host "🔍 Testing Idempotency Migration..." -ForegroundColor Cyan

# Check if Docker is running
Write-Host "`n1️⃣ Checking Docker..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    docker ps | Out-Null
    $dockerRunning = $true
    Write-Host "   ✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Docker is NOT running" -ForegroundColor Red
    Write-Host "`n   📋 TODO: Start Docker Desktop manually" -ForegroundColor Yellow
    Write-Host "   Then run: docker-compose up -d" -ForegroundColor Yellow
    exit 1
}

# Start database if needed
Write-Host "`n2️⃣ Starting PostgreSQL..." -ForegroundColor Yellow
Push-Location $PSScriptRoot\..
docker-compose up -d
Start-Sleep -Seconds 3

# Check database connection
Write-Host "`n3️⃣ Testing database connection..." -ForegroundColor Yellow
Push-Location packages\api
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/codex_pos_dev"

$dbConnected = $false
for ($i = 1; $i -le 10; $i++) {
    try {
        $testQuery = "SELECT 1;"
        $testQuery | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $dbConnected = $true
            Write-Host "   ✅ Database connected" -ForegroundColor Green
            break
        }
    } catch {}
    Write-Host "   ⏳ Waiting for DB... ($i/10)" -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

if (-not $dbConnected) {
    Write-Host "   ❌ Database connection failed" -ForegroundColor Red
    exit 1
}

# Apply migration
Write-Host "`n4️⃣ Applying idempotency migration..." -ForegroundColor Yellow
pnpm prisma migrate deploy --schema=./prisma/schema.prisma
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Migration failed" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Migration applied" -ForegroundColor Green

# Validate table exists
Write-Host "`n5️⃣ Validating idempotency_keys table..." -ForegroundColor Yellow
$validateSQL = @"
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'idempotency_keys' 
ORDER BY ordinal_position;
"@

$result = $validateSQL | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1
if ($LASTEXITCODE -eq 0 -and $result -match "tenantId" -and $result -match "key") {
    Write-Host "   ✅ Table structure validated" -ForegroundColor Green
} else {
    Write-Host "   ❌ Table validation failed" -ForegroundColor Red
    Write-Host "   Output: $result" -ForegroundColor Gray
    exit 1
}

# Test unique constraint
Write-Host "`n6️⃣ Testing unique constraint..." -ForegroundColor Yellow
$testInsert1 = "INSERT INTO idempotency_keys (id, ""tenantId"", key) VALUES ('test1', 't1', 'k1');"
$testInsert2 = "INSERT INTO idempotency_keys (id, ""tenantId"", key) VALUES ('test2', 't1', 'k1');"
$testCleanup = "DELETE FROM idempotency_keys WHERE id IN ('test1', 'test2');"

$testInsert1 | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ First insert failed (shouldn't happen)" -ForegroundColor Red
    exit 1
}

$testInsert2 | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ❌ Duplicate insert succeeded (unique constraint not working)" -ForegroundColor Red
    $testCleanup | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1 | Out-Null
    exit 1
}

$testCleanup | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1 | Out-Null
Write-Host "   ✅ Unique constraint working" -ForegroundColor Green

# Generate Prisma client
Write-Host "`n7️⃣ Generating Prisma Client..." -ForegroundColor Yellow
pnpm prisma generate --schema=./prisma/schema.prisma
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Client generation failed" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Prisma Client generated" -ForegroundColor Green

Pop-Location
Pop-Location

Write-Host "`n✅ ALL TESTS PASSED!" -ForegroundColor Green
Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Start API: pnpm dev:api" -ForegroundColor White
Write-Host "   2. Run smoke test: bash scripts/smoke.sh" -ForegroundColor White
Write-Host "   3. Run load test: node scripts/dedup-loadtest.mjs ..." -ForegroundColor White
