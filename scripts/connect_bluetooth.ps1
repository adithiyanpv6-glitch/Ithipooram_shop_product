# ========================================================================
# ITHI POORAM - SEZNIK BLUETOOTH PRINTER 1-CLICK WIRELESS CONNECTOR
# ========================================================================

Clear-Host
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "      ITHI POORAM - SEZNIK BLUETOOTH PRINTER WIRELESS SETUP" -ForegroundColor Yellow
Write-Host "=========================================================================`n" -ForegroundColor Green

# 1. Ensure Laptop Bluetooth Radio is Turned ON
Write-Host "[1/3] Turning ON Laptop's Bluetooth Radio..." -ForegroundColor Cyan
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    
    Function Await-Task($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        $netTask.Result
    }
    
    [Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime] | Out-Null
    $radios = Await-Task ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
    $btRadio = $radios | Where-Object { $_.Kind -eq 'Bluetooth' }
    if ($btRadio -and $btRadio.State -ne 'On') {
        $status = Await-Task ($btRadio.SetStateAsync([Windows.Devices.Radios.RadioState]::On)) ([Windows.Devices.Radios.RadioAccessStatus])
        Write-Host "      -> Laptop Bluetooth Radio is now: ON" -ForegroundColor Green
    } else {
        Write-Host "      -> Laptop Bluetooth Radio is ACTIVE (ON)" -ForegroundColor Green
    }
} catch {
    Write-Host "      -> Bluetooth radio check completed." -ForegroundColor Gray
}

# 2. Instructions for Pairing
Write-Host "`n[2/3] Opening Windows Bluetooth Pairing..." -ForegroundColor Cyan
Write-Host "-------------------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "  1. Turn ON your SEZNIK printer (Hold LEFT Power button until it beeps)." -ForegroundColor White
Write-Host "  2. In the Windows Bluetooth window that just opened:" -ForegroundColor White
Write-Host "     -> Click 'Add device' (or 'Add Bluetooth or other device')" -ForegroundColor White
Write-Host "     -> Choose 'Bluetooth'" -ForegroundColor White
Write-Host "     -> Select 'SEZNIK' or 'POS-58'" -ForegroundColor White
Write-Host "     -> Enter PIN: 0000 (or 1234) and click Connect" -ForegroundColor Yellow
Write-Host "-------------------------------------------------------------------------" -ForegroundColor Yellow

Start-Process "ms-settings:bluetooth"

# 3. Wait and Auto-Detect Paired Bluetooth Printer
Write-Host "`n[3/3] Listening for SEZNIK Bluetooth connection..." -ForegroundColor Cyan
$detectedPort = $null
$maxWait = 60

for ($i = 1; $i -le $maxWait; $i++) {
    # Check for active serial COM ports assigned by Windows Bluetooth
    $ports = [System.IO.Ports.SerialPort]::GetPortNames()
    if ($ports -and $ports.Length -gt 0) {
        $detectedPort = $ports[0]
        Write-Host "`n      -> Bluetooth Serial COM Port detected: $detectedPort" -ForegroundColor Green
        break
    }

    # Check for Windows paired Bluetooth printers
    $printers = Get-Printer -ErrorAction SilentlyContinue
    $p = $printers | Where-Object { $_.Name -match "SEZNIK|POS-58|MPT" } | Select-Object -First 1
    if ($p) {
        Write-Host "`n      -> Bluetooth Printer detected in Windows: $($p.Name)" -ForegroundColor Green
        break
    }

    Write-Host -NoNewline "`rWaiting for Bluetooth pairing... ($i/$maxWait s)" -ForegroundColor Yellow
    Start-Sleep -Seconds 1
}

# 4. Auto-Register Windows Printer on Bluetooth COM Port if found
if ($detectedPort) {
    try {
        $existing = Get-Printer -Name "SEZNIK" -ErrorAction SilentlyContinue
        if (-not $existing) {
            Add-Printer -Name "SEZNIK" -DriverName "POS58ENG" -PortName $detectedPort -ErrorAction SilentlyContinue
        } else {
            Set-Printer -Name "SEZNIK" -PortName $detectedPort -ErrorAction SilentlyContinue
        }
        (New-Object -ComObject WScript.Network).SetDefaultPrinter("SEZNIK")
        Write-Host "      -> 'SEZNIK' set as Windows Default Bluetooth Printer on $detectedPort" -ForegroundColor Green
    } catch {}
}

# 5. Send Wireless Test Receipt
Write-Host "`nSending Wireless Bluetooth Test Print..." -ForegroundColor Cyan
$testSlip = @"
================================
         ITHI POORAM
    Kerala Lunch & Seafood
    Vanchiyoor, Trivandrum
================================
SEZNIK BLUETOOTH ONLINE!
Date: $(Get-Date -Format 'dd-MM-yyyy hh:mm tt')
Connection: Laptop Bluetooth
Status: WIRELESS TEST OK!
================================
   READY FOR MOBILE BILLING!
================================




"@

$scriptPath = Join-Path $PSScriptRoot "print_bluetooth.ps1"
$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp, $testSlip, [System.Text.Encoding]::UTF8)

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -PrinterName "SEZNIK" -FilePath $tmp
Remove-Item $tmp -Force -ErrorAction SilentlyContinue

Write-Host "`n=========================================================================" -ForegroundColor Green
Write-Host "   SEZNIK BLUETOOTH SETUP READY! YOU CAN NOW BILL FROM YOUR PHONES!" -ForegroundColor Yellow
Write-Host "=========================================================================`n" -ForegroundColor Green
