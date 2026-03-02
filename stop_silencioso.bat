@echo off
setlocal
set "BASEDIR=%~dp0"

echo Deteniendo Orquestador (silencioso)...

REM Backend por PID
if exist "%BASEDIR%backend.pid" (
  for /f "usebackq" %%p in ("%BASEDIR%backend.pid") do (
    taskkill /PID %%p /F >nul 2>&1
  )
  del "%BASEDIR%backend.pid" >nul 2>&1
)

REM Frontend por PID
if exist "%BASEDIR%frontend.pid" (
  for /f "usebackq" %%p in ("%BASEDIR%frontend.pid") do (
    taskkill /PID %%p /F >nul 2>&1
  )
  del "%BASEDIR%frontend.pid" >nul 2>&1
)

REM Fallback por proceso/nombre de ventana (por si no hay PID)
taskkill /FI "WINDOWTITLE eq OrquestadorBBDD-Backend*" /F >nul 2>&1
taskkill /IM uvicorn.exe /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq OrquestadorBBDD-Frontend*" /F >nul 2>&1
taskkill /IM node.exe /F >nul 2>&1

echo Aplicacion detenida.
endlocal
exit /b 0
