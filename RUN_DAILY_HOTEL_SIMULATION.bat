@echo off
title Ithi Pooram - Daily 100-Order Hotel Simulation & Integrity Audit
color 0b
cd /d "C:\Users\USR\Desktop\ITHIPOORAM\Ithipooram_shop_product-main"

echo =========================================================================
echo      ITHI POORAM - DAILY 100-ORDER HOTEL SIMULATION & STRESS TEST
echo =========================================================================
echo.
echo Running real-world restaurant environment simulation...
echo  - 1 Admin (8181) + 2 Staff Billers/Waiters (Rahul 1111, Anjali 2222)
echo  - 100 Real-world orders across 3 shifts
echo  - Physical prints capped at 20 bills (stops automatically to save paper)
echo  - In-between multi-order concurrency stress test
echo  - Live Kitchen KDS progression, Settlements & Master Excel Sync
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\simulate_hotel_day.ps1"

echo.
echo =========================================================================
echo Simulation finished. Press any key to exit.
echo =========================================================================
pause >nul
