@echo off
title AQUABATTLE
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Nenasel jsem Node.js. Stahni ho z https://nodejs.org a spust tenhle
  echo   soubor znovu.
  echo.
  pause
  exit /b 1
)

start "" http://localhost:8099
node server.js
pause
