@echo off
chcp 65001 >nul
title Contaduría Municipal — iniciar servidor
cd /d "%~dp0..\.."

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
echo Si no abre, pruebe en el navegador: https://127.0.0.1:3000
echo.
exit /b 0
