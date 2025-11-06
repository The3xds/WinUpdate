@echo off
echo Starting WinUpdate...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

REM Start the application
echo Launching application...
npm start

pause