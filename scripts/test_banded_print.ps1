param (
    [string]$Port = "COM3"
)

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$v3Png = Join-Path $PSScriptRoot "test_rendered_bill_v3.png"

if (-not (Test-Path $v3Png)) {
    Write-Output "test_rendered_bill_v3.png not found"
    exit 1
}

$bmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $v3Png).Path)
$width = $bmp.Width
$height = $bmp.Height

$xBytes = [int]($width / 8) # 48 bytes
$bandHeight = 80 # Slice size in rows (under 100 dots for zero firmware overflow)

$allBytes = New-Object System.Collections.Generic.List[byte]

# ESC @ (Initialize)
$allBytes.Add(0x1B); $allBytes.Add(0x40)

# Center align: ESC a 1
$allBytes.Add(0x1B); $allBytes.Add(0x61); $allBytes.Add(0x01)

for ($startY = 0; $startY -lt $height; $startY += $bandHeight) {
    $currentBandHeight = [Math]::Min($bandHeight, $height - $startY)
    
    # GS v 0 0 xL xH yL yH
    $allBytes.Add(0x1D); $allBytes.Add(0x76); $allBytes.Add(0x30); $allBytes.Add(0x00)
    $allBytes.Add([byte]($xBytes % 256))
    $allBytes.Add([byte][Math]::Floor($xBytes / 256))
    $allBytes.Add([byte]($currentBandHeight % 256))
    $allBytes.Add([byte][Math]::Floor($currentBandHeight / 256))

    for ($y = $startY; $y -lt ($startY + $currentBandHeight); $y++) {
        for ($byteX = 0; $byteX -lt $xBytes; $byteX++) {
            $curByte = 0
            for ($bit = 0; $bit -lt 8; $bit++) {
                $px = $byteX * 8 + $bit
                if ($px -lt $width) {
                    $color = $bmp.GetPixel($px, $y)
                    $lum = [int](0.299 * $color.R + 0.587 * $color.G + 0.114 * $color.B)
                    if ($lum -lt 150) {
                        $curByte = $curByte -bor (1 -shl (7 - $bit))
                    }
                }
            }
            $allBytes.Add([byte]$curByte)
        }
    }
}

# Line feeds and feed cut command (ESC d 7)
$allBytes.Add(0x1B); $allBytes.Add(0x64); $allBytes.Add(0x07)

$bmp.Dispose()

$data = $allBytes.ToArray()
Write-Output "Total banded ESC/POS bytes: $($data.Length)"

# Send to COM3 with chunking
$sp = New-Object System.IO.Ports.SerialPort $Port, 9600, None, 8, One
$sp.WriteTimeout = 8000
$sp.Open()

$chunkSize = 1024
for ($offset = 0; $offset -lt $data.Length; $offset += $chunkSize) {
    $len = [Math]::Min($chunkSize, $data.Length - $offset)
    $sp.BaseStream.Write($data, $offset, $len)
    $sp.BaseStream.Flush()
    Start-Sleep -Milliseconds 45
}

Start-Sleep -Milliseconds 600
$sp.Close()
$sp.Dispose()

Write-Output "Successfully sent banded print job to $Port without any overflow!"
