# =========================================================================
# ITHI POORAM (ഇത്തിപ്പൂരം) - AUTONOMOUS CLOUDFLARE TUNNEL WATCHDOG
# Continuously keeps the Customer QR Cloudflare Worker connected to the laptop
# Self-healing: Automatically restarts cloudflared on disconnect & registers URL
# =========================================================================

param(
    [int]$LocalPort = 3000,
    [string]$WorkerUrl = "https://ithipooram-order.ithipooram-pos.workers.dev",
    [string]$Secret = "ithipooram_secret_pos_2026"
)

$baseDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $baseDir "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }

$cloudflaredPath = Join-Path $baseDir "cloudflared.exe"
$tunnelLogPath = Join-Path $dataDir "cloudflared_tunnel.log"
$tunnelUrlFile = Join-Path $dataDir "tunnel_url.txt"
$desktopLinksFile = "C:\Users\USR\Desktop\MOBILE_LINKS_FOR_STAFF.txt"

function Write-WatchdogLog([string]$msg, [string]$color = "Cyan") {
    $time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "[$time][TUNNEL-WATCHDOG] $msg" -ForegroundColor $color
}

function Test-TunnelEndpoint([string]$targetUrl) {
    if (-not $targetUrl -or -not $targetUrl.StartsWith("http")) { return $false }
    try {
        $testUrl = "$targetUrl/api/auth/pin-status"
        $res = Invoke-RestMethod -Uri $testUrl -Method GET -TimeoutSec 5 -ErrorAction Stop
        return ($res -and $res.isConfigured -eq $true)
    } catch {
        return $false
    }
}

function Register-TunnelWithWorker([string]$newUrl) {
    if (-not $newUrl) { return $false }
    try {
        $payload = @{
            secret = $Secret
            targetUrl = $newUrl
        } | ConvertTo-Json

        $res = Invoke-RestMethod -Uri "$WorkerUrl/api/update-tunnel" -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 6
        if ($res -and $res.success) {
            Write-WatchdogLog "SUCCESS: Registered $newUrl with permanent Cloudflare Worker!" "Green"
            return $true
        }
    } catch {
        Write-WatchdogLog "Failed to register with worker: $_" "Yellow"
    }
    return $false
}

function Start-FreshTunnel() {
    Write-WatchdogLog "Starting fresh Cloudflare Tunnel bridge..." "Yellow"

    # Stop any old cloudflared processes
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    if (Test-Path $tunnelLogPath) {
        Remove-Item -Path $tunnelLogPath -Force -ErrorAction SilentlyContinue
    }

    $pInfo = New-Object System.Diagnostics.ProcessStartInfo
    $pInfo.FileName = $cloudflaredPath
    $pInfo.Arguments = "tunnel --url http://localhost:${LocalPort} --logfile `"$tunnelLogPath`""
    $pInfo.UseShellExecute = $false
    $pInfo.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($pInfo)
    Start-Sleep -Seconds 3

    # Wait for the trycloudflare.com URL to appear in the logfile
    $discoveredUrl = ""
    $waitStart = Get-Date
    while ((Get-Date) - $waitStart -lt [TimeSpan]::FromSeconds(25)) {
        if (Test-Path $tunnelLogPath) {
            try {
                $content = Get-Content -Path $tunnelLogPath -Raw -ErrorAction SilentlyContinue
                if ($content -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
                    $discoveredUrl = $matches[0]
                    break
                }
            } catch {}
        }
        Start-Sleep -Milliseconds 400
    }

    if ($discoveredUrl) {
        Write-WatchdogLog "Discovered live tunnel URL: $discoveredUrl" "Green"
        Set-Content -Path $tunnelUrlFile -Value $discoveredUrl -Force

        # Register with internal Next.js API
        try {
            Invoke-RestMethod -Uri "http://localhost:${LocalPort}/api/tunnel/register" -Method POST -ContentType "application/json" -Body (@{ url = $discoveredUrl } | ConvertTo-Json) -TimeoutSec 3 | Out-Null
        } catch {}

        # Register with Cloudflare Worker
        Register-TunnelWithWorker $discoveredUrl | Out-Null

        # Update desktop links file
        if (Test-Path $desktopLinksFile) {
            try {
                $raw = Get-Content $desktopLinksFile -Raw
                $updated = $raw -replace "https://[a-zA-Z0-9-]+\.trycloudflare\.com", $discoveredUrl
                Set-Content $desktopLinksFile -Value $updated -Force
            } catch {}
        }

        return $discoveredUrl
    } else {
        Write-WatchdogLog "Could not extract tunnel URL from cloudflared logs!" "Red"
        return $null
    }
}

# MAIN WATCHDOG LOOP
Write-WatchdogLog "Tunnel Watchdog active. Target worker: $WorkerUrl" "Green"

# Check if current tunnel is already live
$currentUrl = ""
if (Test-Path $tunnelUrlFile) {
    try { $currentUrl = (Get-Content $tunnelUrlFile -Raw).Trim() } catch {}
}

$isLive = Test-TunnelEndpoint $currentUrl
if (-not $isLive) {
    $currentUrl = Start-FreshTunnel
} else {
    Write-WatchdogLog "Existing tunnel $currentUrl is healthy and responding." "Green"
    Register-TunnelWithWorker $currentUrl | Out-Null
}

$loopCount = 0
while ($true) {
    Start-Sleep -Seconds 12
    $loopCount++

    # 1. Check if cloudflared process is running
    $cfProc = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $cfProc) {
        Write-WatchdogLog "cloudflared process is NOT running! Restarting now..." "Red"
        $currentUrl = Start-FreshTunnel
        continue
    }

    # 2. Check if local port 3000 is running
    $portConn = Get-NetTCPConnection -LocalPort $LocalPort -ErrorAction SilentlyContinue
    if (-not $portConn) {
        Write-WatchdogLog "POS Server is not listening on port $LocalPort. Waiting..." "Yellow"
        continue
    }

    # 3. Every 36 seconds (every 3rd loop), test the public tunnel health
    if ($loopCount % 3 -eq 0) {
        $healthy = Test-TunnelEndpoint $currentUrl
        if (-not $healthy) {
            Write-WatchdogLog "Tunnel $currentUrl failed health check! Healing automatically..." "Red"
            $currentUrl = Start-FreshTunnel
        } else {
            # Periodically re-sync with worker to ensure KV cache never gets lost
            Register-TunnelWithWorker $currentUrl | Out-Null
        }
    }
}
