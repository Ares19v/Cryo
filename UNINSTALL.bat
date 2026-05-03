@echo off
echo ❄️  CRYO - CLEANUP SCRIPT ❄️
echo ---------------------------

echo [*] Removing build artifacts...
rd /s /q bin 2>nul
rd /s /q obj 2>nul
rd /s /q ui\dist 2>nul
rd /s /q ui\node_modules 2>nul

echo [+] Cleanup complete.
pause
