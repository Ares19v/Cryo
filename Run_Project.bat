@echo off
setlocal EnableDelayedExpansion
title Cryo Control Center — Launcher

echo.
echo  ================================================
echo    ❄️  CRYO CONTROL CENTER - LAUNCHER ❄️
echo  ================================================
echo.

:: ── Step 0: Check for Administrator Elevation ────────────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator privileges for kernel hardware access...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo [✓] Running with Administrator Privileges.
echo.

:: ── Step 1: Build React UI ───────────────────────────────────────────────────
echo [1/3] Building React UI assets...
cd ui
if not exist "node_modules" (
    echo [INFO] Installing UI dependencies...
    call npm install --quiet
)
call npm run build
if %errorlevel% neq 0 (
    echo [!] UI Build failed.
    pause
    exit /b %errorlevel%
)
cd ..

:: ── Step 2: Build .NET Host ──────────────────────────────────────────────────
echo.
echo [2/3] Building .NET 8 WPF Host...
dotnet build -c Debug
if %errorlevel% neq 0 (
    echo [!] .NET Build failed.
    pause
    exit /b %errorlevel%
)

:: Sync UI dist into output folder
if not exist "bin\Debug\net8.0-windows\ui" mkdir "bin\Debug\net8.0-windows\ui"
xcopy /E /I /Y "ui\dist" "bin\Debug\net8.0-windows\ui\dist" >nul 2>&1

:: ── Step 3: Launch Native App ────────────────────────────────────────────────
echo.
echo [3/3] Launching Cryo Desktop Application...
start "" "%~dp0bin\Debug\net8.0-windows\Cryo.exe"

echo.
echo  ================================================
echo   ❄️  Cryo is running with Live Kernel Telemetry!
echo   Web Bridge: http://localhost:5050/api/telemetry
echo  ================================================
echo.
pause
