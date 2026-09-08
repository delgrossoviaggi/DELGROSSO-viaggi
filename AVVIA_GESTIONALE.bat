@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo ERRORE: Node.js non trovato.
  echo Installa Node.js LTS e riprova.
  pause
  exit /b 1
)
echo Avvio DELGROSSO Sito + Gestionale...
node server.mjs
pause
