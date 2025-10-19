# Network diagnose script for Windows PowerShell
# Checks IPv4/IPv6 loopback, netstat, firewall status, and hosts entries
Write-Host "== Network Diagnostic ==" -ForegroundColor Cyan

Write-Host "Checking loopback connectivity (IPv4 and IPv6)..." -ForegroundColor Yellow
Test-NetConnection -ComputerName 127.0.0.1 -Port 4000 | Format-List
Test-NetConnection -ComputerName ::1 -Port 4000 | Format-List

Write-Host "\nListing processes using port 4000..." -ForegroundColor Yellow
netstat -ano | findstr ":4000"

Write-Host "\nChecking Windows Firewall rules (filtering for node or 4000)..." -ForegroundColor Yellow
Get-NetFirewallRule -PolicyStore ActiveStore | Where-Object { $_.DisplayName -like '*node*' -or $_.DisplayName -like '*4000*' } | Format-Table -AutoSize

Write-Host "\nChecking hosts file entries for localhost..." -ForegroundColor Yellow
Get-Content -Path "$env:WinDir\System32\drivers\etc\hosts" | Select-String -Pattern 'localhost' | ForEach-Object { $_.Line }

Write-Host "\nDiagnostic complete. If loopback IPv4 works but IPv6 doesn't, consider forcing Fastify to bind to 127.0.0.1." -ForegroundColor Green
