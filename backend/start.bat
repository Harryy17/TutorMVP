@echo off
setlocal enabledelayedexpansion
echo.
echo ================================================
echo   DeepTutor Backend - Study Room Engine
echo ================================================
echo.

REM Detect Python executable
set "PYTHON_CMD="
python --version >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python"
) else (
    py -0 >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON_CMD=py"
    ) else if exist "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    )
)

if "%PYTHON_CMD%"=="" (
    echo [ERROR] Python not found. Please install Python 3.10+ from https://python.org
    pause & exit /b 1
)

echo [1/3] Using Python: %PYTHON_CMD%

REM Create virtualenv if needed
if not exist ".venv\Scripts\activate.bat" (
    echo [2/3] Creating virtual environment (.venv)...
    "%PYTHON_CMD%" -m venv .venv
)

REM Activate virtualenv
call .venv\Scripts\activate.bat

REM Install deps
echo [3/3] Checking dependencies...
python -m pip install -r requirements.txt -q

REM Check .env exists
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [INFO] Created .env file from .env.example.
    )
)

echo.
echo Starting FastAPI server at http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
