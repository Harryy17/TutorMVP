@echo off
echo ====================================================
echo   Launching DeepTutor Study Room (Backend + Frontend)
echo ====================================================
echo.
echo 1. Starting Backend in a new window...
start "DeepTutor Backend" cmd /k "%~dp0run_backend.bat"

echo 2. Starting Frontend in a new window...
start "DeepTutor Frontend" cmd /k "%~dp0run_frontend.bat"

echo.
echo Done! Both services are launching:
echo - Backend API:  http://localhost:8000
echo - Swagger Docs: http://localhost:8000/docs
echo - Frontend UI:  http://localhost:5173
echo.

