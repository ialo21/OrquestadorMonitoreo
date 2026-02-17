@echo off
echo ============================================
echo  Orquestador de Reportes BBDD
echo ============================================
echo.

:: Iniciar backend
echo [1/2] Iniciando backend (FastAPI)...
cd /d "%~dp0backend"
start "OrquestadorBBDD-Backend" cmd /c "python main.py"

:: Esperar un momento para que el backend inicie
timeout /t 3 /nobreak > nul

:: Iniciar frontend
echo [2/2] Iniciando frontend (Vite)...
cd /d "%~dp0frontend"
start "OrquestadorBBDD-Frontend" cmd /c "npm run dev"

echo.
echo ============================================
echo  Aplicacion iniciada:
echo    Backend:  http://localhost:8001
echo    Frontend: http://localhost:5174
echo ============================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause > nul
