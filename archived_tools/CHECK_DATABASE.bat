@echo off
title ITHI POORAM - Database Inspector
color 0B
cls

cd /d "C:\Users\USR\Desktop\ITHIPOORAM\Ithipooram_shop_product-main"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\USR\Desktop\ITHIPOORAM\Ithipooram_shop_product-main\check_database.ps1"

pause
