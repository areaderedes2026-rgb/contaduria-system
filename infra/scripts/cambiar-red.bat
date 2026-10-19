@echo off
setlocal
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"
if not exist "package.json" (
  echo ERROR: No se encontro package.json.
  echo Ejecute este archivo desde la carpeta del proyecto.
  echo Carpeta actual: %CD%
  pause
  exit /b 1
)

net session >nul 2>&1
if %errorLevel% neq 0 (
  echo Se necesitan permisos de administrador para el archivo hosts.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -WorkingDirectory '%CD%' -Verb RunAs"
  exit /b
)

title Contaduria - Cambiar red
echo.
echo ============================================
echo   Cambiar red - Contaduria Municipal
echo   Solo en la PC PRINCIPAL, ya en el WiFi
echo ============================================
echo.
echo Carpeta: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: No se encontro Node.js en el PATH.
  pause
  exit /b 1
)

call npm run office:red %*
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% equ 0 (
  echo Listo. Copie infra\certs\kit-clientes a un pendrive
  echo y ejecute configurar-acceso-cliente.bat en cada PC de trabajo.
) else (
  echo Hubo un error. Revise los mensajes de arriba.
)
echo.
pause
exit /b %EXITCODE%
