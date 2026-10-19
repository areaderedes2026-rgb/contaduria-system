@echo off
setlocal
cd /d "%~dp0"

set "PS1=%~dp0configurar-acceso-cliente.ps1"
if not exist "%PS1%" (
  echo No se encontro configurar-acceso-cliente.ps1
  echo Copie todo el contenido de kit-clientes, no solo el .bat
  pause
  exit /b 1
)

if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Ip "%~1"
)
exit /b %ERRORLEVEL%
