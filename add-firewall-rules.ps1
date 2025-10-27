# Run this script as Administrator to add firewall rules for LANA AI

Write-Host "`n=== Adding Windows Firewall Rules for LANA AI ===" -ForegroundColor Cyan

# Remove old rules if they exist
Write-Host "`nRemoving old rules (if any)..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "LANA AI Frontend" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "LANA AI Backend" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "LanaBackend" -ErrorAction SilentlyContinue

# Add Frontend rule (Port 3000)
Write-Host "`nAdding Frontend rule (Port 3000)..." -ForegroundColor Yellow
try {
    New-NetFirewallRule `
        -DisplayName "LANA AI Frontend" `
        -Direction Inbound `
        -LocalPort 3000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -Enabled True `
        -Description "Allow access to LANA AI Next.js frontend on port 3000"
    Write-Host "✅ Frontend rule added successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to add frontend rule: $_" -ForegroundColor Red
}

# Add Backend rule (Port 8000)
Write-Host "`nAdding Backend rule (Port 8000)..." -ForegroundColor Yellow
try {
    New-NetFirewallRule `
        -DisplayName "LANA AI Backend" `
        -Direction Inbound `
        -LocalPort 8000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -Enabled True `
        -Description "Allow access to LANA AI FastAPI backend on port 8000"
    Write-Host "✅ Backend rule added successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to add backend rule: $_" -ForegroundColor Red
}

# Verify rules
Write-Host "`n=== Verifying Firewall Rules ===" -ForegroundColor Cyan
Get-NetFirewallRule -DisplayName "LANA AI*" | Select-Object DisplayName, Enabled, Direction, Action | Format-Table

Write-Host "`n✅ Firewall configuration complete!" -ForegroundColor Green
Write-Host "`nYou can now access LANA AI from other devices on your network:" -ForegroundColor Yellow
Write-Host "  Frontend: http://192.168.0.187:3000" -ForegroundColor White
Write-Host "  Backend:  http://192.168.0.187:8000" -ForegroundColor White
Write-Host "`n"
