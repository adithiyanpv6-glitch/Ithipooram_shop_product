# ==============================================================================
# ITHI POORAM (ഇത്തിപ്പൂരം) — B-41 THERMAL PRINTER AUTO-RECONNECTOR & TEST TOOL
# ==============================================================================

param(
    [switch]$Silent = $false
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$csharpRasterizer = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class FastRasterizer
{
    public static List<byte[]> ConvertToBands(Bitmap bmp, int bandHeight = 24)
    {
        int width = bmp.Width;
        int height = bmp.Height;
        int xBytes = width / 8;
        List<byte[]> bands = new List<byte[]>();

        BitmapData data = bmp.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        int stride = data.Stride;
        int totalBytes = Math.Abs(stride) * height;
        byte[] pixelValues = new byte[totalBytes];
        Marshal.Copy(data.Scan0, pixelValues, 0, totalBytes);
        bmp.UnlockBits(data);

        for (int startY = 0; startY < height; startY += bandHeight)
        {
            int currentBandHeight = Math.Min(bandHeight, height - startY);
            byte[] band = new byte[8 + (xBytes * currentBandHeight)];
            band[0] = 0x1D; band[1] = 0x76; band[2] = 0x30; band[3] = 0x00;
            band[4] = (byte)(xBytes % 256);
            band[5] = (byte)(xBytes / 256);
            band[6] = (byte)(currentBandHeight % 256);
            band[7] = (byte)(currentBandHeight / 256);

            int bandIdx = 8;
            for (int y = startY; y < startY + currentBandHeight; y++)
            {
                int rowOffset = y * stride;
                for (int bx = 0; bx < xBytes; bx++)
                {
                    byte b = 0;
                    for (int bit = 0; bit < 8; bit++)
                    {
                        int px = bx * 8 + bit;
                        int pixelOffset = rowOffset + (px * 4);
                        byte blue = pixelValues[pixelOffset];
                        byte green = pixelValues[pixelOffset + 1];
                        byte red = pixelValues[pixelOffset + 2];
                        int lum = (int)(0.299 * red + 0.587 * green + 0.114 * blue);
                        if (lum < 150)
                        {
                            b |= (byte)(1 << (7 - bit));
                        }
                    }
                    band[bandIdx++] = b;
                }
            }
            bands.Add(band);
        }
        return bands;
    }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'FastRasterizer').Type) {
    Add-Type -TypeDefinition $csharpRasterizer -ReferencedAssemblies "System.Drawing"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $projectRoot "public\brand-calligraphy-cropped.png"

function Show-Notification {
    param([string]$title, [string]$message, [System.Windows.Forms.MessageBoxIcon]$icon)
    if (-not $Silent) {
        [System.Windows.Forms.MessageBox]::Show($message, $title, [System.Windows.Forms.MessageBoxButtons]::OK, $icon)
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ITHI POORAM — Reconnecting B-41 Bluetooth Printer...    " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Detect candidate COM ports
$allComPorts = [System.IO.Ports.SerialPort]::GetPortNames()
$targetPorts = @()

# Prioritize COM3 (standard B-41 outgoing port), then COM4, then others
if ($allComPorts -contains "COM3") { $targetPorts += "COM3" }
if ($allComPorts -contains "COM4") { $targetPorts += "COM4" }
foreach ($p in $allComPorts) {
    if ($targetPorts -notcontains $p) { $targetPorts += $p }
}

if ($targetPorts.Count -eq 0) {
    Write-Host "ERROR: No Bluetooth COM ports detected on this laptop." -ForegroundColor Red
    Show-Notification "Ithi Pooram - Printer Offline" "No Bluetooth serial COM ports detected on this laptop.`n`nPlease ensure Bluetooth is turned ON in Windows Settings and B-41 is paired." ([System.Windows.Forms.MessageBoxIcon]::Error)
    exit 1
}

$connectedPort = $null
$connectedSp = $null

foreach ($port in $targetPorts) {
    Write-Host "Probing port $port for B-41 Bluetooth printer..." -NoNewline
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $sp = New-Object System.IO.Ports.SerialPort $port, 9600, None, 8, One
            $sp.Handshake = "None"
            $sp.DtrEnable = $true
            $sp.RtsEnable = $true
            $sp.WriteTimeout = 5000
            $sp.ReadTimeout = 2000
            $sp.Open()

            # Successfully opened port!
            $connectedPort = $port
            $connectedSp = $sp
            Write-Host " [CONNECTED]" -ForegroundColor Green
            break
        } catch {
            Start-Sleep -Milliseconds 400
        }
    }
    if ($connectedPort) { break }
    Write-Host " [OFFLINE]" -ForegroundColor Gray
}

if (-not $connectedPort -or -not $connectedSp) {
    Write-Host "`nERROR: Could not establish connection to B-41 printer." -ForegroundColor Red
    Show-Notification "Ithi Pooram - Printer Offline" "⚠️ Could not connect to B-41 Printer.`n`nPlease check the following:`n1. Is the printer power button turned ON?`n2. Is the blue/green power light lit?`n3. Is thermal paper loaded inside?`n`nOnce turned ON, double-click this icon again to connect!" ([System.Windows.Forms.MessageBoxIcon]::Warning)
    exit 1
}

try {
    # 2. Build crisp 58mm connection confirmation slip
    $now = Get-Date -Format "dd-MM-yyyy hh:mm tt"
    $width = 384
    $height = 280

    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit

    $black = [System.Drawing.Brushes]::Black
    $fTitle = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Bold)
    $fSub = New-Object System.Drawing.Font("Arial", 9, [System.Drawing.FontStyle]::Bold)
    $fBody = New-Object System.Drawing.Font("Consolas", 9, [System.Drawing.FontStyle]::Bold)

    $sfCenter = New-Object System.Drawing.StringFormat
    $sfCenter.Alignment = [System.Drawing.StringAlignment]::Center

    $curY = 10

    # Draw logo if available
    if (Test-Path $logoPath) {
        try {
            $logo = [System.Drawing.Image]::FromFile($logoPath)
            $logoW = 180
            $logoH = [int]($logo.Height * ($logoW / $logo.Width))
            $logoX = [int](($width - $logoW) / 2)
            $g.DrawImage($logo, $logoX, $curY, $logoW, $logoH)
            $curY += $logoH + 6
            $logo.Dispose()
        } catch {
            $g.DrawString("ITHI POORAM", $fTitle, $black, ($width / 2), $curY, $sfCenter)
            $curY += 24
        }
    } else {
        $g.DrawString("ITHI POORAM", $fTitle, $black, ($width / 2), $curY, $sfCenter)
        $curY += 24
    }

    $g.DrawString("------------------------------------------", $fBody, $black, ($width / 2), $curY, $sfCenter)
    $curY += 16
    $g.DrawString("[OK] PRINTER CONNECTED & READY", $fSub, $black, ($width / 2), $curY, $sfCenter)
    $curY += 18
    $g.DrawString("------------------------------------------", $fBody, $black, ($width / 2), $curY, $sfCenter)
    $curY += 18

    $g.DrawString("Device Name : B-41 (SEZNIK 58mm)", $fBody, $black, 15, $curY)
    $curY += 16
    $g.DrawString("Port        : Bluetooth Serial ($connectedPort)", $fBody, $black, 15, $curY)
    $curY += 16
    $g.DrawString("Status      : ONLINE & READY TO PRINT", $fBody, $black, 15, $curY)
    $curY += 16
    $g.DrawString("Connected At: $now", $fBody, $black, 15, $curY)
    $curY += 20

    $g.DrawString("==========================================", $fBody, $black, ($width / 2), $curY, $sfCenter)
    $curY += 16
    $g.DrawString("READY TO SERVE COUNTER ORDERS", $fSub, $black, ($width / 2), $curY, $sfCenter)
    $curY += 35

    # Crop bitmap
    $actualBmp = $bmp.Clone((New-Object System.Drawing.Rectangle 0, 0, $width, $curY), $bmp.PixelFormat)

    # Convert to ESC/POS raster bands using FastRasterizer from print_bluetooth.ps1
    # or simple ESC/POS command stream
    $bands = [FastRasterizer]::ConvertToBands($actualBmp, 24)

    $actualBmp.Dispose()
    $g.Dispose()
    $bmp.Dispose()

    # Commands for init and final tear-off feed
    $initBytes = [byte[]]@(0x1B, 0x40, 0x1B, 0x61, 0x01) # ESC @, ESC a 1
    $feedBytes = [byte[]]@(0x1B, 0x64, 0x05)             # ESC d 5

    # Transmit to printer
    $connectedSp.BaseStream.Write($initBytes, 0, $initBytes.Length)
    $connectedSp.BaseStream.Flush()
    Start-Sleep -Milliseconds 60

    foreach ($b in $bands) {
        $connectedSp.BaseStream.Write($b, 0, $b.Length)
        $connectedSp.BaseStream.Flush()
        Start-Sleep -Milliseconds 95
    }

    $connectedSp.BaseStream.Write($feedBytes, 0, $feedBytes.Length)
    $connectedSp.BaseStream.Flush()
    Start-Sleep -Milliseconds 800

    $connectedSp.Close()
    $connectedSp.Dispose()

    Write-Host "`nSUCCESS: B-41 Printer reconnected on $connectedPort and test slip printed!" -ForegroundColor Green
    Show-Notification "Ithi Pooram - Printer Ready" "✓ Printer B-41 is CONNECTED & ONLINE on $connectedPort!`n`nTest slip has been printed successfully.`nBilling counter is ready to print receipts." ([System.Windows.Forms.MessageBoxIcon]::Information)
    Write-Output (@{ success = $true; port = $connectedPort; message = "Printer B-41 connected on $connectedPort" } | ConvertTo-Json -Compress)
    exit 0
} catch {
    Write-Host "`nError during test print: $($_.Exception.Message)" -ForegroundColor Red
    if ($connectedSp -and $connectedSp.IsOpen) {
        $connectedSp.Close()
        $connectedSp.Dispose()
    }
    Show-Notification "Ithi Pooram - Reconnect Error" "Connected to port $connectedPort but encountered an error: $($_.Exception.Message)" ([System.Windows.Forms.MessageBoxIcon]::Error)
    Write-Output (@{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress)
    exit 1
}
