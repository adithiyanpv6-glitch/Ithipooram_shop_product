@echo off
title Ithi Pooram POS - Git Push to GitHub
color 0A
echo =====================================================================
echo    ITHI POORAM POS - Push Final Handover Release to GitHub
echo =====================================================================
echo.
cd /d "c:\Users\USR\Desktop\ITHIPOORAM\Ithipooram_shop_product-main"
echo Current directory: %cd%
echo.
echo Pushing commit to origin main...
git push origin main
echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Git push completed successfully!
    echo Remote repository is up to date: https://github.com/adithiyanpv6-glitch/Ithipooram_shop_product.git
) else (
    echo [ERROR] Git push failed. If GitHub browser sign-in prompted, complete sign-in and run again.
)
echo.
pause
