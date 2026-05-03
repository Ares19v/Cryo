@echo off
SETLOCAL EnableDelayedExpansion

echo ❄️  CRYO CONTROL CENTER - LAUNCHER ❄️
echo -------------------------------------

:: 1. Build UI
echo [1/3] Building UI assets...
cd ui
call npm install --quiet
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [!] UI Build failed.
    pause
    exit /b %ERRORLEVEL%
)
cd ..

:: 2. Build C# App
echo [2/3] Building C# backend...
dotnet build -c Debug
if %ERRORLEVEL% NEQ 0 (
    echo [!] .NET Build failed.
    pause
    exit /b %ERRORLEVEL%
)

:: 3. Launch
echo [3/3] Launching Cryo...
start "" "bin\Debug\net8.0-windows\Cryo.exe"

echo Launching successful.
pause
