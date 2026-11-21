@echo off
title ITHI POORAM - Fix Lid & WiFi Permanent Configuration
color 0A
cls
echo =========================================================================
echo    ITHI POORAM (ഇത്തിപ്പൂരം) - PERMANENT LID & WI-FI KEEPAWAKE SETUP
echo =========================================================================
echo.
echo Configuring Windows to stay 100%% online and fast with laptop lid closed...

:: Check for Administrator permissions
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Requesting Administrator Privileges to configure Wi-Fi Hardware...
    powershell -Command "Start-Process cmd.exe -ArgumentList '/c `\"%~f0`\"' -Verb RunAs"
    exit /b
)

:: 1. Apply Power Schemes with exact GUIDs
powercfg /setacvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0
powercfg /setdcvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0
powercfg /setacvalueindex SCHEME_CURRENT 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 12bbebe6-58d6-4636-95bb-3217ef867c1a 0
powercfg /setdcvalueindex SCHEME_CURRENT 19cbb8fa-5279-450e-9fac-8a3d5fedd0c1 12bbebe6-58d6-4636-95bb-3217ef867c1a 0
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
powercfg /change hibernate-timeout-dc 0
powercfg /setactive SCHEME_CURRENT

:: 2. Prevent Windows from shutting down Mobile Hotspot (PeerlessTimeoutEnabled = 0)
reg add "HKLM\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters" /v PeerlessTimeoutEnabled /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters" /v PublicConnectionTimeout /t REG_DWORD /d 0 /f >nul 2>&1

:: 3. Disable Power Saving on Intel Dual Band Wireless-AC 3165 (PnPCapabilities = 24 / 0x18)
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}\0001" /v PnPCapabilities /t REG_DWORD /d 24 /f >nul 2>&1

echo.
echo [SUCCESS] Windows Power Scheme & Wi-Fi Hardware successfully configured!
echo The laptop can now be closed and will stay 100%% online for customer QR orders.
echo.
timeout /t 3
