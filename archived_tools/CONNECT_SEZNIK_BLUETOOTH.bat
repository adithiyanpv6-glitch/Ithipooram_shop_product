@echo off
title ITHI POORAM - Connect SEZNIK Bluetooth Printer
color 0A
cls

set "TARGET_DIR=C:\Users\USR\Desktop\ITHIPOORAM\Ithipooram_shop_product-main"
if not exist "%TARGET_DIR%\scripts\connect_bluetooth.ps1" (
    set "TARGET_DIR=%~dp0"
)

cd /d "%TARGET_DIR%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TARGET_DIR%\scripts\connect_bluetooth.ps1"

pause
