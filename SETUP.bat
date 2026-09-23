@echo off
title SecAudit - Setup & Run
color 0A

echo.
echo ==========================================
echo   SecAudit DevSecOps Scanner
echo   Setting up project...
echo ==========================================
echo.

:: Check Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed!
    echo Please download and install Node.js from: https://nodejs.org
    echo Then run this script again.
    pause
    exit /b 1
)
echo [OK] Node.js found: 
node --version

:: Install Frontend dependencies
echo.
echo [1/3] Installing Frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Frontend npm install failed!
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed!

:: Install Backend dependencies
echo.
echo [2/3] Installing Backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Backend npm install failed!
    pause
    exit /b 1
)
cd ..
echo [OK] Backend dependencies installed!

:: Done
echo.
echo ==========================================
echo   Setup COMPLETE! 
echo ==========================================
echo.
echo [3/3] Starting both servers...
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo.
echo Press Ctrl+C to stop the servers.
echo.

:: Start backend in new window
start "SecAudit Backend" cmd /k "cd backend && node server.js"

:: Wait 3 seconds for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend in this window
call npm run dev
