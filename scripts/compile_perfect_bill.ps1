Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $projectRoot "public\brand-calligraphy-cropped.png"
$footerPath = Join-Path $projectRoot "public\footer_malayalam.png"
$outputPng = Join-Path $PSScriptRoot "test_rendered_bill_v3.png"

$width = 384
$height = 1100

$bmp = New-Object System.Drawing.Bitmap $width, $height
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

# 1. Logo (Cropped Malayalam Calligraphy - Stepped up to 320px width)
if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile((Resolve-Path $logoPath).Path)
    $logoW = 320
    $logoH = [int]($logo.Height * ($logoW / $logo.Width))
    $logoX = [int](($width - $logoW) / 2)
    $g.DrawImage($logo, $logoX, $curY, $logoW, $logoH)
    $curY += $logoH + 12
    $logo.Dispose()
}

# 2. Location (Centered uppercase - Stepped up to 14.5pt Bold)
$fPlace = New-Object System.Drawing.Font ("Consolas", 14.5, [System.Drawing.FontStyle]::Bold)
$g.DrawString("VANCHIYOOR, TRIVANDRUM", $fPlace, $black, ($width / 2), $curY, $sfCenter)
$curY += 34

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 14

# 3. Metadata (Invoice, Date, Time, Table, Cashier - Stepped up to 14pt Bold)
$fMetaBold = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Bold)
$fMetaNormal = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Bold)

$g.DrawString("Inv: INV-20261115-427", $fMetaBold, $black, 8, $curY)
$g.DrawString("06:26 pm", $fMetaNormal, $black, ($width - 8), $curY, $sfRight)
$curY += 30

$g.DrawString("Date: 15/11/2026", $fMetaNormal, $black, 8, $curY)
$g.DrawString("Table: T1A", $fMetaBold, $black, ($width - 8), $curY, $sfRight)
$curY += 30

$g.DrawString("Cashier: Main Administrator", $fMetaNormal, $black, 8, $curY)
$curY += 34

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 14

# 4. Table Header (Stepped up to 14pt Bold)
$fHeader = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Bold)
$g.DrawString("ITEM", $fHeader, $black, 8, $curY)
$g.DrawString("QTY", $fHeader, $black, 205, $curY, $sfCenter)
$g.DrawString("RATE", $fHeader, $black, 285, $curY, $sfRight)
$g.DrawString("TOTAL", $fHeader, $black, ($width - 8), $curY, $sfRight)
$curY += 28

$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 14

# 5. Items Rows (Stepped up to 15pt Bold & 14.5pt Bold prices)
$fItem = New-Object System.Drawing.Font ("Consolas", 15, [System.Drawing.FontStyle]::Bold)
$fNirmala = New-Object System.Drawing.Font ("Nirmala UI", 14.5, [System.Drawing.FontStyle]::Bold)

# Row 1: Idli
$g.DrawString("Idli", $fItem, $black, 8, $curY)
$g.DrawString("1", $fItem, $black, 205, $curY, $sfCenter)
$g.DrawString([char]0x20B9 + "25", $fNirmala, $black, 285, $curY, $sfRight)
$g.DrawString([char]0x20B9 + "25", $fNirmala, $black, ($width - 8), $curY, $sfRight)
$curY += 36

# Row 2: Chicken 65
$g.DrawString("Chicken 65", $fItem, $black, 8, $curY)
$g.DrawString("1", $fItem, $black, 205, $curY, $sfCenter)
$g.DrawString([char]0x20B9 + "200", $fNirmala, $black, 285, $curY, $sfRight)
$g.DrawString([char]0x20B9 + "200", $fNirmala, $black, ($width - 8), $curY, $sfRight)
$curY += 40

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 18

# 6. Grand Total (Stepped up: 16.5pt label, 25pt Bold Amount!)
$fTotalLabel = New-Object System.Drawing.Font ("Consolas", 16.5, [System.Drawing.FontStyle]::Bold)
$fTotalAmount = New-Object System.Drawing.Font ("Nirmala UI", 25, [System.Drawing.FontStyle]::Bold)
$g.DrawString("GRAND TOTAL:", $fTotalLabel, $black, 8, $curY + 8)
$g.DrawString([char]0x20B9 + "225.00", $fTotalAmount, $black, ($width - 8), $curY, $sfRight)
$curY += 52

# Payment Mode (Stepped up to 14pt Bold)
$fPayment = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Regular)
$fPaymentMode = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Bold)
$g.DrawString("Payment:", $fPayment, $black, 8, $curY)
$g.DrawString("[CASH]", $fPaymentMode, $black, ($width - 8), $curY, $sfRight)
$curY += 34

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 20

# 7. Malayalam Footer Image (Stepped up to 255px width)
if (Test-Path $footerPath) {
    $footerImg = [System.Drawing.Image]::FromFile((Resolve-Path $footerPath).Path)
    $footW = 255
    $footH = [int]($footerImg.Height * ($footW / $footerImg.Width))
    $footX = [int](($width - $footW) / 2)
    $g.DrawImage($footerImg, $footX, $curY, $footW, $footH)
    $curY += $footH + 12
    $footerImg.Dispose()
}

# 8. English Footer (Stepped up to 13.5pt Bold)
$fEnglish = New-Object System.Drawing.Font ("Consolas", 13.5, [System.Drawing.FontStyle]::Bold)
$g.DrawString("THANK YOU! VISIT AGAIN", $fEnglish, $black, ($width / 2), $curY, $sfCenter)
$curY += 34

# Bottom Margin: 1 line MORE space down the bill (+30px = 110px total)
$curY += 110

# Save final bitmap cropped
$actualBmp = $bmp.Clone((New-Object System.Drawing.Rectangle 0, 0, $width, $curY), $bmp.PixelFormat)
$actualBmp.Save($outputPng, [System.Drawing.Imaging.ImageFormat]::Png)

# Convert actualBmp to ESC/POS GS v 0 raster bytes
$rasterBytes = New-Object System.Collections.Generic.List[byte]
# ESC @ (Initialize)
$rasterBytes.Add(0x1B); $rasterBytes.Add(0x40)

# Center align: ESC a 1
$rasterBytes.Add(0x1B); $rasterBytes.Add(0x61); $rasterBytes.Add(0x01)

# GS v 0 0 xL xH yL yH
$rasterBytes.Add(0x1D); $rasterBytes.Add(0x76); $rasterBytes.Add(0x30); $rasterBytes.Add(0x00)

$xBytes = [int]($width / 8) # 48 bytes
$yDots = $curY

$rasterBytes.Add([byte]($xBytes % 256))
$rasterBytes.Add([byte][Math]::Floor($xBytes / 256))
$rasterBytes.Add([byte]($yDots % 256))
$rasterBytes.Add([byte][Math]::Floor($yDots / 256))

for ($y = 0; $y -lt $yDots; $y++) {
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
        $rasterBytes.Add([byte]$curByte)
    }
}

# Line feeds and feed cut command (ESC d 7)
$rasterBytes.Add(0x1B); $rasterBytes.Add(0x64); $rasterBytes.Add(0x07)

$actualBmp.Dispose()
$g.Dispose()
$bmp.Dispose()

$allData = $rasterBytes.ToArray()
[System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot "test_bill_raster_v3.bin"), $allData)

Write-Output "Successfully compiled v3 raster binary ($($allData.Length) bytes, Height: $yDots px)"
