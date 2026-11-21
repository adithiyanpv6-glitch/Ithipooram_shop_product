Add-Type -AssemblyName System.Drawing

param(
    [string]$ImagePath = "scripts\test_rendered_bill.png"
)

$width = 384
$height = 680

$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$black = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)
$penDashed = New-Object System.Drawing.Pen ([System.Drawing.Color]::Black, 2)
$penDashed.DashPattern = [float[]]@(4.0, 3.0)

# 1. Logo
$projectRoot = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $projectRoot "public\brand-calligraphy-cropped.png"
$curY = 12
if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile((Resolve-Path $logoPath).Path)
    $logoW = 270
    $logoH = [int]($logo.Height * ($logoW / $logo.Width))
    $logoX = [int](($width - $logoW) / 2)
    $g.DrawImage($logo, $logoX, $curY, $logoW, $logoH)
    $curY += $logoH + 8
    $logo.Dispose()
}

# 2. Location
$fPlace = New-Object System.Drawing.Font ("Consolas", 11, [System.Drawing.FontStyle]::Bold)
$sfCenter = New-Object System.Drawing.StringFormat
$sfCenter.Alignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("VANCHIYOOR, TRIVANDRUM", $fPlace, $black, ($width / 2), $curY, $sfCenter)
$curY += 26

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 10

# 3. Metadata
$fMeta = New-Object System.Drawing.Font ("Consolas", 10.5, [System.Drawing.FontStyle]::Bold)
$fMetaNormal = New-Object System.Drawing.Font ("Consolas", 10.5, [System.Drawing.FontStyle]::Regular)
$sfRight = New-Object System.Drawing.StringFormat
$sfRight.Alignment = [System.Drawing.StringAlignment]::Far

$g.DrawString("Inv: INV-20261115-427", $fMeta, $black, 12, $curY)
$g.DrawString("06:26 pm", $fMetaNormal, $black, ($width - 12), $curY, $sfRight)
$curY += 22

$g.DrawString("Date: 15/11/2026", $fMetaNormal, $black, 12, $curY)
$g.DrawString("Table: T1A", $fMeta, $black, ($width - 12), $curY, $sfRight)
$curY += 22

$g.DrawString("Cashier: Main Administrator", $fMetaNormal, $black, 12, $curY)
$curY += 26

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 10

# 4. Table Header
$fHeader = New-Object System.Drawing.Font ("Consolas", 10.5, [System.Drawing.FontStyle]::Bold)
$g.DrawString("ITEM", $fHeader, $black, 12, $curY)
$g.DrawString("QTY", $fHeader, $black, 215, $curY, $sfCenter)
$g.DrawString("RATE", $fHeader, $black, 290, $curY, $sfRight)
$g.DrawString("TOTAL", $fHeader, $black, ($width - 12), $curY, $sfRight)
$curY += 20

$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 10

# 5. Items
$fItem = New-Object System.Drawing.Font ("Consolas", 11, [System.Drawing.FontStyle]::Bold)
$fNirmala = New-Object System.Drawing.Font ("Nirmala UI", 10.5, [System.Drawing.FontStyle]::Bold)

# Row 1: Idli
$g.DrawString("Idli", $fItem, $black, 12, $curY)
$g.DrawString("1", $fItem, $black, 215, $curY, $sfCenter)
$g.DrawString([char]0x20B9 + "25", $fNirmala, $black, 290, $curY, $sfRight)
$g.DrawString([char]0x20B9 + "25", $fNirmala, $black, ($width - 12), $curY, $sfRight)
$curY += 26

# Row 2: Chicken 65
$g.DrawString("Chicken 65", $fItem, $black, 12, $curY)
$g.DrawString("1", $fItem, $black, 215, $curY, $sfCenter)
$g.DrawString([char]0x20B9 + "200", $fNirmala, $black, 290, $curY, $sfRight)
$g.DrawString([char]0x20B9 + "200", $fNirmala, $black, ($width - 12), $curY, $sfRight)
$curY += 30

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 14

# 6. Grand Total
$fTotalLabel = New-Object System.Drawing.Font ("Consolas", 13, [System.Drawing.FontStyle]::Bold)
$fTotalAmount = New-Object System.Drawing.Font ("Nirmala UI", 18, [System.Drawing.FontStyle]::Bold)
$g.DrawString("GRAND TOTAL:", $fTotalLabel, $black, 12, $curY + 4)
$g.DrawString([char]0x20B9 + "225.00", $fTotalAmount, $black, ($width - 12), $curY, $sfRight)
$curY += 38

# Payment Mode
$fPayment = New-Object System.Drawing.Font ("Consolas", 10.5, [System.Drawing.FontStyle]::Regular)
$fPaymentMode = New-Object System.Drawing.Font ("Consolas", 10.5, [System.Drawing.FontStyle]::Bold)
$g.DrawString("Payment:", $fPayment, $black, 12, $curY)
$g.DrawString("[CASH]", $fPaymentMode, $black, ($width - 12), $curY, $sfRight)
$curY += 26

# Divider
$g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
$curY += 16

# 7. Malayalam & English Footer
$fMalayalam = New-Object System.Drawing.Font ("Nirmala UI", 13.5, [System.Drawing.FontStyle]::Bold)
$g.DrawString("നന്ദി! വീണ്ടും വരിക", $fMalayalam, $black, ($width / 2), $curY, $sfCenter)
$curY += 26

$fEnglish = New-Object System.Drawing.Font ("Consolas", 10, [System.Drawing.FontStyle]::Bold)
$g.DrawString("THANK YOU! VISIT AGAIN", $fEnglish, $black, ($width / 2), $curY, $sfCenter)
$curY += 24

# Save final bitmap cropped to exact content height
$actualBmp = $bmp.Clone((New-Object System.Drawing.Rectangle 0, 0, $width, $curY), $bmp.PixelFormat)
$actualBmp.Save($ImagePath, [System.Drawing.Imaging.ImageFormat]::Png)

$actualBmp.Dispose()
$g.Dispose()
$bmp.Dispose()

Write-Output "Generated bill preview image at $ImagePath (Height: $curY px)"
