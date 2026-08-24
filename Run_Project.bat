@echo off
setlocal EnableDelayedExpansion
title Cryo Control Center — Launcher

:: Ensure working directory is always the script's directory
cd /d "%~dp0"

echo.
echo  ================================================
echo    ❄️  CRYO CONTROL CENTER - LAUNCHER ❄️
echo  ================================================
echo.

:: ── Step 0: Unblock Files & Check Elevation ──────────────────────────────────
powershell -NoProfile -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator privileges for kernel hardware access...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -WorkingDirectory '%~dp0' -Verb RunAs"
    exit /b
)

:: Re-verify working directory in elevated session
cd /d "%~dp0"

echo [✓] Running with Administrator Privileges.
echo.

:: Close any lingering running instance so file lock on Cryo.exe is released
taskkill /F /IM Cryo.exe >nul 2>&1

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
cd /d "%~dp0"

:: ── Step 2: Build .NET Host ──────────────────────────────────────────────────
echo.
echo [2/3] Building .NET 8 WPF Host...
dotnet build -c Debug
if %errorlevel% neq 0 (
    echo [!] .NET Build failed.
    pause
    exit /b %errorlevel%
)

:: Clean & Sync UI dist and OmenMon into output folder
powershell -NoProfile -Command "Remove-Item -Recurse -Force 'bin\Debug\net8.0-windows\ui\dist' -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Force -Path 'bin\Debug\net8.0-windows\ui\dist' | Out-Null; Copy-Item -Path 'ui\dist\*' -Destination 'bin\Debug\net8.0-windows\ui\dist' -Recurse -Force" >nul 2>&1

if not exist "bin\Debug\net8.0-windows\OmenMon" mkdir "bin\Debug\net8.0-windows\OmenMon"
xcopy /E /I /Y "bin\OmenMon" "bin\Debug\net8.0-windows\OmenMon" >nul 2>&1

:: Unblock all binaries in output folder
powershell -NoProfile -Command "Get-ChildItem -Path '%~dp0bin' -Recurse | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

:: ── Step 3: Launch Native App ────────────────────────────────────────────────
echo.
echo [3/3] Launching Cryo Desktop Application...
start "" "%~dp0bin\Debug\net8.0-windows\Cryo.exe"

:: Auto-close launcher console so only the Cryo window remains
timeout /t 1 >nul 2>&1
exit /b 0
