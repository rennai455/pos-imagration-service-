# Complete Diagnostic and Test Script
# Tests database, API, and idempotency functionality

Write-Host "=== COMPLETE SYSTEM DIAGNOSTIC ===" -ForegroundColor Cyan

# Configuration
$API_URL = "http://127.0.0.1:4000"
$WEBHOOK_SECRET = "test-secret-key-at-least-32-characters-long"
$DB_URL = "postgresql://postgres:password@localhost:5432/codex_pos_dev"

$results = @{
    timestamp = Get-Date -Format "o"
    tests = @()
}

function Add-Result($name, $status, $message, $details = $null) {
    $results.tests += @{
        name = $name
        status = $status
        message = $message
        details = $details
    }
    
    $color = if ($status -eq "PASS") { "Green" } elseif ($status -eq "FAIL") { "Red" } else { "Yellow" }
    Write-Host "[$status] $name - $message" -ForegroundColor $color
}

# Test 1: Docker
Write-Host "`n[1/7] Docker Status..." -ForegroundColor Yellow
try {
    $dockerPs = docker ps --format "{{.Names}}" 2>&1
    if ($dockerPs -match "pos-imagration-service--db-1") {
        Add-Result "Docker" "PASS" "PostgreSQL container running"
    } else {
        Add-Result "Docker" "FAIL" "PostgreSQL container not found"
    }
} catch {
    Add-Result "Docker" "FAIL" "Docker not accessible: $_"
}

# Test 2: Database Connection
Write-Host "`n[2/7] Database Connection..." -ForegroundColor Yellow
Push-Location packages\api
$env:DATABASE_URL = $DB_URL
try {
    $query = "SELECT 1;"
    $result = $query | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-Result "Database Connection" "PASS" "Connected to codex_pos_dev"
    } else {
        Add-Result "Database Connection" "FAIL" "Connection failed" $result
    }
} catch {
    Add-Result "Database Connection" "FAIL" "Error: $_"
}

# Test 3: Migration Status
Write-Host "`n[3/7] Migration Status..." -ForegroundColor Yellow
try {
    $migrationStatus = pnpm prisma migrate status --schema=./prisma/schema.prisma 2>&1
    if ($migrationStatus -match "Database schema is up to date") {
        Add-Result "Migrations" "PASS" "All migrations applied"
    } else {
        Add-Result "Migrations" "WARN" "Migrations may need attention" $migrationStatus
    }
} catch {
    Add-Result "Migrations" "FAIL" "Error checking migrations: $_"
}

# Test 4: Idempotency Table
Write-Host "`n[4/7] Idempotency Table..." -ForegroundColor Yellow
try {
    $query = "SELECT COUNT(*) as count FROM idempotency_keys;"
    $result = $query | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-Result "Idempotency Table" "PASS" "Table exists and queryable"
    } else {
        Add-Result "Idempotency Table" "FAIL" "Table query failed" $result
    }
} catch {
    Add-Result "Idempotency Table" "FAIL" "Error: $_"
}

# Test 5: Unique Constraint
Write-Host "`n[5/7] Unique Constraint..." -ForegroundColor Yellow
try {
    $testId = "diag-$(Get-Random)"
    $insert1 = "INSERT INTO idempotency_keys (id, ""tenantId"", key, ""createdAt"") VALUES ('$testId-1', 'test', 'key1', CURRENT_TIMESTAMP);"
    $insert2 = "INSERT INTO idempotency_keys (id, ""tenantId"", key, ""createdAt"") VALUES ('$testId-2', 'test', 'key1', CURRENT_TIMESTAMP);"
    $cleanup = "DELETE FROM idempotency_keys WHERE id LIKE '$testId%';"
    
    # First insert should succeed
    $insert1 | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1 | Out-Null
    
    # Second insert should fail
    $result = $insert2 | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1
    
    # Cleanup
    $cleanup | pnpm prisma db execute --stdin --schema=./prisma/schema.prisma 2>&1 | Out-Null
    
    if ($result -match "P2002" -or $result -match "Unique constraint") {
        Add-Result "Unique Constraint" "PASS" "Constraint prevents duplicates (P2002)"
    } else {
        Add-Result "Unique Constraint" "FAIL" "Duplicate insert succeeded!" $result
    }
} catch {
    Add-Result "Unique Constraint" "FAIL" "Error: $_"
}

Pop-Location

# Test 6: API Health (if running)
Write-Host "`n[6/7] API Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/healthz" -TimeoutSec 2 -ErrorAction Stop
    Add-Result "API Health" "PASS" "API responding on port 4000" $response
} catch {
    Add-Result "API Health" "SKIP" "API not running or not reachable (this is OK for database tests)"
}

# Test 7: .env Configuration
Write-Host "`n[7/7] Configuration Check..." -ForegroundColor Yellow
$envPath = "packages\api\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "postgresql://postgres:password@localhost:5432/codex_pos_dev") {
        Add-Result "Configuration" "PASS" ".env has correct DATABASE_URL"
    } else {
        Add-Result "Configuration" "WARN" ".env DATABASE_URL may be incorrect"
    }
    
    if ($envContent -match "WEBHOOK_SECRET") {
        Add-Result "WEBHOOK_SECRET" "PASS" "WEBHOOK_SECRET configured"
    } else {
        Add-Result "WEBHOOK_SECRET" "WARN" "WEBHOOK_SECRET not in .env"
    }
} else {
    Add-Result "Configuration" "FAIL" ".env file not found"
}

# Summary
Write-Host "`n=== DIAGNOSTIC SUMMARY ===" -ForegroundColor Cyan
$passed = ($results.tests | Where-Object { $_.status -eq "PASS" }).Count
$failed = ($results.tests | Where-Object { $_.status -eq "FAIL" }).Count
$warned = ($results.tests | Where-Object { $_.status -eq "WARN" }).Count
$skipped = ($results.tests | Where-Object { $_.status -eq "SKIP" }).Count

Write-Host "Passed:  $passed" -ForegroundColor Green
Write-Host "Failed:  $failed" -ForegroundColor Red
Write-Host "Warning: $warned" -ForegroundColor Yellow
Write-Host "Skipped: $skipped" -ForegroundColor Gray

# Save results
$results | ConvertTo-Json -Depth 10 | Out-File "diagnostic-results.json"
Write-Host "`nResults saved to diagnostic-results.json" -ForegroundColor Cyan

# Exit code
if ($failed -gt 0) {
    Write-Host "`n[FAIL] Some tests failed" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n[SUCCESS] All critical tests passed" -ForegroundColor Green
    exit 0
}
