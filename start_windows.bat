@echo off
cd /d "%~dp0"
echo Starting Einbuergerungstest Trainer...
start http://localhost:8000
python -m http.server 8000
if %ERRORLEVEL% NEQ 0 (
    echo Python was not found. Opening index.html directly...
    start index.html
)
pause
