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

title Contaduria - Actualizar
echo.
echo ============================================
echo   Actualizar Contaduria Municipal
echo   Solo en la PC PRINCIPAL (servidor)
echo ============================================
echo.
echo Carpeta: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encontro Node.js en el PATH.
  echo Instale Node.js 20+ y vuelva a intentar.
  echo.
  pause
  exit /b 1
)

call npm run deploy
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% equ 0 (
  echo Listo. Las demas PCs veran el cartel de nueva version.
) else (
  echo Hubo un error. La version anterior deberia seguir funcionando.
  echo Revise los mensajes de arriba.
)
echo.
pause
exit /b %EXITCODE%
