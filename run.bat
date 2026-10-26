@echo off
title Kalkulus AI
cd /d "%~dp0" 2>nul

set "OLLAMA_MODELS=%~dp0KalkulusAI\models"
set "OLLAMA_HOST=127.0.0.1:11434"

:: 1. Check if Ollama server is already running on port 11434
netstat -ano 2>nul | findstr /R /C:":11434 " >nul
if %ERRORLEVEL% NEQ 0 (
    where ollama >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Starting local Ollama engine...
        start /MIN "" ollama serve >nul 2>&1
        ping 127.0.0.1 -n 3 >nul
    )
)

:: 2. Try portable node.exe from USB drive (suppress GPO access denied error if USB execution is blocked)
if exist "%~dp0KalkulusAI\installers\win-x64\node.exe" (
    "%~dp0KalkulusAI\installers\win-x64\node.exe" KalkulusAI\bin\cli.js %* 2>nul
    if %ERRORLEVEL% EQU 0 goto :EXIT
)

:: 3. Fallback to system Node (bypasses USB execution blocks on restricted college PCs)
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node KalkulusAI\bin\cli.js %*
    goto :EXIT
)

echo.
echo ========================================================
echo ERROR: Node.js is required to run Kalkulus AI.
echo Please install Node.js from https://nodejs.org
echo ========================================================
echo.
pause
exit /b 1

:EXIT
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Session ended.
    pause
)
