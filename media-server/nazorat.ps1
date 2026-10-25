# Har 2 daqiqada: server va tunnel tekshiriladi, o'chgan bo'lsa o'zi yoqadi
$port = 10000
function Server-Ok { try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 "http://localhost:$port/health").StatusCode -eq 200 } catch { $false } }
function Tunnel-Ok { try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 "https://media.visartdesign.uz/health").StatusCode -eq 200 } catch { $false } }
function Restart-Server { Stop-ScheduledTask -TaskName VisartMediaServer -ErrorAction SilentlyContinue; Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -match 'baslash_fon' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Stop-Process -Name node -Force -ErrorAction SilentlyContinue; Start-Sleep 3; Start-ScheduledTask -TaskName VisartMediaServer }
function Restart-Tunnel { Stop-ScheduledTask -TaskName VisartTunnel -ErrorAction SilentlyContinue; Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -match 'tunnel_fon' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue; Start-Sleep 3; Start-ScheduledTask -TaskName VisartTunnel }
if (-not (Server-Ok)) { Restart-Server; Start-Sleep 15 }
if (-not (Get-Process cloudflared -ErrorAction SilentlyContinue) -or ((Server-Ok) -and -not (Tunnel-Ok))) { Restart-Tunnel }
