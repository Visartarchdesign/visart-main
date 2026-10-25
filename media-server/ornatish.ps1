# Bir marta ishga tushiriladi (administrator). Media-server Windows bilan birga o'zi yonadi va o'chib qolsa qayta yoqiladi.
$ErrorActionPreference = 'Continue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat = Join-Path $dir 'baslash_fon.bat'
$port = 10000
if (Test-Path (Join-Path $dir '.env')) { $m = Select-String -Path (Join-Path $dir '.env') -Pattern '^PORT=(\d+)' | Select-Object -First 1; if ($m) { $port = [int]$m.Matches[0].Groups[1].Value } }

# 1) Server: tizimga kirganda yashirin oyna bilan ishga tushadi
$act = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$bat`"" -WorkingDirectory $dir
$trg = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn))   # kompyuter yonishi bilan (parolsiz, S4U) va kirganda
$prin = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -Hidden
Register-ScheduledTask -TaskName 'VisartMediaServer' -Action $act -Trigger $trg -Settings $set -Principal $prin -Force | Out-Null

# 2) Nazorat: har 2 daqiqada server va tunnel tekshiriladi, o'chgan bo'lsa qayta yoqiladi (nazorat.ps1)
$nz = Join-Path $dir 'nazorat.ps1'
$act2 = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$nz`""
$trg2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
Register-ScheduledTask -TaskName 'VisartMediaNazorat' -Action $act2 -Trigger $trg2 -Settings $set -Principal $prin -Force | Out-Null

# 3) Cloudflare tunnel (visart-media): tizimga kirganda yonadi, o'chsa qayta yoqiladi
$tun = Join-Path $dir 'tunnel_fon.bat'
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) { Write-Host "DIQQAT: cloudflared topilmadi (PATH'da yo'q)." }
$actT = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$tun`"" -WorkingDirectory $dir
Register-ScheduledTask -TaskName 'VisartTunnel' -Action $actT -Trigger $trg -Settings $set -Principal $prin -Force | Out-Null
Start-ScheduledTask -TaskName 'VisartTunnel'

# 4) Kompyuter uxlab qolmasin (tarmoqdan quvvatlanganda)
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

Start-ScheduledTask -TaskName 'VisartMediaServer'
Write-Host "Tayyor. Server: http://localhost:$port/health | Jurnal: $dir\server.log"
