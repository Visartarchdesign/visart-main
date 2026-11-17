# Visart Instagram karusel avtomatikasi -- PC'ga o'rnatish (bir marta).
# Joylashuv: C:\Users\Visart\Documents\Visart_AI_Studio\kontent\karusel\avto\  (shu papka nusxasi)
# Ishga tushirish: powershell -ExecutionPolicy Bypass -File ornatish_karusel.ps1
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $d
if (-not (Test-Path "$d\venv")) { python -m venv venv }
& "$d\venv\Scripts\python.exe" -m pip install --quiet playwright pillow requests
& "$d\venv\Scripts\python.exe" -m playwright install chromium
$py = "$d\venv\Scripts\pythonw.exe"
function Reg($name, $rejim, $day) {
  $a = New-ScheduledTaskAction -Execute $py -Argument "`"$d\karusel_avto.py`" --rejim $rejim" -WorkingDirectory $d
  $t = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $day -At 10:00
  $s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $name -Action $a -Trigger $t -Settings $s -Description "Visart Instagram karusel avtomatik ($rejim)" -Force | Out-Null
}
Reg "Visart_Karusel_Loyiha" "loyiha" "Monday"      # chorshanba 19:30 karuseli (2 kun oldin tayyorlanadi)
# "Arxitektor maslahati" rejimi o'chirilgan (Visart_Karusel_Maslahat vazifasi ro'yxatdan o'tkazilmaydi)
