@echo off
:: Self-elevate script to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

title ITHI POORAM - POS Hardware & Network Optimizer
color 0A
cls

echo =========================================================================
echo    ITHI POORAM - OPTIMIZING FIREWALL & MOBILE HOTSPOT SETTINGS
echo =========================================================================
echo.

:: 1. Add universal allow rules for Port 3000 and Node.js
netsh advfirewall firewall delete rule name="IthiPooram POS (Port 3000)" >nul 2>&1
netsh advfirewall firewall delete rule name="NodeJS POS Server" >nul 2>&1
netsh advfirewall firewall add rule name="IthiPooram POS (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any
netsh advfirewall firewall add rule name="NodeJS POS Server" dir=in action=allow program="C:\Program Files\nodejs\node.exe" enable=yes profile=any

:: 2. Prevent Windows from ever turning off the Mobile Hotspot automatically
reg add "HKLM\SYSTEM\CurrentControlSet\Services\icssvc\Settings" /v PeerlessTimeoutEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\icssvc\Settings" /v PublicConnectionTimeout /t REG_DWORD /d 60 /f >nul 2>&1

echo.
echo =========================================================================
echo  SUCCESS!
echo  1. Port 3000 is open in Windows Firewall.
echo  2. Mobile Hotspot auto-turn-off timeout is DISABLED.
echo  Hotspot will stay ON 24/7 without shutting down.
echo =========================================================================
echo.
pause
