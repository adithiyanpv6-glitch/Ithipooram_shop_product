@echo off
:: Self-elevate script to Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

title ITHI POORAM - Windows Firewall Configurator
color 0A
cls

echo =========================================================================
echo    ITHI POORAM - OPENING PORT 3000 IN WINDOWS DEFENDER FIREWALL
echo =========================================================================
echo.

:: Delete old rule if present
netsh advfirewall firewall delete rule name="IthiPooram POS (Port 3000)" >nul 2>&1
netsh advfirewall firewall delete rule name="NodeJS POS Server" >nul 2>&1

:: Add universal allow rules for Port 3000 and Node.js
netsh advfirewall firewall add rule name="IthiPooram POS (Port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=any
netsh advfirewall firewall add rule name="NodeJS POS Server" dir=in action=allow program="C:\Program Files\nodejs\node.exe" enable=yes profile=any

echo.
echo =========================================================================
echo  SUCCESS! Port 3000 is now OPEN for all devices on your Wi-Fi!
echo  Your phone can now access: http://192.168.31.68:3000
echo =========================================================================
echo.
pause
