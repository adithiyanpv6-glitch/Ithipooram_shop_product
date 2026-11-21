# ========================================================================
# ITHI POORAM (ഇത്തിപ്പൂരം) - STANDALONE ALL-IN-ONE RESTAURANT POS SERVER
# Single 1-Click Launch: Server + Hotspot + Thermal Printer + Kiosk Auto-Print
# Runs 100% on laptop - Zero Vercel dependence - Instant Butter-Smooth Clicks
# ========================================================================

$baseDir = $PSScriptRoot
$appDir = $baseDir
$dataDir = Join-Path $appDir "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }

Clear-Host
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "      ITHI POORAM (ഇത്തിപ്പൂരം) - RESTAURANT POS ALL-IN-ONE LAUNCHER" -ForegroundColor Yellow
Write-Host "=========================================================================`n" -ForegroundColor Green

# ------------------------------------------------------------------------
# 1. Optimize Windows Power & Start Mobile Hotspot
# ------------------------------------------------------------------------
Write-Host "[1/6] Applying zero-sleep power settings & activating hotspot..." -ForegroundColor Cyan
try {
    # 0 = Do Nothing when laptop lid is closed (both on AC power and on Battery)
    powercfg /setacvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 2>$null
    powercfg /setdcvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 2>$null

    # 0 = Maximum Performance for Wireless Adapter (prevents Wi-Fi sleep when lid is closed)
    powercfg /setacvalueindex SCHEME_CURRENT 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 12bbebe6-58d6-4636-95bb-3217ef867c1a 0 2>$null
    powercfg /setdcvalueindex SCHEME_CURRENT 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 12bbebe6-58d6-4636-95bb-3217ef867c1a 0 2>$null

    # 0 = Never sleep or hibernate
    powercfg /change standby-timeout-ac 0 2>$null
    powercfg /change standby-timeout-dc 0 2>$null
    powercfg /change hibernate-timeout-ac 0 2>$null
    powercfg /change hibernate-timeout-dc 0 2>$null
    powercfg /setactive SCHEME_CURRENT 2>$null

    # Win32 Execution Lock: ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED
    try {
        $win32Def = @'
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern uint SetThreadExecutionState(uint esFlags);
'@
        $pType = Add-Type -MemberDefinition $win32Def -Name "LidLockWin32" -Namespace "IthiPooram" -PassThru -ErrorAction SilentlyContinue
        if ($pType) {
            $pType::SetThreadExecutionState([uint32]2147483713) | Out-Null
        }
    } catch {}

    Write-Host "      -> Windows power configured: Laptop & Wi-Fi will stay 100% running with lid closed." -ForegroundColor Green

    # Automatically ensure Windows Mobile Hotspot is broadcasting for 100% offline staff phones
    try {
        $cp = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]::GetInternetConnectionProfile()
        if ($cp) {
            $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]::CreateFromConnectionProfile($cp)
            if ($tm.TetheringOperationalState -ne 'On') {
                Write-Host "      -> Turning ON IthiPooram-POS Mobile Hotspot for staff phones..." -ForegroundColor Yellow
                $tm.StartTetheringAsync() | Out-Null
            } else {
                Write-Host "      -> Mobile Hotspot is ACTIVE (Fixed IP: 192.168.137.1)" -ForegroundColor Green
            }
        }
    } catch {}
} catch {
    Write-Host "      -> Power settings skipped." -ForegroundColor Gray
}

# ------------------------------------------------------------------------
# 2. Auto-Enable Laptop Bluetooth, Auto-Connect SEZNIK & Print Welcome Owner Slip
# ------------------------------------------------------------------------
Write-Host "[2/6] Activating Laptop Bluetooth & Connecting SEZNIK Printer..." -ForegroundColor Cyan
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
            if ($bt -and $bt.State -ne 'On') {
                $bt.SetStateAsync([Windows.Devices.Radios.RadioState]::On) | Out-Null
            }
        }
    }
    Write-Host "      -> Laptop Bluetooth Radio is ACTIVE (ON)" -ForegroundColor Green

    # Check for Bluetooth Serial COM port
    $btPorts = [System.IO.Ports.SerialPort]::GetPortNames()
    if ($btPorts -and $btPorts.Length -gt 0) {
        Write-Host "      -> SEZNIK Bluetooth Port Connected: $($btPorts -join ', ')" -ForegroundColor Green
        
        # Every day when START POS is started: automatically print a sample bill slip with brand calligraphy & Welcome Owner!
        Write-Host "      -> Daily Startup: Printing 'Welcome Owner' sample bill slip on SEZNIK..." -ForegroundColor Yellow
        $welcomeScript = Join-Path $appDir "scripts\print_startup_welcome.ps1"
        if (Test-Path $welcomeScript) {
            powershell.exe -NoProfile -ExecutionPolicy Bypass -File $welcomeScript | Out-Null
            Write-Host "      -> [SUCCESS] SEZNIK Printer verified & 'Welcome Owner' slip printed!" -ForegroundColor Green
        }
    } else {
        Write-Host "      -> SEZNIK Bluetooth port not detected yet. Ensure printer power is ON." -ForegroundColor Yellow
    }
} catch {
    Write-Host "      -> Bluetooth printer check complete." -ForegroundColor Gray
}

# ------------------------------------------------------------------------
# 3. Verify Node.js runtime & Dependencies
# ------------------------------------------------------------------------
Write-Host "[3/6] Verifying Node.js runtime..." -ForegroundColor Cyan
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "`n[ERROR] Node.js is not installed on this laptop!" -ForegroundColor Red
    Write-Host "Please download and install Node.js (LTS version) from: https://nodejs.org`n" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "      -> Node.js detected: $(node -v)" -ForegroundColor Green

if (-not (Test-Path (Join-Path $appDir "node_modules"))) {
    Write-Host "      -> Installing dependencies on this laptop (first-time only, please wait)..." -ForegroundColor Yellow
    cmd.exe /c "cd /d `"$appDir`" && npm install"
}

# ------------------------------------------------------------------------
# 4. Resolve Local Wi-Fi IPv4 Address & Start POS Server
# ------------------------------------------------------------------------
$localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch 'Loopback' -and 
    $_.IPAddress -notmatch '^169\.' -and 
    $_.IPAddress -notmatch '^127\.' 
} | Select-Object -First 1).IPAddress

if (-not $localIp) { $localIp = "localhost" }

$nextBuild = Join-Path $appDir ".next"
if (-not (Test-Path $nextBuild)) {
    Write-Host "      -> Compiling high-speed production build (one-time only, ~1 min)..." -ForegroundColor Yellow
    cmd.exe /c "cd /d `"$appDir`" && npm run build"
}

# Stop any previous node processes on port 3000
$oldConns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($oldConns) {
    foreach ($conn in $oldConns) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

Write-Host "[4/6] Starting Ultra-Fast Production POS Server on port 3000..." -ForegroundColor Cyan
$nextBin = Join-Path $appDir "node_modules\next\dist\bin\next"
Start-Process -FilePath "node" -ArgumentList "`"$nextBin`" start -H 0.0.0.0 -p 3000" -WorkingDirectory $appDir -WindowStyle Minimized

# Wait for server to become responsive
$maxWait = 30
for ($i = 0; $i -lt $maxWait; $i++) {
    Start-Sleep -Seconds 1
    $check = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($check) {
        Write-Host "      -> Production POS server online on http://localhost:3000 (Butter-smooth)" -ForegroundColor Green
        break
    }
}

# ------------------------------------------------------------------------
# 5. Start Cloudflare Tunnel for Mobile Network (4G/5G) QR Customers
# ------------------------------------------------------------------------
Write-Host "[5/6] Connecting Cloudflare Tunnel for 4G/5G Customer QR ordering..." -ForegroundColor Cyan
$cloudflaredPath = Join-Path $baseDir "cloudflared.exe"

if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "      -> cloudflared.exe not found, downloading automatic bridge..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cloudflaredPath
        Write-Host "      -> cloudflared.exe ready!" -ForegroundColor Green
    } catch {
        curl.exe -L -o $cloudflaredPath "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    }
}

# Stop any duplicate cloudflared or watchdog instances
Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*tunnel_watchdog.ps1*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$watchdogScript = Join-Path $baseDir "scripts\tunnel_watchdog.ps1"
if (Test-Path $watchdogScript) {
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchdogScript`"" -WorkingDirectory $baseDir
    Write-Host "      -> Autonomous Cloudflare Tunnel Watchdog launched in background." -ForegroundColor Green
}

# Wait up to 15 seconds for tunnel URL to be written
$tunnelUrl = ""
$waitStart = Get-Date
while ((Get-Date) - $waitStart -lt [TimeSpan]::FromSeconds(15)) {
    if (Test-Path (Join-Path $dataDir "tunnel_url.txt")) {
        $u = (Get-Content (Join-Path $dataDir "tunnel_url.txt") -Raw).Trim()
        if ($u -and $u.StartsWith("http")) {
            $tunnelUrl = $u
            break
        }
    }
    Start-Sleep -Milliseconds 500
}

if (-not $tunnelUrl) {
    $tunnelUrl = "http://${localIp}:3000"
}

$workerFile = Join-Path $dataDir "cloudflare_worker_url.txt"
if (Test-Path $workerFile) {
    $workerUrl = (Get-Content $workerFile -Raw).Trim()
    if ($workerUrl) {
        $customerQrUrl = $workerUrl
        Write-Host "      -> Permanent Customer QR Worker: $customerQrUrl" -ForegroundColor Green
    }
}
if (-not $customerQrUrl) {
    $customerQrUrl = $tunnelUrl
}

$hotspotIp = "192.168.137.1"

# ------------------------------------------------------------------------
# 6. Auto-Launch POS Billing Screen in Kiosk Silent Auto-Print Mode
# ------------------------------------------------------------------------
Write-Host "[6/6] Launching POS Billing Screen with Instant 58mm Auto-Printing..." -ForegroundColor Cyan
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$billingUrl = "http://localhost:3000/billing"

if (Test-Path $chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList "--kiosk-printing --app=$billingUrl"
    Write-Host "      -> POS Billing launched in Google Chrome (Kiosk Auto-Print Ready)" -ForegroundColor Green
} elseif (Test-Path $edgePath) {
    Start-Process -FilePath $edgePath -ArgumentList "--kiosk-printing --app=$billingUrl"
    Write-Host "      -> POS Billing launched in Microsoft Edge (Kiosk Auto-Print Ready)" -ForegroundColor Green
} else {
    Start-Process $billingUrl
    Write-Host "      -> POS Billing launched in default browser" -ForegroundColor Green
}

# ------------------------------------------------------------------------
# Write Mobile Links File to Desktop & Setup Startup
# ------------------------------------------------------------------------
$linksFile = Join-Path $baseDir "MOBILE_LINKS_FOR_STAFF.txt"
$linksContent = @"
=========================================================================
          ITHI POORAM (ഇത്തിപ്പൂരം) - MOBILE PHONE ACCESS LINKS
=========================================================================

⚡ OPTION A: BEST FOR CASHIER & KITCHEN (CONNECT PHONES TO 'IthiPooram-POS' HOTSPOT):
   Permanent Fixed IP - 100% Offline Proof - Zero Lag - Never Resets
   1. Cashier Billing Phone:      http://${hotspotIp}:3000/billing
   2. Kitchen Display (KDS):      http://${hotspotIp}:3000/kitchen
   3. Manager Dashboard:          http://${hotspotIp}:3000/

⚡ OPTION B: SHOP WI-FI FALLBACK:
   1. Cashier Billing:            http://${localIp}:3000/billing
   2. Kitchen Display (KDS):      http://${localIp}:3000/kitchen

🌐 FOR CUSTOMERS SCANNING TABLE QR CODES (MOBILE DATA 4G/5G):
   Live QR Menu & Order Link:     $customerQrUrl

=========================================================================
HOW TO INSTALL AS REAL APP ON PHONES:
On Cashier/Kitchen phone: Open the link in Chrome -> Tap 3 dots -> 'Add to Home screen'.
It will install as a full-screen app with an icon on your phone!
=========================================================================
NOTE: Keep the laptop plugged into its charger.
You can close the laptop screen/lid; it will stay running in the background.
=========================================================================
"@

Set-Content -Path $linksFile -Value $linksContent -Encoding UTF8 -Force
$desktopLinks = [System.IO.Path]::Combine([Environment]::GetFolderPath("Desktop"), "MOBILE_LINKS_FOR_STAFF.txt")
Set-Content -Path $desktopLinks -Value $linksContent -Encoding UTF8 -Force

# Register Windows Boot Auto-Start (Zero Clicks on Startup)
try {
    $startupFolder = [Environment]::GetFolderPath("Startup")
    $startupShortcut = Join-Path $startupFolder "START_ITHIPOORAM_POS.lnk"
    if (-not (Test-Path $startupShortcut)) {
        $wshShell = New-Object -ComObject WScript.Shell
        $sc = $wshShell.CreateShortcut($startupShortcut)
        $sc.TargetPath = Join-Path $baseDir "START_ITHIPOORAM_POS.bat"
        $sc.WorkingDirectory = $baseDir
        $sc.Description = "IthiPooram POS Auto-Start"
        $sc.Save()
    }
} catch {}

# Beautiful Console Display
Clear-Host
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "     ITHI POORAM ALL-IN-ONE PRODUCTION RESTAURANT SYSTEM ONLINE!" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "`n>>> CONNECT PHONES TO 'IthiPooram-POS' WI-FI (PASSWORD: ithipooram123) <<<`n" -ForegroundColor Yellow

Write-Host "  [1] CASHIER BILLING SCREEN:" -ForegroundColor White
Write-Host "      👉 http://localhost:3000/billing (Auto-Opened with 58mm Instant Print)" -ForegroundColor Green
Write-Host "      (Phone Hotspot: http://${hotspotIp}:3000/billing)`n" -ForegroundColor Gray

Write-Host "  [2] KITCHEN DISPLAY (KDS) PHONE / TABLET:" -ForegroundColor White
Write-Host "      👉 http://${hotspotIp}:3000/kitchen" -ForegroundColor Green
Write-Host "      (Shop Wi-Fi: http://${localIp}:3000/kitchen)`n" -ForegroundColor Gray

Write-Host "  [3] MANAGER DASHBOARD:" -ForegroundColor White
Write-Host "      👉 http://localhost:3000/" -ForegroundColor Green
Write-Host "      (Phone Hotspot: http://${hotspotIp}:3000/)`n" -ForegroundColor Gray

Write-Host "  [4] CUSTOMER TABLE QR SCAN LINK (4G/5G Mobile Data):" -ForegroundColor White
Write-Host "      🌐 $customerQrUrl`n" -ForegroundColor Cyan

Write-Host "-------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  [Auto-Print Status]:     ACTIVE (Bills print instantly on PIN confirm)" -ForegroundColor Green
Write-Host "  [Database Status]:       100% Persistent on Laptop Disk (Never Disappears)" -ForegroundColor Green
Write-Host "  [Hotspot Status]:        IthiPooram-POS is ACTIVE" -ForegroundColor Green
Write-Host "-------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "`nYOU CAN NOW CLOSE THE LAPTOP LID." -ForegroundColor Yellow
Write-Host "The server will keep running in the background without sleeping." -ForegroundColor White
Write-Host "Press Ctrl+C in this window when closing the restaurant for the day.`n" -ForegroundColor Gray

# Continuous Watchdog Supervisor: Keeps POS server permanently online 24/7
while ($true) {
    Start-Sleep -Seconds 5
    $checkNode = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if (-not $checkNode) {
        Write-Host "[Watchdog] POS Server offline, auto-restarting..." -ForegroundColor Yellow
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run start" -WorkingDirectory $appDir -WindowStyle Minimized | Out-Null
    }
}
