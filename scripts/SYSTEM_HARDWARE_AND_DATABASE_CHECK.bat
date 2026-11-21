@echo off
title ITHI POORAM (ഇത്തിപ്പൂരം) - System Hardware & Database Status Check
color 0A
cls

cd /d "C:\Users\USR\Desktop\ITHIPOORAM\Ithipooram_shop_product-main"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\USR\Desktop\ITHIPOORAM\Ithipooram_shop_product-main\scripts\check_hardware_and_database.ps1"

pause
