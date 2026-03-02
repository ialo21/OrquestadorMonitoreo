@echo off
setlocal

REM Inicia backend y frontend ocultos, guardando PIDs y logs
set "BASEDIR=%~dp0"
set "LOGDIR=%BASEDIR%logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1

REM Backend (FastAPI)
echo Iniciando backend (oculto)...
powershell -NoProfile -Command ^
  "$p = Start-Process -FilePath 'python' -ArgumentList 'main.py' -WorkingDirectory '%BASEDIR%backend' -WindowStyle Hidden -PassThru -RedirectStandardOutput '%LOGDIR%\backend.out.log' -RedirectStandardError '%LOGDIR%\backend.err.log'; $p.Id" > "%BASEDIR%backend.pid"

REM Frontend (Vite)
echo Iniciando frontend (oculto)...
powershell -NoProfile -Command ^
  "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run dev' -WorkingDirectory '%BASEDIR%frontend' -WindowStyle Hidden -PassThru -RedirectStandardOutput '%LOGDIR%\frontend.out.log' -RedirectStandardError '%LOGDIR%\frontend.err.log'; $p.Id" > "%BASEDIR%frontend.pid"

echo Aplicacion iniciada en segundo plano. Logs en %LOGDIR%
endlocal
exit /b 0
