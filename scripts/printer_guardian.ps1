# ==============================================================================
# ITHI POORAM (ഇത്തിപ്പൂരം) — AUTONOMOUS BLUETOOTH PRINTER GUARDIAN (24/7 AUTO-RECONNECT)
# - Continuous 2-5 second heartbeat probe
# - Zero human intervention: Reconnects automatically within 2-5s of printer power ON
# - Prevents Bluetooth sleep with keep-alive pings
# - Auto-cleans zombie COM port locks so server NEVER freezes
# - Auto-flushes pending print queue upon reconnection
# ==============================================================================

param(
    [int]$IntervalSeconds = 2
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue

$baseDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $baseDir "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
$statusFile = Join-Path $dataDir "printer_status.json"
$queueFile = Join-Path $dataDir "pending_print_queue.json"
$printScript = Join-Path $PSScriptRoot "print_bluetooth.ps1"

# Fast non-blocking C# probe class with strict timeout
$csharpProbe = @"
using System;
using System.IO.Ports;
using System.Threading.Tasks;

public class FastComProbe
{
    public static bool ProbePort(string portName, int timeoutMs = 1500)
    {
        try
        {
            Task<bool> task = Task.Run(() =>
            {
                SerialPort sp = null;
                try
                {
                    sp = new SerialPort(portName, 9600, Parity.None, 8, StopBits.One);
                    sp.Handshake = Handshake.None;
                    sp.DtrEnable = true;
                    sp.RtsEnable = true;
                    sp.WriteTimeout = 1000;
                    sp.ReadTimeout = 1000;
                    sp.Open();
                    bool open = sp.IsOpen;
                    sp.Close();
                    sp.Dispose();
                    return open;
                }
                catch
                {
                    if (sp != null)
                    {
                        try { sp.Close(); } catch { }
                        try { sp.Dispose(); } catch { }
                    }
                    return false;
                }
            });

            if (task.Wait(timeoutMs))
            {
                return task.Result;
            }
            return false;
        }
        catch
        {
            return false;
        }
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'FastComProbe').Type) {
    Add-Type -TypeDefinition $csharpProbe -Language CSharp
}

function Ensure-BluetoothRadioOn {
    try {
        $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
        if ($asTaskGeneric) {
            $asTask = $asTaskGeneric.MakeGenericMethod([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
            [Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime] | Out-Null
            $t = $asTask.Invoke($null, @([Windows.Devices.Radios.Radio]::GetRadiosAsync()))
            $t.Wait(1000) | Out-Null
            if ($t.Result) {
                $bt = $t.Result | Where-Object { $_.Kind -eq 'Bluetooth' }
                if ($bt -and $bt.State -ne 'On') {
                    Write-Host "[Printer Guardian] Turning ON Laptop Bluetooth radio..." -ForegroundColor Yellow
                    $bt.SetStateAsync([Windows.Devices.Radios.RadioState]::On) | Out-Null
                }
            }
        }
    } catch {}
}

function Clean-StuckPrintProcesses {
    try {
        Get-CimInstance Win32_Process | Where-Object {
            $_.Name -eq "powershell.exe" -and ($_.CommandLine -like "*print_bluetooth.ps1*")
        } | ForEach-Object {
            $created = $_.CreationDate
            if ($created) {
                $age = (Get-Date) - $created
                if ($age.TotalSeconds -gt 8) {
                    Write-Host "[Printer Guardian] Terminating hung print process PID $($_.ProcessId) (Age: $($age.TotalSeconds)s)..." -ForegroundColor Yellow
                    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {}
}

function Process-PendingQueue($port) {
    if (-not (Test-Path $queueFile)) { return }
    try {
        $raw = Get-Content -Path $queueFile -Raw -ErrorAction SilentlyContinue
        if (-not $raw -or -not $raw.Trim()) { return }
        $queue = $raw | ConvertFrom-Json
        if (-not $queue -or $queue.Count -eq 0) { return }

        Write-Host "[Printer Guardian] Printer connected! Auto-flushing $($queue.Count) queued bills..." -ForegroundColor Green
        $remaining = @()

        foreach ($job in $queue) {
            $receiptText = $job.receiptText
            if (-not $receiptText) { continue }

            $tmpFile = [System.IO.Path]::GetTempFileName()
            Set-Content -Path $tmpFile -Value $receiptText -Encoding UTF8 -Force

            $proc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$printScript`" -PrinterName SEZNIK -FilePath `"$tmpFile`"" -PassThru -NoNewWindow -Wait
            try { Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue } catch {}

            if ($proc.ExitCode -eq 0) {
                Write-Host "[Printer Guardian] -> Successfully printed queued bill: $($job.id)" -ForegroundColor Green
            } else {
                Write-Host "[Printer Guardian] -> Failed printing queued bill $($job.id), keeping in queue..." -ForegroundColor Yellow
                $remaining += $job
                break
            }
            Start-Sleep -Milliseconds 600
        }

        if ($remaining.Count -eq 0) {
            Remove-Item -Path $queueFile -Force -ErrorAction SilentlyContinue
        } else {
            Set-Content -Path $queueFile -Value ($remaining | ConvertTo-Json) -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Host "[Printer Guardian] Queue processing notice: $_" -ForegroundColor Gray
    }
}

Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "   ITHI POORAM PRINTER GUARDIAN ACTIVE (2-5s Auto-Reconnect & Queue Engine)" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Green

$lastState = "UNKNOWN"
$candidatePorts = @("COM3", "COM4")
$lastHeartbeat = Get-Date

while ($true) {
    # 1. Kill any zombie powershell print scripts taking more than 8 seconds
    Clean-StuckPrintProcesses

    # 2. Ensure laptop Bluetooth is active
    Ensure-BluetoothRadioOn

    # 3. Fast non-blocking probe of COM3 / COM4
    $connectedPort = $null
    foreach ($p in $candidatePorts) {
        $ok = [FastComProbe]::ProbePort($p, 1800)
        if ($ok) {
            $connectedPort = $p
            break
        }
    }

    $queueCount = 0
    if (Test-Path $queueFile) {
        try {
            $q = (Get-Content $queueFile -Raw -ErrorAction SilentlyContinue) | ConvertFrom-Json
            if ($q) { $queueCount = $q.Count }
        } catch {}
    }

    if ($connectedPort) {
        if ($lastState -ne "READY") {
            Write-Host "[Printer Guardian] [RECONNECTED] SEZNIK B-41 is ONLINE on $connectedPort!" -ForegroundColor Green
            $lastState = "READY"
        }

        # Update status file
        $status = @{
            connected = $true
            status = "READY"
            port = $connectedPort
            queuedCount = $queueCount
            lastSuccessAt = (Get-Date).ToString("o")
            updatedAt = (Get-Date).ToString("o")
        }
        Set-Content -Path $statusFile -Value ($status | ConvertTo-Json -Compress) -Force -ErrorAction SilentlyContinue

        # Flush any bills that were queued while printer was disconnected!
        if ($queueCount -gt 0) {
            Process-PendingQueue $connectedPort
        }
    } else {
        if ($lastState -ne "DISCONNECTED") {
            Write-Host "[Printer Guardian] [DISCONNECTED] Printer offline or turned off. Auto-reconnecting in background..." -ForegroundColor Yellow
            $lastState = "DISCONNECTED"
        }

        $status = @{
            connected = $false
            status = "RECONNECTING"
            port = "COM3"
            queuedCount = $queueCount
            error = "Printer offline or out of Bluetooth range"
            updatedAt = (Get-Date).ToString("o")
        }
        Set-Content -Path $statusFile -Value ($status | ConvertTo-Json -Compress) -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Seconds $IntervalSeconds
}
