@echo off
title Reconnecting B-41 Thermal Printer...
cls
echo =========================================================
echo   ITHI POORAM - B-41 THERMAL PRINTER AUTO-RECONNECTOR
echo =========================================================
echo.
echo Checking Bluetooth and COM ports...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0reconnect_printer.ps1"
exit
