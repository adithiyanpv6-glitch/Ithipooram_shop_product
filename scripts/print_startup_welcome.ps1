param (
    [string]$PrinterName = "SEZNIK"
)

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $projectRoot "public\brand-calligraphy-cropped.png"
$footerPath = Join-Path $projectRoot "public\footer_malayalam.png"

$width = 384
$estimatedHeight = 850

$bmp = New-Object System.Drawing.Bitmap $width, $estimatedHeight
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$black = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)
$penDashed = New-Object System.Drawing.Pen ([System.Drawing.Color]::Black, 2)
$penDashed.DashPattern = [float[]]@(4.0, 3.0)

$sfCenter = New-Object System.Drawing.StringFormat
$sfCenter.Alignment = [System.Drawing.StringAlignment]::Center

$sfRight = New-Object System.Drawing.StringFormat
$sfRight.Alignment = [System.Drawing.StringAlignment]::Far

# Top Margin: Exactly 3-4 lines of clean blank space before the logo
$curY = 85

# 1. Logo (Cropped Malayalam Calligraphy - 320px width)
if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile((Resolve-Path $logoPath).Path)
    $logoW = 320
    $logoH = [int]($logo.Height * ($logoW / $logo.Width))
    $logoX = [int](($width - $logoW) / 2)
    $g.DrawImage($logo, $logoX, $curY, $logoW, $logoH)
    $curY += $logoH + 12
    $logo.Dispose()
}

# 2. Location
$fPlace = New-Object System.Drawing.Font ("Consolas", 14.5, [System.Drawing.FontStyle]::Bold)
$g.DrawString("VANCHIYOOR, TRIVANDRUM", $fPlace, $black, ($width / 2), $curY, $sfCenter)
$curY += 34

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 14

# 3. Welcome Owner Banner
$fWelcome = New-Object System.Drawing.Font ("Consolas", 17, [System.Drawing.FontStyle]::Bold)
$fSub = New-Object System.Drawing.Font ("Consolas", 12.5, [System.Drawing.FontStyle]::Bold)

$g.DrawString("*** WELCOME OWNER ***", $fWelcome, $black, ($width / 2), $curY, $sfCenter)
$curY += 34

$g.DrawString("SHOP OPENED & POS SYSTEM READY", $fSub, $black, ($width / 2), $curY, $sfCenter)
$curY += 28

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 14

# 4. Startup Details
$fLabel = New-Object System.Drawing.Font ("Consolas", 12.5, [System.Drawing.FontStyle]::Regular)
$fVal = New-Object System.Drawing.Font ("Consolas", 12.5, [System.Drawing.FontStyle]::Bold)

$dateStr = (Get-Date -Format "dd/MM/yyyy")
$timeStr = (Get-Date -Format "hh:mm tt")

$g.DrawString("Date: $dateStr", $fVal, $black, 10, $curY)
$g.DrawString($timeStr, $fVal, $black, ($width - 10), $curY, $sfRight)
$curY += 28

$g.DrawString("Terminal:", $fLabel, $black, 10, $curY)
$g.DrawString("Main Counter Desk", $fVal, $black, ($width - 10), $curY, $sfRight)
$curY += 28

$g.DrawString("Printer:", $fLabel, $black, 10, $curY)
$g.DrawString("SEZNIK 58mm Wireless", $fVal, $black, ($width - 10), $curY, $sfRight)
$curY += 28

$g.DrawString("Status:", $fLabel, $black, 10, $curY)
$g.DrawString("CONNECTED & ONLINE [OK]", $fVal, $black, ($width - 10), $curY, $sfRight)
$curY += 32

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 14

# 5. Mobile Staff Network Info
$fNet = New-Object System.Drawing.Font ("Consolas", 11.5, [System.Drawing.FontStyle]::Bold)
$g.DrawString("Hotspot Wi-Fi: IthiPooram-POS", $fNet, $black, 10, $curY)
$curY += 24
$g.DrawString("Cashier Phone: http://192.168.137.1:3000", $fNet, $black, 10, $curY)
$curY += 28

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 16

# 6. Malayalam Footer Image (255px width)
if (Test-Path $footerPath) {
    $footerImg = [System.Drawing.Image]::FromFile((Resolve-Path $footerPath).Path)
    $footW = 255
    $footH = [int]($footerImg.Height * ($footW / $footerImg.Width))
    $footX = [int](($width - $footW) / 2)
    $g.DrawImage($footerImg, $footX, $curY, $footW, $footH)
    $curY += $footH + 12
    $footerImg.Dispose()
}

# 7. Wish
$fWish = New-Object System.Drawing.Font ("Consolas", 12.5, [System.Drawing.FontStyle]::Bold)
$g.DrawString("HAVE A PROSPEROUS BUSINESS DAY!", $fWish, $black, ($width / 2), $curY, $sfCenter)
$curY += 34

# Bottom Margin: 110px blank space
$curY += 110

# Crop bitmap
$actualBmp = $bmp.Clone((New-Object System.Drawing.Rectangle 0, 0, $width, $curY), $bmp.PixelFormat)

# Paced Micro-Banding (24 dot rows per band = 1,160 bytes)
$bandHeight = 24
$xBytes = [int]($width / 8) # 48 bytes
$bands = New-Object System.Collections.Generic.List[byte[]]

for ($startY = 0; $startY -lt $curY; $startY += $bandHeight) {
    $currentBandHeight = [Math]::Min($bandHeight, $curY - $startY)
    $bandBytes = New-Object System.Collections.Generic.List[byte]
    
    # GS v 0 0 xL xH yL yH
    $bandBytes.Add(0x1D); $bandBytes.Add(0x76); $bandBytes.Add(0x30); $bandBytes.Add(0x00)
    $bandBytes.Add([byte]($xBytes % 256))
    $bandBytes.Add([byte][Math]::Floor($xBytes / 256))
    $bandBytes.Add([byte]($currentBandHeight % 256))
    $bandBytes.Add([byte][Math]::Floor($currentBandHeight / 256))

    for ($y = $startY; $y -lt ($startY + $currentBandHeight); $y++) {
        for ($byteX = 0; $byteX -lt $xBytes; $byteX++) {
            $curByte = 0
            for ($bit = 0; $bit -lt 8; $bit++) {
                $px = $byteX * 8 + $bit
                if ($px -lt $width) {
                    $color = $actualBmp.GetPixel($px, $y)
                    $lum = [int](0.299 * $color.R + 0.587 * $color.G + 0.114 * $color.B)
                    if ($lum -lt 150) {
                        $curByte = $curByte -bor (1 -shl (7 - $bit))
                    }
                }
            }
            $bandBytes.Add([byte]$curByte)
        }
    }
    $bands.Add($bandBytes.ToArray())
}

$actualBmp.Dispose()
$g.Dispose()
$bmp.Dispose()

$initBytes = [byte[]]@(0x1B, 0x40, 0x1B, 0x61, 0x01)
$feedBytes = [byte[]]@(0x1B, 0x64, 0x06)

$totalBytes = $initBytes.Length + $feedBytes.Length
foreach ($b in $bands) { $totalBytes += $b.Length }

# Transmit to COM3 with micro-band pacing
$comPorts = [System.IO.Ports.SerialPort]::GetPortNames()
if ($comPorts -and $comPorts.Length -gt 0) {
    $sortedPorts = @()
    if ($comPorts -contains "COM3") { $sortedPorts += "COM3" }
    foreach ($p in $comPorts) {
        if ($p -ne "COM3") { $sortedPorts += $p }
    }

    foreach ($port in $sortedPorts) {
        for ($retry = 0; $retry -lt 2; $retry++) {
            try {
                $sp = New-Object System.IO.Ports.SerialPort $port, 9600, None, 8, One
                $sp.Handshake = "None"
                $sp.DtrEnable = $true
                $sp.RtsEnable = $true
                $sp.WriteBufferSize = 32768
                $sp.WriteTimeout = 15000
                $sp.ReadTimeout = 2000
                $sp.Open()
                
                # Send Init
                $sp.BaseStream.Write($initBytes, 0, $initBytes.Length)
                $sp.BaseStream.Flush()
                Start-Sleep -Milliseconds 60

                # Send 24-row micro-bands with 95ms pacing
                foreach ($b in $bands) {
                    $sp.BaseStream.Write($b, 0, $b.Length)
                    $sp.BaseStream.Flush()
                    Start-Sleep -Milliseconds 95
                }

                # Send feed
                $sp.BaseStream.Write($feedBytes, 0, $feedBytes.Length)
                $sp.BaseStream.Flush()

                # Drain delay
                Start-Sleep -Milliseconds 2500

                $sp.Close()
                $sp.Dispose()
                Write-Output (@{ success = $true; channel = "Bluetooth_Serial_COM"; port = $port; bytes = $totalBytes; bands = $bands.Count } | ConvertTo-Json -Compress)
                exit 0
            } catch {
                Start-Sleep -Milliseconds 400
            }
        }
    }
}

Write-Output '{"success":false,"error":"Printer not reachable"}'
exit 1
