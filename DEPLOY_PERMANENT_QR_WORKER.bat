@echo off
title ITHI POORAM - Deploy Permanent Cloudflare Worker
color 0B
cls

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0cloudflare-worker\deploy_worker.ps1"
