@echo off
rem Qo'lda: server + tunnelni toza qayta yoqadi (administrator kerak emas, nazorat ham shuni qiladi)
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { . '%~dp0nazorat.ps1' }"
echo Tayyor. Tekshiruv: https://media.visartdesign.uz/health
pause
