@echo off
chcp 65001 >nul
cd /d "%~dp0"
title DELGROSSO VIAGGI 3.0 - Nicola / Raffaele
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AVVIA_GESTIONALE_WINDOWS.ps1"
exit /b %errorlevel%
