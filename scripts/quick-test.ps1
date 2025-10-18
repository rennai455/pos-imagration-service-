# Quick API test script
Write-Host "Testing API endpoints..." -ForegroundColor Cyan

# Test /healthz
Write-Host "`n[1/3] Testing /healthz..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:4000/healthz" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "      [OK] /healthz returned 200" -ForegroundColor Green
        Write-Host "      Response: $($response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "      [ERROR] /healthz failed: $_" -ForegroundColor Red
    exit 1
}

# Test /metrics
Write-Host "`n[2/3] Testing /metrics..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:4000/metrics" -UseBasicParsing
    if ($response.StatusCode -eq 200 -and $response.Content -match "# HELP") {
        Write-Host "      [OK] /metrics returned Prometheus format" -ForegroundColor Green
    }
} catch {
    Write-Host "      [ERROR] /metrics failed: $_" -ForegroundColor Red
    exit 1
}

# Test /pos/:source/ingest
Write-Host "`n[3/3] Testing /pos/demo/ingest..." -ForegroundColor Yellow
$payload = @{
    sku = "SMOKE-TEST"
    qty = 1
    price = 999
    ts = (Get-Date -Format "o")
} | ConvertTo-Json -Compress

$secret = "test-secret-key-at-least-32-characters-long"
$hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($secret))
$hash = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($payload))
$signature = "sha256=" + [System.BitConverter]::ToString($hash).Replace("-", "").ToLower()

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:4000/pos/demo/ingest" `
        -Method POST `
        -Headers @{
            "content-type" = "application/json"
            "x-tenant-id" = "t1"
            "x-signature" = $signature
        } `
        -Body $payload `
        -UseBasicParsing
    
    if ($response.StatusCode -in @(200, 201, 204)) {
        Write-Host "      [OK] /pos/demo/ingest returned $($response.StatusCode)" -ForegroundColor Green
    }
} catch {
    Write-Host "      [ERROR] /pos/demo/ingest failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== ALL TESTS PASSED ===" -ForegroundColor Green
