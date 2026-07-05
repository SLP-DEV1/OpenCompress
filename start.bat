@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

title OpenCompress Studio

if "%OPENCOMPRESS_PORT%"=="" set "OPENCOMPRESS_PORT=5174"

echo [opencompress] Starting OpenCompress Studio on http://127.0.0.1:%OPENCOMPRESS_PORT%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [opencompress] Node.js was not found.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo [opencompress] Please install Node.js 20 LTS or newer from https://nodejs.org/
    pause
    exit /b 1
  )
  echo [opencompress] Installing Node.js LTS with winget...
  winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo [opencompress] Node.js installation failed. Please install Node.js manually.
    pause
    exit /b 1
  )
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [opencompress] npm was not found. Please restart this terminal after installing Node.js.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [opencompress] Installing dependencies. This can take a few minutes...
  call npm install
  if errorlevel 1 (
    echo [opencompress] npm install failed.
    pause
    exit /b 1
  )
)

echo [opencompress] Opening browser...
start "" "http://127.0.0.1:%OPENCOMPRESS_PORT%"

echo [opencompress] Keep this window open while using the app.
echo [opencompress] Close this window or run stop.bat to stop the server.
echo.

call npm start

echo.
echo [opencompress] Server stopped.
pause
