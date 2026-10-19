@echo off
setlocal
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"
if not exist "package.json" (
  echo ERROR: No se encontro package.json.
  echo Carpeta actual: %CD%
  pause
  exit /b 1
)

title Contaduria - Iniciar servidor
echo Iniciando PostgreSQL (Docker)...
call npm run db:up

echo Esperando a la base...
timeout /t 8 /nobreak >nul

where pm2 >nul 2>&1
if errorlevel 1 (
  echo PM2 no esta en el PATH. Use: npx pm2 resurrect
  npx pm2 resurrect
) else (
  pm2 resurrect
)

echo.
echo Si no abre, pruebe en el navegador: https://contaduria.local:3000
echo.
exit /b 0
