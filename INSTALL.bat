@echo off
echo ❄️  CRYO - DEPENDENCY INSTALLER ❄️
echo ---------------------------------

:: Check for .NET 8
dotnet --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] .NET 8 SDK not found. Please install it from: https://dotnet.microsoft.com/download/dotnet/8.0
    pause
    exit /b 1
)
echo [+] .NET SDK detected.

:: Check for Node.js
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js not found. Please install it from: https://nodejs.org/
    pause
    exit /b 1
)
echo [+] Node.js detected.

:: Install UI dependencies
echo [*] Installing UI dependencies...
cd ui
call npm install
cd ..

echo [+] Installation complete. Use Run_Project.bat to start.
pause
