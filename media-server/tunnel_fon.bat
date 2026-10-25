@echo off
rem Cloudflare tunnel (visart-media -> media.visartdesign.uz), o'zi qayta yonadi. Jurnal: tunnel.log
cd /d "%~dp0"
:loop
echo [%date% %time%] tunnel ishga tushdi >> tunnel.log
cloudflared tunnel run --url http://localhost:10000 visart-media >> tunnel.log 2>&1
echo [%date% %time%] tunnel to'xtadi, 5 s dan keyin qayta >> tunnel.log
timeout /t 5 /nobreak >nul
goto loop
