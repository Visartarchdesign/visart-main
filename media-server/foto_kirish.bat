@echo off
rem Yandex akkauntga bir marta kirish (foto ko`prigi). Oyna ochiladi, o`zingiz kirasiz, keyin yoping.
cd /d "%~dp0"
call npm install --omit=dev --no-audit --no-fund
node fotoIshchi.js --kirish
pause
