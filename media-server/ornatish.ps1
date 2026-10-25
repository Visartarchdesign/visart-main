# Bir marta ishga tushiriladi (administrator). Media-server Windows bilan birga o'zi yonadi va o'chib qolsa qayta yoqiladi.
$ErrorActionPreference = 'Continue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat = Join-Path $dir 'baslash_fon.bat'
$port = 10000
if (Test-Path (Join-Path $dir '.env')) { $m = Select-String -Path (Join-Path $dir '.env') -Pattern '^PORT=(\d+)' | Select-Object -First 1; if ($m) { $port = [int]$m.Matches[0].Groups[1].Value } }

# 1) Server: tizimga kirganda yashirin oyna bilan ishga tushadi
$act = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$bat`"" -WorkingDirectory $dir
$trg = New-ScheduledTaskTrigger -AtLogOn
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -Hidden
Register-ScheduledTask -TaskName 'VisartMediaServer' -Action $act -Trigger $trg -Settings $set -RunLevel Highest -Force | Out-Null

# 2) Nazorat: har 5 daqiqada /health tekshiradi, javob bermasa serverni qayta yoqadi
$chk = "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 http://localhost:$port/health).StatusCode | Out-Null } catch { Stop-Process -Name node -Force -ErrorAction SilentlyContinue; Start-Sleep 3; Start-ScheduledTask -TaskName VisartMediaServer }"
$act2 = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -Command `"$chk`""
$trg2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'VisartMediaNazorat' -Action $act2 -Trigger $trg2 -Settings $set -RunLevel Highest -Force | Out-Null

# 3) Cloudflare tunnel: xizmat bo'lsa avtomatik yoqish va qayta yoqish
$svc = Get-Service -Name 'cloudflared' -ErrorAction SilentlyContinue
if ($svc) { Set-Service -Name 'cloudflared' -StartupType Automatic; if ($svc.Status -ne 'Running') { Start-Service 'cloudflared' }; sc.exe failure cloudflared reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null; Write-Host 'cloudflared xizmati: avtomatik' }
else { Write-Host "DIQQAT: 'cloudflared' xizmati topilmadi. Tunnel qanday yoqiladi? (cloudflared service install ...) -- menga yozing." }

# 4) Kompyuter uxlab qolmasin (tarmoqdan quvvatlanganda)
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

Start-ScheduledTask -TaskName 'VisartMediaServer'
Write-Host "Tayyor. Server: http://localhost:$port/health | Jurnal: $dir\server.log"
