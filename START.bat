@echo off
title SecAudit - Starting...
color 0A

echo.
echo ==========================================
echo   SecAudit DevSecOps Scanner
echo   Starting servers...
echo ==========================================
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo.
echo Tip: If you get module errors, run SETUP.bat first!
echo.

:: Start backend in new window
start "SecAudit Backend" cmd /k "cd backend && node server.js"

:: Wait 3 seconds
timeout /t 3 /nobreak >nul

:: Start frontend
call npm run dev
