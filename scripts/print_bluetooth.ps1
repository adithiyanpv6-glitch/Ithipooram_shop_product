param (
    [Parameter(Mandatory=$false)]
    [string]$PrinterName = "SEZNIK",

    [Parameter(Mandatory=$false)]
    [string]$Text = "",

    [Parameter(Mandatory=$false)]
    [string]$FilePath = ""
)

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

try {
    # 1. Read input text from file if provided
    if (-not $Text -and $FilePath -and (Test-Path $FilePath)) {
        $Text = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)
    }

    if (-not $Text -or -not $Text.Trim()) {
        Write-Output '{"success":false,"error":"No receipt text provided"}'
        exit 1
    }

    $projectRoot = Split-Path -Parent $PSScriptRoot
    $logoPath = Join-Path $projectRoot "public\brand-calligraphy-cropped.png"
    $footerPath = Join-Path $projectRoot "public\footer_malayalam.png"

    # 2. Parse Structured Data (support both JSON input and formatted text input)
    $isJson = $false
    $jsonData = $null
    $trimmed = $Text.Trim()
    if ($trimmed.StartsWith("{") -and $trimmed.EndsWith("}")) {
        try {
            $jsonData = $trimmed | ConvertFrom-Json
            if ($jsonData) { $isJson = $true }
        } catch {}
    }

    $invoiceNumber = "INV-" + (Get-Date -Format "yyyyMMdd") + "-001"
    $dateStr = (Get-Date -Format "dd/MM/yyyy")
    $timeStr = (Get-Date -Format "hh:mm tt").ToLower()
    $tableName = "T1A"
    $cashierName = "Main Administrator"
    $paymentMode = "CASH"
    $grandTotal = "0.00"
    $placeName = "VANCHIYOOR, TRIVANDRUM"
    $itemsList = New-Object System.Collections.Generic.List[PSObject]

    if ($isJson -and $jsonData) {
        if ($jsonData.invoiceNumber) { $invoiceNumber = [string]$jsonData.invoiceNumber }
        if ($jsonData.dateStr) { $dateStr = [string]$jsonData.dateStr }
        if ($jsonData.timeStr) { $timeStr = [string]$jsonData.timeStr }
        if ($jsonData.tableCode) { $tableName = [string]$jsonData.tableCode }
        if ($jsonData.tableName) { $tableName = [string]$jsonData.tableName }
        if ($jsonData.cashierName) { $cashierName = [string]$jsonData.cashierName }
        if ($jsonData.paymentMode) { $paymentMode = [string]$jsonData.paymentMode }
        if ($jsonData.grandTotal) { $grandTotal = [string]$jsonData.grandTotal }
        if ($jsonData.placeName) { $placeName = [string]$jsonData.placeName }

        if ($jsonData.items) {
            foreach ($it in $jsonData.items) {
                $name = if ($it.name) { [string]$it.name } else { "Dish" }
                $qty = if ($it.qty) { [int]$it.qty } else { 1 }
                $rate = if ($it.rate) { [double]$it.rate } else { 0 }
                $total = if ($it.total) { [double]$it.total } else { $qty * $rate }
                $itemsList.Add([PSCustomObject]@{
                    name = $name
                    qty = $qty
                    rate = $rate
                    total = $total
                })
            }
        }
    } else {
        # Parse text lines
        $lines = $Text -split "`r?`n"

        # Check for Invoice Number & Time
        foreach ($l in $lines) {
            if ($l -match "Inv:\s*([^\s]+)(?:\s+([0-9:apmAPM ]+))?") {
                $invoiceNumber = $matches[1].Trim()
                if ($matches[2]) { $timeStr = $matches[2].Trim() }
            }
            if ($l -match "Date:\s*([0-9\/\-]+)") {
                $dateStr = $matches[1].Trim()
            }
            if ($l -match "Time:\s*([0-9:apmAPM ]+)") {
                $timeStr = $matches[1].Trim()
            }
            if ($l -match "Table:\s*([^\r\n]+)") {
                $rawTbl = $matches[1].Trim()
                $tableName = ($rawTbl -replace '\s*\([^)]*\)', '').Trim()
            }
            if ($l -match "Cashier:\s*([^\r\n]+)") {
                $cashierName = $matches[1].Trim()
            }
            if ($l -match "Payment:\s*\[?([A-Za-z0-9]+)\]?") {
                $paymentMode = $matches[1].Trim().ToUpper()
            }
            if ($l -match "GRAND TOTAL:[^\d]*([0-9]+\.?[0-9]*)") {
                $grandTotal = $matches[1].Trim()
            } elseif ($l -match "TOTAL:[^\d]*([0-9]+\.?[0-9]*)" -and [double]$grandTotal -eq 0) {
                $grandTotal = $matches[1].Trim()
            }
        }

        # Parse Item Rows: lines between ITEM header and TOTAL/Subtotal/Divider
        $inItems = $false
        foreach ($l in $lines) {
            if ($l -match "ITEM\s+QTY\s+RATE\s+TOTAL" -or $l -match "ITEM\s+QTY\s+AMT") {
                $inItems = $true
                continue
            }
            if ($inItems -and ($l -match "^[=-]{5,}" -or $l -match "GRAND TOTAL" -or $l -match "Subtotal" -or $l -match "Payment")) {
                if ($itemsList.Count -gt 0) {
                    $inItems = $false
                    continue
                }
            }
            if ($inItems -and $l.Trim() -and -not ($l -match "^[=-]{5,}")) {
                if ($l -match "^(.+?)\s+(\d+)\s+([0-9.]+)\s+([0-9.]+)$") {
                    $itemsList.Add([PSCustomObject]@{
                        name = $matches[1].Trim()
                        qty = [int]$matches[2]
                        rate = [double]$matches[3]
                        total = [double]$matches[4]
                    })
                } elseif ($l -match "^(.+?)\s+(\d+)\s+([0-9.]+)$") {
                    $qty = [int]$matches[2]
                    $tot = [double]$matches[3]
                    $rate = if ($qty -gt 0) { [Math]::Round($tot / $qty, 2) } else { $tot }
                    $itemsList.Add([PSCustomObject]@{
                        name = $matches[1].Trim()
                        qty = $qty
                        rate = $rate
                        total = $tot
                    })
                }
            }
        }
    }

    # Fallback to sum of item line totals if grand total was 0 or unparsed
    if (([double]$grandTotal -le 0.01) -and ($itemsList.Count -gt 0)) {
        $calcSum = 0
        foreach ($it in $itemsList) { $calcSum += $it.total }
        if ($calcSum -gt 0) {
            $grandTotal = ([double]$calcSum).ToString("F2")
        }
    }

    # Ensure grand total has 2 decimals
    if ($grandTotal -match '^[0-9]+(\.[0-9]+)?$') {
        $grandTotal = ([double]$grandTotal).ToString("F2")
    }

    # 3. Render High-Resolution Monochrome Bitmap with Stepped-Up Fonts & Margins
    $width = 384
    $itemRows = [Math]::Max(1, $itemsList.Count)
    $estimatedHeight = 90 + 120 + 35 + 14 + 100 + 14 + 30 + 14 + ($itemRows * 42) + 18 + 55 + 35 + 20 + 55 + 35 + 120

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
    $g.DrawString($placeName.ToUpper(), $fPlace, $black, ($width / 2), $curY, $sfCenter)
    $curY += 34

    # Divider
    $g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
    $curY += 14

    # 3. Metadata (Invoice, Date, Time, Table, Cashier - Stepped up to 14pt Bold)
    $fMetaBold = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Bold)
    $fMetaNormal = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Bold)

    $g.DrawString("Inv: $invoiceNumber", $fMetaBold, $black, 8, $curY)
    $g.DrawString($timeStr, $fMetaNormal, $black, ($width - 8), $curY, $sfRight)
    $curY += 30

    $g.DrawString("Date: $dateStr", $fMetaNormal, $black, 8, $curY)
    $g.DrawString("Table: $tableName", $fMetaBold, $black, ($width - 8), $curY, $sfRight)
    $curY += 30

    $g.DrawString("Cashier: $cashierName", $fMetaNormal, $black, 8, $curY)
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

    if ($itemsList.Count -eq 0) {
        $itemsList.Add([PSCustomObject]@{ name = "Food Order"; qty = 1; rate = [double]$grandTotal; total = [double]$grandTotal })
    }

    foreach ($it in $itemsList) {
        $dishName = if ($it.name.Length -gt 18) { $it.name.Substring(0, 18) } else { $it.name }
        $g.DrawString($dishName, $fItem, $black, 8, $curY)
        $g.DrawString([string]$it.qty, $fItem, $black, 205, $curY, $sfCenter)
        $g.DrawString([char]0x20B9 + ([double]$it.rate).ToString("0"), $fNirmala, $black, 285, $curY, $sfRight)
        $g.DrawString([char]0x20B9 + ([double]$it.total).ToString("0"), $fNirmala, $black, ($width - 8), $curY, $sfRight)
        $curY += 36
    }

    # Divider
    $g.DrawLine($penDashed, 10, $curY, ($width - 10), $curY)
    $curY += 18

    # 6. Grand Total (Stepped up: 16.5pt label, 25pt Bold Amount!)
    $fTotalLabel = New-Object System.Drawing.Font ("Consolas", 16.5, [System.Drawing.FontStyle]::Bold)
    $fTotalAmount = New-Object System.Drawing.Font ("Nirmala UI", 25, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("GRAND TOTAL:", $fTotalLabel, $black, 8, $curY + 8)
    $g.DrawString([char]0x20B9 + $grandTotal, $fTotalAmount, $black, ($width - 8), $curY, $sfRight)
    $curY += 52

    # Payment Mode (Stepped up to 14pt Bold)
    $fPayment = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Regular)
    $fPaymentMode = New-Object System.Drawing.Font ("Consolas", 14, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("Payment:", $fPayment, $black, 8, $curY)
    $g.DrawString("[$paymentMode]", $fPaymentMode, $black, ($width - 8), $curY, $sfRight)
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

    # Crop bitmap to actual content
    $actualBmp = $bmp.Clone((New-Object System.Drawing.Rectangle 0, 0, $width, $curY), $bmp.PixelFormat)

    # 4. Generate discrete micro-bands of 24 dot rows each (1,160 bytes per band) in 20ms using C# LockBits
    $bands = [FastRasterizer]::ConvertToBands($actualBmp, 24)

    # Clean up GDI resources immediately
    $actualBmp.Dispose()
    $g.Dispose()
    $bmp.Dispose()

    # Commands for init and final tear-off feed
    $initBytes = [byte[]]@(0x1B, 0x40, 0x1B, 0x61, 0x01) # ESC @ (init), ESC a 1 (center)
    $feedBytes = [byte[]]@(0x1B, 0x64, 0x06)             # ESC d 6 (feed 6 lines for tear-off)

    # Calculate total bytes
    $totalBytes = $initBytes.Length + $feedBytes.Length
    foreach ($b in $bands) { $totalBytes += $b.Length }

    # 5. Transmit to SEZNIK Bluetooth Serial COM port with Paced Micro-Banding
    $comPorts = [System.IO.Ports.SerialPort]::GetPortNames()
    if ($comPorts -and $comPorts.Length -gt 0) {
        $sortedPorts = @()
        if ($comPorts -contains "COM3") { $sortedPorts += "COM3" }
        foreach ($p in $comPorts) {
            if ($p -ne "COM3") { $sortedPorts += $p }
        }

        foreach ($port in $sortedPorts) {
            for ($retry = 0; $retry -lt 3; $retry++) {
                try {
                    $sp = New-Object System.IO.Ports.SerialPort $port, 9600, None, 8, One
                    $sp.Handshake = "None"
                    $sp.DtrEnable = $true
                    $sp.RtsEnable = $true
                    $sp.WriteBufferSize = 32768
                    $sp.WriteTimeout = 15000
                    $sp.ReadTimeout = 2000
                    $sp.Open()

                    # Send Init Command
                    $sp.BaseStream.Write($initBytes, 0, $initBytes.Length)
                    $sp.BaseStream.Flush()
                    Start-Sleep -Milliseconds 60

                    # Send discrete micro-bands with 95ms spacing
                    # 24 dot rows = 3mm of paper. At 35mm/s, printing takes ~85ms.
                    # Sleeping 95ms matches the stepper motor so the buffer NEVER fills up!
                    foreach ($b in $bands) {
                        $sp.BaseStream.Write($b, 0, $b.Length)
                        $sp.BaseStream.Flush()
                        Start-Sleep -Milliseconds 95
                    }

                    # Send final paper feed
                    $sp.BaseStream.Write($feedBytes, 0, $feedBytes.Length)
                    $sp.BaseStream.Flush()

                    # Drain delay: wait 800ms for motor to finish physical feed before closing Bluetooth link
                    Start-Sleep -Milliseconds 800

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

    # 6. Fallback to Windows Spooler if COM not opened
    $printers = Get-Printer -ErrorAction SilentlyContinue
    $btPrinter = $printers | Where-Object { $_.Name -match "B-41|B41|SEZNIK|POS|58|Thermal" } | Select-Object -First 1

    if ($btPrinter) {
        $spoolList = New-Object System.Collections.Generic.List[byte]
        $spoolList.AddRange($initBytes)
        foreach ($b in $bands) { $spoolList.AddRange($b) }
        $spoolList.AddRange($feedBytes)
        $allSpoolBytes = $spoolList.ToArray()

        $csharpCode = @"
using System;
using System.Runtime.InteropServices;

public class BtPacedSpooler
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytes(string szPrinterName, byte[] pBytes)
    {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA { pDocName = "IthiPooram_Raster_Receipt", pDataType = "RAW" };
        if (!OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) return false;
        if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return false; }
        if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }

        IntPtr pUnmanaged = Marshal.AllocCoTaskMem(pBytes.Length);
        Marshal.Copy(pBytes, 0, pUnmanaged, pBytes.Length);
        int written = 0;
        bool success = WritePrinter(hPrinter, pUnmanaged, pBytes.Length, out written);
        Marshal.FreeCoTaskMem(pUnmanaged);

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return success;
    }
}
"@
        Add-Type -TypeDefinition $csharpCode -Language CSharp
        $res = [BtPacedSpooler]::SendBytes($btPrinter.Name, $allSpoolBytes)
        if ($res) {
            Write-Output (@{ success = $true; channel = "Windows_Printer_Queue"; printer = $btPrinter.Name } | ConvertTo-Json -Compress)
            exit 0
        }
    }

    Write-Output '{"success":false,"error":"Bluetooth printer COM port or queue not reachable"}'
    exit 1
} catch {
    Write-Output (@{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress)
    exit 1
}
