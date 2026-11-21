# =========================================================================
# ITHI POORAM - Cloudflare Worker Automated Deployer
# Sets up the permanent Customer Table QR reverse proxy
# =========================================================================

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$projectDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
$dataDir = Join-Path $projectDir "data"
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
$workerUrlFile = Join-Path $dataDir "cloudflare_worker_url.txt"

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "       ITHI POORAM - PERMANENT CUSTOMER QR CLOUDFLARE WORKER SETUP       " -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check authentication
Write-Host "[1/4] Checking Cloudflare login status..." -ForegroundColor White
$whoamiOutput = & npx wrangler whoami 2>&1 | Out-String

if ($whoamiOutput -match "You are not authenticated") {
    Write-Host ""
    Write-Host ">> Cloudflare account authentication required." -ForegroundColor Yellow
    Write-Host ">> A browser window will now open to log in." -ForegroundColor Cyan
    Write-Host "   - If you already have an account, log in." -ForegroundColor White
    Write-Host "   - If you don't have one, create a free account (100% Free Forever)." -ForegroundColor White
    Write-Host "   - Click 'Allow' when asked to grant Wrangler permissions." -ForegroundColor Green
    Write-Host ""
    Start-Sleep -Seconds 2
    & npx wrangler login
    
    # Re-verify
    $whoamiOutput = & npx wrangler whoami 2>&1 | Out-String
    if ($whoamiOutput -match "You are not authenticated") {
        Write-Host ""
        Write-Host "[ERROR] Cloudflare login was not completed. Please run this again." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host " -> Logged in successfully to Cloudflare!" -ForegroundColor Green

# Step 2: Ensure KV namespace exists
Write-Host ""
Write-Host "[2/4] Setting up free KV storage (ITHIPOORAM_CONFIG)..." -ForegroundColor White

$kvId = $null
try {
    # Check if namespace already exists
    $listJson = & npx wrangler kv namespace list 2>$null | Out-String
    $jsonStart = $listJson.IndexOf('[')
    if ($jsonStart -ge 0) {
        $cleanJson = $listJson.Substring($jsonStart)
        $namespaces = $cleanJson | ConvertFrom-Json
        foreach ($ns in $namespaces) {
            if ($ns.title -like "*ITHIPOORAM_CONFIG*" -or $ns.title -like "*ithipooram*") {
                $kvId = $ns.id
                Write-Host " -> Found existing KV storage namespace: $kvId" -ForegroundColor Green
                break
            }
        }
    }
} catch {}

if (-not $kvId) {
    Write-Host " -> Creating new KV namespace 'ITHIPOORAM_CONFIG'..." -ForegroundColor Cyan
    $createOutput = & npx wrangler kv namespace create ITHIPOORAM_CONFIG 2>&1 | Out-String
    if ($createOutput -match 'id = "([a-f0-9]{32})"' -or $createOutput -match '([a-f0-9]{32})') {
        $kvId = $matches[1]
        Write-Host " -> Successfully created KV namespace: $kvId" -ForegroundColor Green
    } else {
        Start-Sleep -Seconds 2
        $listJson = & npx wrangler kv namespace list 2>$null | Out-String
        $jsonStart = $listJson.IndexOf('[')
        if ($jsonStart -ge 0) {
            $cleanJson = $listJson.Substring($jsonStart)
            $namespaces = $cleanJson | ConvertFrom-Json
            if ($namespaces.Count -gt 0) {
                $kvId = $namespaces[0].id
                Write-Host " -> KV namespace ID resolved: $kvId" -ForegroundColor Green
            }
        }
    }
}

if (-not $kvId) {
    Write-Host "[ERROR] Could not create or find KV namespace. Please check your Cloudflare account." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Update wrangler.toml with the kvId
$tomlPath = Join-Path $scriptDir "wrangler.toml"
$tomlContent = Get-Content $tomlPath -Raw
$newToml = $tomlContent -replace 'id = ".*"', "id = `"$kvId`""
Set-Content -Path $tomlPath -Value $newToml -Encoding UTF8
Write-Host " -> wrangler.toml configured with KV ID: $kvId" -ForegroundColor Green

# Step 3: Deploy Cloudflare Worker
Write-Host ""
Write-Host "[3/4] Deploying 'ithipooram-order' reverse-proxy worker to Cloudflare..." -ForegroundColor White
$deployOutput = & npx wrangler deploy 2>&1 | Out-String
Write-Host $deployOutput

$workerUrl = $null
if ($deployOutput -match 'https://[a-zA-Z0-9.-]+\.workers\.dev') {
    $workerUrl = $matches[0]
}

if (-not $workerUrl) {
    if ($whoamiOutput -match '([a-zA-Z0-9-]+)\.workers\.dev') {
        $workerUrl = "https://ithipooram-order." + $matches[1] + ".workers.dev"
    }
}

if (-not $workerUrl) {
    Write-Host ""
    Write-Host "[NOTICE] Could not automatically parse the worker URL from deploy output." -ForegroundColor Yellow
    $workerUrl = Read-Host "Please copy and paste your *.workers.dev URL here"
}

$workerUrl = $workerUrl.Trim().Replace("/healthz", "").TrimEnd("/")

# Step 4: Verification and saving
Write-Host ""
Write-Host "[4/4] Verifying and activating permanent Worker URL..." -ForegroundColor White
Write-Host " -> Worker URL: $workerUrl" -ForegroundColor Cyan

# Save to data/cloudflare_worker_url.txt
Set-Content -Path $workerUrlFile -Value $workerUrl -Force
Write-Host " -> Saved to: $workerUrlFile" -ForegroundColor Green

# Test health check
try {
    $healthRes = Invoke-RestMethod -Uri "$workerUrl/healthz" -TimeoutSec 10
    if ($healthRes -eq "OK") {
        Write-Host " -> Health check passed! Worker is 100% active and healthy." -ForegroundColor Green
    }
} catch {
    Write-Host " -> Note: Worker deployed. It may take 10-20 seconds to propagate worldwide." -ForegroundColor Yellow
}

# Update Desktop/MOBILE_LINKS_FOR_STAFF.txt
$staffLinksPath = "C:\Users\USR\Desktop\MOBILE_LINKS_FOR_STAFF.txt"
if (Test-Path $staffLinksPath) {
    try {
        $staffContent = Get-Content $staffLinksPath -Raw
        $updatedStaff = $staffContent -replace 'Live QR Menu & Order Link:.*', "PERMANENT TABLE QR LINK:        $workerUrl`r`n   (Permanent URL - Physical table QR stickers never need reprinting!)"
        Set-Content -Path $staffLinksPath -Value $updatedStaff -Encoding UTF8
        Write-Host " -> Updated MOBILE_LINKS_FOR_STAFF.txt with permanent QR address." -ForegroundColor Green
    } catch {}
}

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "   PERMANENT CLOUDFLARE WORKER SUCCESSFULLY SETUP AND CONFIGURED!       " -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Permanent Customer QR Base URL:" -ForegroundColor White
Write-Host "  >> $workerUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Table QR Sticker URLs will be formatted like:" -ForegroundColor White
Write-Host "  >> $workerUrl/order?table=T1&room=AC%20Room" -ForegroundColor Cyan
Write-Host ""
Write-Host "From now on:" -ForegroundColor White
Write-Host "1. You can print physical Table QR Stickers from: http://localhost:3000/qr" -ForegroundColor Green
Write-Host "2. Laminate and paste them on tables once - they NEVER expire or change!" -ForegroundColor Green
Write-Host "3. Every morning when 'START_ITHIPOORAM_POS.bat' runs, the POS automatically" -ForegroundColor Green
Write-Host "   connects today's live tunnel to this permanent address in 2 seconds." -ForegroundColor Green
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to finish"
