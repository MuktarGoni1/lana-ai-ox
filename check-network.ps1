# Get network information
Write-Host "`n=== Network Interface Information ===" -ForegroundColor Cyan
$networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" }

foreach ($adapter in $networkAdapters) {
    Write-Host "`nInterface: $($adapter.InterfaceAlias)" -ForegroundColor Yellow
    Write-Host "IP Address: $($adapter.IPAddress)" -ForegroundColor Green
    Write-Host "Prefix Length: $($adapter.PrefixLength)"
}

Write-Host "`n=== Default Gateway ===" -ForegroundColor Cyan
Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Select-Object -First 1 | ForEach-Object {
    Write-Host "Gateway: $($_.NextHop)" -ForegroundColor Green
}

Write-Host "`n=== Firewall Status for Ports 3000 and 8000 ===" -ForegroundColor Cyan
$rules = Get-NetFirewallRule | Where-Object { 
    $_.DisplayName -like "*LANA*" -or 
    $_.DisplayName -like "*3000*" -or 
    $_.DisplayName -like "*8000*" 
}

if ($rules.Count -eq 0) {
    Write-Host "⚠️  No firewall rules found for LANA AI ports" -ForegroundColor Yellow
    Write-Host "`nTo allow network access, run these commands as Administrator:" -ForegroundColor Yellow
    Write-Host "New-NetFirewallRule -DisplayName 'LANA AI Frontend' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow" -ForegroundColor White
    Write-Host "New-NetFirewallRule -DisplayName 'LANA AI Backend' -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow" -ForegroundColor White
} else {
    foreach ($rule in $rules) {
        Write-Host "`nRule: $($rule.DisplayName)" -ForegroundColor Green
        Write-Host "Enabled: $($rule.Enabled)"
        Write-Host "Direction: $($rule.Direction)"
        Write-Host "Action: $($rule.Action)"
    }
}

Write-Host "`n=== Port Listening Status ===" -ForegroundColor Cyan
$listening = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 3000 -or $_.LocalPort -eq 8000 }

if ($listening) {
    foreach ($port in $listening) {
        Write-Host "`nPort $($port.LocalPort) is LISTENING on $($port.LocalAddress)" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  Ports 3000 or 8000 are not currently listening" -ForegroundColor Yellow
    Write-Host "Make sure both servers are running!" -ForegroundColor Yellow
}

Write-Host "`n=== Quick Test URLs ===" -ForegroundColor Cyan
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress
Write-Host "Your Local IP: $localIP" -ForegroundColor Green
Write-Host "`nFrontend URLs:" -ForegroundColor Yellow
Write-Host "  Local:   http://localhost:3000"
Write-Host "  Network: http://$($localIP):3000"
Write-Host "`nBackend URLs:" -ForegroundColor Yellow
Write-Host "  Local:   http://localhost:8000/health"
Write-Host "  Network: http://$($localIP):8000/health"

Write-Host "`n=== Testing Backend Health ===" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Backend is responding!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)"
} catch {
    Write-Host "❌ Backend is not responding" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)"
}

Write-Host "`n" 
