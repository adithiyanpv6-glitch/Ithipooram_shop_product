# ==============================================================================
# ITHI POORAM (ഇത്തിപ്പൂരം) — MEGA COMPREHENSIVE SYSTEM AUDIT & HEALTH CHECK
# ==============================================================================

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   ITHI POORAM POS — COMPREHENSIVE 360-DEGREE SYSTEM AUDIT        " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan

$passed = 0
$failed = 0

function Check-Result {
    param([string]$title, [bool]$condition, [string]$details = "")
    if ($condition) {
        Write-Host " [PASS] $title" -ForegroundColor Green
        if ($details) { Write-Host "        $details" -ForegroundColor Gray }
        $script:passed++
    } else {
        Write-Host " [FAIL] $title" -ForegroundColor Red
        if ($details) { Write-Host "        $details" -ForegroundColor Red }
        $script:failed++
    }
}

# 1. DATABASE INTEGRITY
Write-Host "`n--- 1. DATABASE STORE & PERMANENT STORAGE INTEGRITY ---" -ForegroundColor Cyan
$dbPath = "data\restaurant_store.json"
$hasDb = Test-Path $dbPath
Check-Result "Core Database File Exists" $hasDb "Path: $dbPath"

if ($hasDb) {
    try {
        $raw = Get-Content -Raw -Path $dbPath -Encoding utf8
        if ($raw.Length -gt 0 -and $raw[0] -eq [char]65279) { $raw = $raw.Substring(1) }
        $dbJson = ConvertFrom-Json $raw

        Check-Result "Tables List Is Empty (Fresh Start)" ($dbJson.tables.Count -eq 0) "Found $($dbJson.tables.Count) tables"
        Check-Result "Menu Categories List Is Empty (Fresh Start)" ($dbJson.menuCategories.Count -eq 0) "Found $($dbJson.menuCategories.Count) categories"
        Check-Result "Active Orders List Is Empty" ($dbJson.orders.Count -eq 0) "Found $($dbJson.orders.Count) active orders"
        Check-Result "Kitchen Tickets Queue Is Empty" ($dbJson.kitchenTickets.Count -eq 0) "Found $($dbJson.kitchenTickets.Count) tickets"
        $hasDemo = ($dbJson.historicalSales | Where-Object { $_.invoiceNumber -like "20261120*" })
        Check-Result "Demo Sale Retained for 2026-11-20" ($null -ne $hasDemo) "Found $($dbJson.historicalSales.Count) total sales records"
        Check-Result "Master Security PIN Configured" ($dbJson.masterPin -eq "8181") "Master PIN: $($dbJson.masterPin)"
    } catch {
        Check-Result "Database JSON Parsing" $false "$($_.Exception.Message)"
    }
}

# 2. DAILY LEDGER RETENTION
Write-Host "`n--- 2. PERMANENT DAILY LEDGER PARTITIONING ---" -ForegroundColor Cyan
$demoLedger = "data\daily_ledgers\2026-11-20.json"
$hasDemoLedger = Test-Path $demoLedger
Check-Result "Demo Daily Ledger 2026-11-20 Exists" $hasDemoLedger "Path: $demoLedger"

$archivedDir = "data\archived_test_ledgers"
$hasArchived = Test-Path $archivedDir
Check-Result "Old Test Ledgers Safely Archived" $hasArchived "Path: $archivedDir"

# 3. PRODUCTION SERVER & NETWORK ENDPOINTS
Write-Host "`n--- 3. LIVE PRODUCTION HTTP ENDPOINTS & API RESPONSES ---" -ForegroundColor Cyan
$baseUrl = "http://localhost:3000"

try {
    $tblRes = Invoke-RestMethod -Uri "$baseUrl/api/tables" -Method Get -TimeoutSec 5
    Check-Result "GET /api/tables returns Empty Array" ($tblRes.Count -eq 0) "Tables returned: $($tblRes.Count)"
} catch {
    Check-Result "GET /api/tables reachable" $false "$($_.Exception.Message)"
}

try {
    $menuRes = Invoke-RestMethod -Uri "$baseUrl/api/menu" -Method Get -TimeoutSec 5
    Check-Result "GET /api/menu returns Empty Array" ($menuRes.Count -eq 0) "Categories returned: $($menuRes.Count)"
} catch {
    Check-Result "GET /api/menu reachable" $false "$($_.Exception.Message)"
}

try {
    $ordRes = Invoke-RestMethod -Uri "$baseUrl/api/orders" -Method Get -TimeoutSec 5
    Check-Result "GET /api/orders returns Empty Array" ($ordRes.Count -eq 0) "Orders returned: $($ordRes.Count)"
} catch {
    Check-Result "GET /api/orders reachable" $false "$($_.Exception.Message)"
}

try {
    $repRes = Invoke-RestMethod -Uri "$baseUrl/api/admin/daily-reports?date=2026-11-20" -Method Get -TimeoutSec 5
    $hasSales = $repRes.salesData.Count -eq 1
    $isRs1000 = $repRes.reports.totalSales.grossSalesRupees -eq 1000
    Check-Result "Demo Sales Report 2026-11-20 Verified (Rs 1,000)" ($hasSales -and $isRs1000) "Invoice: $($repRes.salesData[0].invoiceNumber), Total: Rs $($repRes.reports.totalSales.grossSalesRupees)"
} catch {
    Check-Result "GET /api/admin/daily-reports reachable" $false "$($_.Exception.Message)"
}

try {
    $todayRes = Invoke-RestMethod -Uri "$baseUrl/api/admin/daily-reports?date=today" -Method Get -TimeoutSec 5
    $todayValid = ($null -ne $todayRes.salesData)
    Check-Result "Today's Daily Ledger Accessible" $todayValid "Today's sales count: $($todayRes.salesData.Count)"
} catch {
    Check-Result "GET /api/admin/daily-reports?date=today" $false "$($_.Exception.Message)"
}

try {
    $syncRes = Invoke-RestMethod -Uri "$baseUrl/api/google-workspace/sync" -Method Post -TimeoutSec 15
    Check-Result "Google Workspace Live Sync Operational" ($syncRes.success -eq $true) "$($syncRes.message)"
} catch {
    Check-Result "POST /api/google-workspace/sync" $false "$($_.Exception.Message)"
}

# 4. PRINTER HARDWARE & SERIAL PORT
Write-Host "`n--- 4. THERMAL PRINTER HARDWARE & COM3 AUTO-RECONNECT ---" -ForegroundColor Cyan
$btDevices = @(Get-PnpDevice -Class Bluetooth | Where-Object { $_.FriendlyName -like "*B-41*" })
$hasB41 = ($btDevices.Count -gt 0)
Check-Result "B-41 Bluetooth Printer Paired" $hasB41 "Device: $($btDevices[0].FriendlyName), Status: $($btDevices[0].Status)"

$comPorts = [System.IO.Ports.SerialPort]::GetPortNames()
$hasCom3 = $comPorts -contains "COM3"
Check-Result "Bluetooth Serial COM3 Available" $hasCom3 "Detected Ports: $($comPorts -join ', ')"

$shortcutPath = "C:\Users\USR\Desktop\B-41 - Shortcut.lnk"
$hasShortcut = Test-Path $shortcutPath
Check-Result "Desktop Printer Icon Shortcut Exists" $hasShortcut "Path: $shortcutPath"

$reconnectBat = "scripts\RECONNECT_PRINTER.bat"
$hasReconnectBat = Test-Path $reconnectBat
Check-Result "1-Click Auto-Reconnect Script Exists" $hasReconnectBat "Path: $reconnectBat"

# 5. BRANDING & ASSETS
Write-Host "`n--- 5. BRANDING ASSETS & MALAYALAM CALLIGRAPHY ---" -ForegroundColor Cyan
$calligraphy = "public\brand-calligraphy-cropped.png"
$hasCalligraphy = (Test-Path $calligraphy) -and ((Get-Item $calligraphy).Length -gt 1000)
Check-Result "Cropped Malayalam Calligraphy Logo Exists" $hasCalligraphy "Size: $((Get-Item $calligraphy).Length) bytes"

$footer = "public\footer_malayalam.png"
$hasFooter = (Test-Path $footer) -and ((Get-Item $footer).Length -gt 1000)
Check-Result "Malayalam Bill Footer Exists" $hasFooter "Size: $((Get-Item $footer).Length) bytes"

# SUMMARY
Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "   AUDIT SUMMARY: $passed PASSED | $failed FAILED" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "==================================================================" -ForegroundColor Cyan
