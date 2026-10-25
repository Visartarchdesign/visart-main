@echo off
rem Fonda ishlaydi, o'zi qayta ishga tushadi, jurnal: server.log
cd /d "%~dp0"
:loop
for /f "usebackq tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
echo [%date% %time%] server ishga tushdi >> server.log
node --max-old-space-size=3000 index.js >> server.log 2>&1
echo [%date% %time%] server to'xtadi, 5 s dan keyin qayta >> server.log
timeout /t 5 /nobreak >nul
goto loop
