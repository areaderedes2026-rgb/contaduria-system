@echo off
chcp 65001 >nul
title Actualizar Contaduría Municipal
cd /d "%~dp0..\.."

echo.
echo ============================================
echo   Actualizar Contaduría Municipal
echo   Solo en la PC PRINCIPAL (servidor)
echo ============================================
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
