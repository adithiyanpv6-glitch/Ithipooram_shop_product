@echo off
title ITHI POORAM - Deploy Permanent Cloudflare Worker
color 0B
cls

cd /d "C:\Users\USR\Desktop\ITHIPOORAM\Ithipooram_shop_product-main\cloudflare-worker"

echo =========================================================================
echo       ITHI POORAM - PERMANENT CUSTOMER QR WORKER DEPLOYMENT (FREE)
echo =========================================================================
echo.
echo Step 1: Logging into free Cloudflare account...
echo A browser window will open. Click 'Allow' to authorize.
echo.

call npx wrangler login

echo.
echo =========================================================================
echo Step 2: Creating permanent free KV storage...
echo =========================================================================

call npx wrangler kv:namespace create ITHIPOORAM_CONFIG > kv_output.txt
type kv_output.txt

powershell -NoProfile -Command "$txt = Get-Content kv_output.txt -Raw; if ($txt -match 'id = \"\"([a-f0-9]+)\"\"') { $id = $matches[1]; (Get-Content wrangler.toml) -replace 'id = \".*\"', \"id = `\"$id`\"\" | Set-Content wrangler.toml }"

echo.
echo =========================================================================
echo Step 3: Deploying permanent customer QR reverse-proxy worker...
echo =========================================================================

call npx wrangler deploy

echo.
echo =========================================================================
echo Deployment Complete! Copy your permanent *.workers.dev URL above.
echo =========================================================================
pause
