@echo off
echo =====================================
echo   Cardmarket Backend + Frontend Start
echo =====================================

set BACKEND_DIR=D:\cardmarket-projekt\cardmarket-backend
set FRONTEND_DIR=D:\cardmarket-projekt\cardmarket-frontend
set PYTHON=%BACKEND_DIR%\.venv\Scripts\python.exe

REM CSV-Import (sichtbar, damit Fehler erkennbar sind)
cd /d "%BACKEND_DIR%"
call .venv\Scripts\activate

echo [1/3] Importiere CSV-Dateien...
"%PYTHON%" import_csv_runs.py
if errorlevel 1 (
    echo FEHLER: Import-Script fehlgeschlagen. Breche ab...
    pause
    exit /b 1
)

REM Frontend: versteckter Hintergrundprozess (kein Fenster)
echo [2/3] Starte Frontend im Hintergrund...
powershell -Command "Start-Process -FilePath 'cmd' -ArgumentList '/c npm run dev' -WorkingDirectory 'D:\cardmarket-projekt\cardmarket-frontend' -WindowStyle Hidden"

REM Backend: versteckter Hintergrundprozess (kein Fenster)
echo [3/3] Starte Backend im Hintergrund...
powershell -Command "Start-Process -FilePath 'D:\cardmarket-projekt\cardmarket-backend\.venv\Scripts\python.exe' -ArgumentList '-m uvicorn app.main:app --host 127.0.0.1 --port 8000' -WorkingDirectory 'D:\cardmarket-projekt\cardmarket-backend' -WindowStyle Hidden"

echo Warte auf Uvicorn...
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:8000/docs"

echo.
echo Fertig! Backend und Frontend laufen unsichtbar im Hintergrund.
echo Dieses Fenster kann jetzt geschlossen werden.
echo Zum Beenden: stop_servers.bat
echo.
pause
