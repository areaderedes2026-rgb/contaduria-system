@echo off
chcp 65001 >nul
title Contaduría — Cambiar red
cd /d "%~dp0..\.."

net session >nul 2>&1
if %errorLevel% neq 0 (
  echo Se necesitan permisos de administrador para actualizar el archivo hosts.
  echo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo ============================================
echo   Cambiar red — Contaduría Municipal
echo   Solo en la PC PRINCIPAL, ya en el WiFi nuevo
echo ============================================
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
