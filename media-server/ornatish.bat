@echo off
rem Administrator huquqi bilan o'zini qayta ochadi va ornatish.ps1 ni ishga tushiradi
net session >nul 2>&1 || (powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'" & exit /b)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ornatish.ps1"
pause
