@echo off
title Install Ollama for Windows (Offline)
cd /d "%~dp0"

echo ========================================================
echo Installing Ollama for Windows (Offline Mode)...
echo ========================================================
echo.

:: 1. Check for offline installer on pendrive
if exist "%~dp0KalkulusAI\installers\OllamaSetup.exe" (
    echo Launching offline installer from pendrive...
    start /wait "" "%~dp0KalkulusAI\installers\OllamaSetup.exe"
    goto :DONE
)

:: 2. Fallback to winget
where winget >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Attempting installation via Windows Package Manager (winget)...
    winget install Ollama.Ollama
    if %ERRORLEVEL% EQU 0 goto :DONE
)

:: 3. Online download fallback if pendrive installer missing
echo Downloading OllamaSetup.exe installer...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile 'OllamaSetup.exe'"

if exist "OllamaSetup.exe" (
    echo Launching installer...
    start /wait OllamaSetup.exe
    del /f /q OllamaSetup.exe
) else (
    echo Please visit https://ollama.com to download manually.
)

:DONE
echo.
echo Ollama installation complete!
pause
