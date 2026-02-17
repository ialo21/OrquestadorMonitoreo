@echo off
echo Deteniendo Orquestador de Reportes BBDD...

:: Matar procesos de uvicorn (backend)
taskkill /FI "WINDOWTITLE eq OrquestadorBBDD-Backend*" /F > nul 2>&1
taskkill /IM uvicorn.exe /F > nul 2>&1

:: Matar procesos de node (frontend)
taskkill /FI "WINDOWTITLE eq OrquestadorBBDD-Frontend*" /F > nul 2>&1

echo Aplicacion detenida.
pause
