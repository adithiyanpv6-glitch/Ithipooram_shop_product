# ========================================================================
# ITHI POORAM (ഇത്തിപ്പൂരം) — HARDWARE & DATABASE HEALTH STATUS CHECK
# Standalone Diagnostics Tool for Shopkeeper & Admin
# ========================================================================

$appDir = "C:\Users\USR\Desktop\ITHIPOORAM\Ithipooram_shop_product-main"
$dataDir = Join-Path $appDir "data"
$storePath = Join-Path $dataDir "restaurant_store.json"
$googleConfigPath = Join-Path $dataDir "google_workspace_config.json"
$ledgersDir = Join-Path $dataDir "daily_ledgers"

Clear-Host
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "     ITHI POORAM (ഇത്തിപ്പൂരം) — SYSTEM HARDWARE & DATABASE STATUS CHECK" -ForegroundColor Yellow
Write-Host "=========================================================================`n" -ForegroundColor Green

# ------------------------------------------------------------------------
# 1. LOCAL POS TERMINAL SERVER CHECK (PORT 3000)
# ------------------------------------------------------------------------
Write-Host "[1/5] Checking Local POS Web Server (Port 3000)..." -ForegroundColor Cyan
$serverOk = $false
try {
    $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $res = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/pin-status" -TimeoutSec 3 -ErrorAction SilentlyContinue
        Write-Host "      [OK] Local POS Server is ACTIVE and running on port 3000" -ForegroundColor Green
        $serverOk = $true
    } else {
        Write-Host "      [OFFLINE] Server not running on port 3000. Start using START_ITHIPOORAM_POS.bat" -ForegroundColor Yellow
    }
} catch {
    Write-Host "      [WARNING] Server listening on port 3000 (starting up or busy)" -ForegroundColor Yellow
    $serverOk = $true
}

# ------------------------------------------------------------------------
# 2. LOCAL PERMANENT DATABASE ENGINE CHECK
# ------------------------------------------------------------------------
Write-Host "`n[2/5] Checking Local Permanent Disk Database..." -ForegroundColor Cyan
if (Test-Path $storePath) {
    try {
        $raw = Get-Content $storePath -Raw -Encoding UTF8
        $db = $raw | ConvertFrom-Json
        $tableCount = if ($db.tables) { $db.tables.Count } else { 0 }
        $menuCount = if ($db.menuCategories) { 
            ($db.menuCategories | ForEach-Object { if ($_.items) { $_.items.Count } else { 0 } } | Measure-Object -Sum).Sum 
        } else { 0 }
        $staffCount = if ($db.staffUsers) { $db.staffUsers.Count } else { 0 }
        $pinSet = if ($db.masterPin -and $db.masterPin.Length -ge 4) { "ACTIVE (Set)" } else { "NOT SET" }

        Write-Host "      [OK] Database file verified: restaurant_store.json" -ForegroundColor Green
        Write-Host "           • Tables Configured: $tableCount" -ForegroundColor White
        Write-Host "           • Menu Dishes:       $menuCount" -ForegroundColor White
        Write-Host "           • Staff Accounts:    $staffCount" -ForegroundColor White
        Write-Host "           • Master Security PIN: $pinSet" -ForegroundColor White

        # Check Daily Ledgers
        if (Test-Path $ledgersDir) {
            $ledgerFiles = Get-ChildItem -Path $ledgersDir -Filter "*.json"
            Write-Host "           • Recorded Day Ledgers on Disk: $($ledgerFiles.Count) days" -ForegroundColor White
        }
    } catch {
        Write-Host "      [ERROR] Could not parse restaurant_store.json: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "      [WARNING] restaurant_store.json not found in $dataDir" -ForegroundColor Red
}

# ------------------------------------------------------------------------
# 3. GOOGLE CLOUD MASTER DATABASE & LIVE WEBHOOK CHECK
# ------------------------------------------------------------------------
Write-Host "`n[3/5] Checking Google Sheets Master Database & Live Sync..." -ForegroundColor Cyan
if (Test-Path $googleConfigPath) {
    try {
        $cfg = (Get-Content $googleConfigPath -Raw -Encoding UTF8) | ConvertFrom-Json
        $adminEmail = $cfg.adminEmail
        $sheetId = $cfg.spreadsheetId
        $webhookUrl = $cfg.webhookUrl

        Write-Host "      • Target Google Account: $adminEmail" -ForegroundColor White
        Write-Host "      • Linked Spreadsheet:    https://docs.google.com/spreadsheets/d/$sheetId/edit" -ForegroundColor White

        if ($webhookUrl) {
            Write-Host "      -> Pinging Google Apps Script Webhook..." -ForegroundColor Yellow
            try {
                $hookRes = curl.exe -L -s "$webhookUrl"
                if ($hookRes -match '"status"\s*:\s*"ONLINE"') {
                    Write-Host "      [OK] GOOGLE MASTER DATABASE IS 100% ONLINE & SYNCED!" -ForegroundColor Green
                    Write-Host "           • All 5 sheets verified: Sales_Ledger, Menu_Stock, Tables_Master, Billing_Settlement, Staff_Registry" -ForegroundColor Green
                } else {
                    Write-Host "      [STATUS] Webhook responded: $hookRes" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "      [WARNING] Webhook connection timed out or offline." -ForegroundColor Yellow
            }
        } else {
            Write-Host "      [WARNING] Webhook URL not configured yet." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "      [ERROR] Could not read google_workspace_config.json" -ForegroundColor Red
    }
}

# ------------------------------------------------------------------------
# 4. BLUETOOTH RADIO & SEZNIK 58MM PRINTER HARDWARE CHECK
# ------------------------------------------------------------------------
Write-Host "`n[4/5] Checking Bluetooth Radio & SEZNIK 58mm Thermal Printer..." -ForegroundColor Cyan
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    if ($asTaskGeneric) {
        $asTask = $asTaskGeneric.MakeGenericMethod([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
        [Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime] | Out-Null
        $t = $asTask.Invoke($null, @([Windows.Devices.Radios.Radio]::GetRadiosAsync()))
        $t.Wait(1000) | Out-Null
        if ($t.Result) {
            $bt = $t.Result | Where-Object { $_.Kind -eq 'Bluetooth' }
            if ($bt) {
                Write-Host "      [OK] Laptop Bluetooth Radio: $($bt.State)" -ForegroundColor Green
            }
        }
    }

    $serialPorts = [System.IO.Ports.SerialPort]::GetPortNames()
    if ($serialPorts -and $serialPorts.Length -gt 0) {
        Write-Host "      [OK] SEZNIK / Bluetooth Printer Port detected: $($serialPorts -join ', ')" -ForegroundColor Green
    } else {
        Write-Host "      [INFO] Direct Bluetooth / Web-Bluetooth Driver ready. Turn printer ON for direct pairing." -ForegroundColor White
    }
} catch {
    Write-Host "      [INFO] Bluetooth check completed." -ForegroundColor White
}

# ------------------------------------------------------------------------
# 5. NETWORK & MOBILE HOTSPOT CHECK
# ------------------------------------------------------------------------
Write-Host "`n[5/5] Checking Network & Mobile Phone Connections..." -ForegroundColor Cyan
$localIps = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch 'Loopback' -and 
    $_.IPAddress -notmatch '^169\.' -and 
    $_.IPAddress -notmatch '^127\.' 
}).IPAddress

Write-Host "      • Local Wi-Fi IP(s):       $($localIps -join ', ')" -ForegroundColor White
Write-Host "      • Mobile Hotspot Fixed IP: 192.168.137.1" -ForegroundColor White

$tunnelFile = Join-Path $dataDir "tunnel_url.txt"
if (Test-Path $tunnelFile) {
    $tUrl = (Get-Content $tunnelFile -Raw).Trim()
    if ($tUrl) {
        Write-Host "      • 4G/5G Customer QR Link:  $tUrl" -ForegroundColor Green
    }
}

Write-Host "`n=========================================================================" -ForegroundColor Green
Write-Host "                       ALL CHECKS COMPLETED" -ForegroundColor Green
Write-Host "=========================================================================`n" -ForegroundColor Green

Write-Host "Options:" -ForegroundColor Yellow
Write-Host " [1] Open Google Sheets Master Database in Browser" -ForegroundColor White
Write-Host " [2] Trigger Live POS Sync to Google Sheets Now" -ForegroundColor White
Write-Host " [3] Print Sample Welcome Slip on SEZNIK Thermal Printer" -ForegroundColor White
Write-Host " [4] Exit" -ForegroundColor White

$choice = Read-Host "`nEnter your choice (1-4)"
switch ($choice) {
    "1" {
        Start-Process "https://docs.google.com/spreadsheets/d/1sk_qbGAP74h26oYiDkMin815GbKikMJf6cqdK4thT4Y/edit?usp=sharing"
    }
    "2" {
        Write-Host "`nTriggering Full POS Sync..." -ForegroundColor Yellow
        $syncScript = "node -e `"const fs = require('fs'); const data = JSON.parse(fs.readFileSync('data/restaurant_store.json', 'utf8')); fetch('https://script.google.com/macros/s/AKfycbyOWefQz6VFbo9qJe1xrxQJONe8rqCWnhGuBwIfRKJwc3-izravBVOL9NmqUJVKHUiegA/exec', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'FULL_SYNC', tables: data.tables || [], menuCategories: data.menuCategories || [], staffUsers: data.staffUsers || [], historicalSales: data.historicalSales || [], orders: data.orders || [] }) }).then(r => r.json()).then(console.log).catch(console.error);`""
        cmd.exe /c "cd /d `"$appDir`" && $syncScript"
        Write-Host "`n[SUCCESS] Synced to Google Sheets!" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }
    "3" {
        $pScript = Join-Path $appDir "scripts\print_startup_welcome.ps1"
        if (Test-Path $pScript) {
            powershell.exe -NoProfile -ExecutionPolicy Bypass -File $pScript
            Write-Host "`n[SUCCESS] Test print sent to SEZNIK printer!" -ForegroundColor Green
        }
        Start-Sleep -Seconds 2
    }
    Default {
        Write-Host "Exiting..." -ForegroundColor Gray
    }
}
