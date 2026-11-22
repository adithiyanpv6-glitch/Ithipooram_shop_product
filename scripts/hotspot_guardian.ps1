# ==============================================================================
# ITHI POORAM (ഇത്തിപ്പൂരം) — AUTONOMOUS LAPTOP HOTSPOT GUARDIAN (24/7 AUTO-KEEPALIVE)
# Automatically re-enables "IthiPooram-POS" hotspot within 1-2 seconds
# whenever laptop Wi-Fi disconnects, reconnects, or drops out.
# ==============================================================================

param(
    [int]$IntervalSeconds = 2
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

[Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime] | Out-Null
[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime] | Out-Null

$baseDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $baseDir "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
$statusFile = Join-Path $dataDir "hotspot_status.json"

function Ensure-HotspotOn {
    try {
        # 1. Look up primary active internet connection profile
        $cp = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
        
        # 2. If null (e.g. Wi-Fi temporarily re-associating), pick first available profile
        if (-not $cp) {
            $profiles = [Windows.Networking.Connectivity.NetworkInformation]::GetConnectionProfiles()
            if ($profiles -and $profiles.Count -gt 0) {
                $cp = $profiles[0]
            }
        }

        if (-not $cp) {
            return @{ active = $false; state = 'NoProfile'; error = "No network profile found"; updatedAt = (Get-Date).ToString("o") }
        }

        $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($cp)
        if (-not $tm) {
            return @{ active = $false; state = 'NoManager'; error = "Could not initialize TetheringManager"; updatedAt = (Get-Date).ToString("o") }
        }

        $state = [string]$tm.TetheringOperationalState

        if ($state -ne 'On' -and $state -ne 'InTransition') {
            # Hotspot turned off! Immediately restart it!
            Write-Host "[Hotspot Guardian] Hotspot was '$state' — Automatically restarting IthiPooram-POS Hotspot now..." -ForegroundColor Yellow
            $startOp = $tm.StartTetheringAsync()
            if ($asTaskGeneric) {
                $asTask = $asTaskGeneric.MakeGenericMethod([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult])
                $t = $asTask.Invoke($null, @($startOp))
                $t.Wait(3000) | Out-Null
                $res = $t.Result
                Write-Host "[Hotspot Guardian] Restart result: $($res.Status)" -ForegroundColor Green
            }
            # Re-read state
            $state = [string]$tm.TetheringOperationalState
        }

        $info = @{
            active = ($state -eq 'On')
            state = $state
            clientCount = [int]$tm.ClientCount
            profileName = [string]$cp.ProfileName
            updatedAt = (Get-Date).ToString("o")
        }

        return $info
    } catch {
        return @{ active = $false; state = 'Error'; error = $_.Exception.Message; updatedAt = (Get-Date).ToString("o") }
    }
}

Write-Host ">>> IthiPooram Hotspot Guardian Active (Checking every ${IntervalSeconds}s) <<<" -ForegroundColor Green

while ($true) {
    $info = Ensure-HotspotOn
    try {
        $json = $info | ConvertTo-Json -Compress
        Set-Content -Path $statusFile -Value $json -Force -ErrorAction SilentlyContinue
    } catch {}
    Start-Sleep -Seconds $IntervalSeconds
}
