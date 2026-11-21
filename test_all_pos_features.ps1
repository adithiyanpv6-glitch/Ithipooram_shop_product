$baseUrl = "http://localhost:3000"

$report = @()

function Test-Endpoint {
    param(
        [string]$Category,
        [string]$Name,
        [string]$Method = "GET",
        [string]$Path,
        [hashtable]$Body = $null,
        [int]$ExpectedStatus = 200
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $status = 0
    $msg = ""
    $respBody = $null

    try {
        $params = @{
            Uri = "$baseUrl$Path"
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = 10
        }
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 5)
            $params.ContentType = "application/json"
        }
        $r = Invoke-WebRequest @params
        $status = $r.StatusCode
        $respBody = $r.Content
        $sw.Stop()

        $isSuccess = ($status -eq $ExpectedStatus)
        return [PSCustomObject]@{
            Category = $Category
            Function = $Name
            Method = $Method
            Path = $Path
            Status = "$status (Expected: $ExpectedStatus)"
            Latency = "$($sw.ElapsedMilliseconds)ms"
            Passed = $isSuccess
            Notes = if ($isSuccess) { "OK" } else { "Status mismatch" }
        }
    } catch {
        $sw.Stop()
        $errStatus = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "ERR" }
        $isSuccess = ($errStatus -eq $ExpectedStatus)
        return [PSCustomObject]@{
            Category = $Category
            Function = $Name
            Method = $Method
            Path = $Path
            Status = "$errStatus (Expected: $ExpectedStatus)"
            Latency = "$($sw.ElapsedMilliseconds)ms"
            Passed = $isSuccess
            Notes = $_.Exception.Message
        }
    }
}

# 1. UI PAGES
$report += Test-Endpoint -Category "UI Route" -Name "Admin / Manager Dashboard" -Path "/"
$report += Test-Endpoint -Category "UI Route" -Name "Cashier Billing Counter" -Path "/billing"
$report += Test-Endpoint -Category "UI Route" -Name "Kitchen Display Screen (KDS)" -Path "/kitchen"
$report += Test-Endpoint -Category "UI Route" -Name "Table QR Code Generator" -Path "/qr"
$report += Test-Endpoint -Category "UI Route" -Name "Menu Management" -Path "/menu"
$report += Test-Endpoint -Category "UI Route" -Name "Reports & Day Close" -Path "/reports"
$report += Test-Endpoint -Category "UI Route" -Name "Security Audit Logs" -Path "/audit"
$report += Test-Endpoint -Category "UI Route" -Name "Staff User Management" -Path "/users"
$report += Test-Endpoint -Category "UI Route" -Name "Customer Mobile Ordering (/order)" -Path "/order"
$report += Test-Endpoint -Category "UI Route" -Name "Customer Table QR Landing (/t/T1)" -Path "/t/T1"
$report += Test-Endpoint -Category "UI Route" -Name "Staff Login Page" -Path "/login"

# 2. CORE RESTAURANT APIS
$report += Test-Endpoint -Category "API - Tables" -Name "Fetch Tables" -Path "/api/tables"
$report += Test-Endpoint -Category "API - Menu" -Name "Fetch Menu Categories" -Path "/api/menu"
$report += Test-Endpoint -Category "API - Orders" -Name "Fetch Active Orders" -Path "/api/orders"
$report += Test-Endpoint -Category "API - Kitchen" -Name "Fetch Kitchen Queue" -Path "/api/kitchen"
$report += Test-Endpoint -Category "API - Admin" -Name "Overview Stats" -Path "/api/admin/overview"
$report += Test-Endpoint -Category "API - Admin" -Name "Daily Reports" -Path "/api/admin/daily-reports"
$report += Test-Endpoint -Category "API - Audit" -Name "Audit Logs" -Path "/api/audit/logs"
$report += Test-Endpoint -Category "API - Tunnel" -Name "Registered Tunnel URL" -Path "/api/tunnel/register"
$report += Test-Endpoint -Category "API - Staff" -Name "Staff Sessions" -Path "/api/staff/sessions"
$report += Test-Endpoint -Category "API - Users" -Name "Users Export" -Path "/api/users/export"

# 3. EXCEL EXPORT APIS
$report += Test-Endpoint -Category "API - Excel" -Name "Menu Master Excel" -Path "/api/menu/excel"
$report += Test-Endpoint -Category "API - Excel" -Name "Tables Master Excel" -Path "/api/tables/database/excel"
$report += Test-Endpoint -Category "API - Excel" -Name "Staff Master Excel" -Path "/api/staff/database/excel"

# 4. GOOGLE WORKSPACE APIS
$report += Test-Endpoint -Category "API - Google" -Name "Live Feed" -Path "/api/google-workspace/live-feed"
$report += Test-Endpoint -Category "API - Google" -Name "Sync Trigger" -Method "POST" -Path "/api/google-workspace/sync"

# 6. EDGE CASES / VALIDATION
$report += Test-Endpoint -Category "Validation" -Name "Invalid Order Settle Payload" -Method "POST" -Path "/api/billing/settle" -Body @{ invalid = "payload" } -ExpectedStatus 400
$report += Test-Endpoint -Category "Validation" -Name "Non-existent Table Unpaid Orders" -Path "/api/billing/tables/NON_EXISTENT_999/unpaid" -ExpectedStatus 200
$report += Test-Endpoint -Category "Validation" -Name "Non-existent Order Preview" -Path "/api/billing/orders/ord-99999/preview" -ExpectedStatus 404
$report += Test-Endpoint -Category "Validation" -Name "Non-existent Route 404" -Path "/this-does-not-exist" -ExpectedStatus 404

$report | Format-Table -AutoSize
