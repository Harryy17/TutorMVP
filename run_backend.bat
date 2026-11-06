@echo off
echo ===================================================
echo   Starting DeepTutor Backend (FastAPI on Port 8000)
echo ===================================================
cd /d "%~dp0backend"
if exist ".venv\Scripts\python.exe" (
    call .venv\Scripts\activate.bat
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) else (
    call start.bat
)

