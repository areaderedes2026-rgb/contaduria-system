@echo off
setlocal
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"

if "%~1"=="" (
  echo Uso: restaurar-backup.bat ruta\al\contaduria-respaldo.sql.gz
  echo.
  echo ATENCION: reemplaza TODOS los datos actuales.
  pause
  exit /b 1
)

echo.
echo Va a restaurar:
echo   %~1
echo Esto REEMPLAZA la base actual.
echo.
pause

call npm run db:restore -- "%~1"
set EXITCODE=%ERRORLEVEL%
echo.
if %EXITCODE% equ 0 (
  echo Listo. Reinicie: npx pm2 restart contaduria-api
) else (
  echo Fallo la restauracion. Docker Desktop tiene que estar abierto.
)
pause
exit /b %EXITCODE%
