@echo off
title ITHI POORAM - iPhone Hotspot Permanent Connection Fix
color 0A
cls
echo ===============================================================================
echo                ITHI POORAM POS - IPHONE HOTSPOT CONNECTION FIX
echo ===============================================================================
echo.
echo [1/4] Removing stale / corrupted cached iPhone Wi-Fi profiles...
for /f "tokens=4*" %%a in ('netsh wlan show profiles ^| findstr /I "iPhone"') do (
    echo Deleting cached profile: "%%a %%b"...
    netsh wlan delete profile name="%%a %%b" >nul 2>&1
    netsh wlan delete profile name="%%a" >nul 2>&1
)
netsh wlan delete profile name="iPhone" >nul 2>&1
netsh wlan delete profile name="Muhammed's iPhone" >nul 2>&1
echo       Done. Stale Wi-Fi profiles cleared.
echo.

echo [2/4] Flushing Windows DNS and TCP/IP stack cache...
ipconfig /flushdns >nul 2>&1
echo       Done. Network cache refreshed.
echo.

echo [3/4] Scanning for nearby Wi-Fi hotspots...
ping 127.0.0.1 -n 2 >nul
echo.
echo ===============================================================================
echo             MANDATORY 2-STEP FIX ON THE IPHONE (DO THIS NOW)
echo ===============================================================================
echo.
echo   STEP 1: Turn ON "Maximize Compatibility"
echo   ----------------------------------------
echo   1. On the iPhone, open: Settings -^> Personal Hotspot
echo   2. Turn ON the switch called: "Maximize Compatibility"
echo      (Why: Newer iPhones default to 5GHz Wi-Fi 6 which causes dynamic
echo       key exchange timeouts with Intel AC-3165 Wi-Fi cards. Turning
echo       "Maximize Compatibility" ON forces standard 2.4GHz WPA2 mode.)
echo.
echo   STEP 2: Keep the Hotspot screen open while connecting
echo   -----------------------------------------------------
echo   1. Keep the "Personal Hotspot" screen OPEN on the iPhone screen.
echo   2. On this laptop, click the Wi-Fi icon on the bottom-right taskbar.
echo   3. Select the iPhone name, enter the password, and click Connect!
echo.
echo   STEP 3: Check iPhone Name (Avoid Apostrophes)
echo   --------------------------------------------
echo   If the iPhone is named "Name's iPhone", rename it in:
echo   Settings -^> General -^> About -^> Name to a clean name like "iPhone".
echo.
echo ===============================================================================
echo.
pause
