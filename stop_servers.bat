@echo off
echo Beende Backend und Frontend...

REM Uvicorn / Python beenden
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im pythonw.exe >nul 2>&1
echo [OK] Python/Uvicorn beendet.

REM Node.js (Frontend) beenden
taskkill /f /im node.exe >nul 2>&1
echo [OK] Node.js/Frontend beendet.

echo.
echo Alle Server gestoppt.
pause
