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
    echo [opencompress] Please install a supported Node.js LTS release from https://nodejs.org/
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
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

where node >nul 2>nul
if errorlevel 1 (
  echo [opencompress] Node.js was installed but is not available in this terminal yet.
  echo [opencompress] Close this window and run start.bat again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [opencompress] npm was not found. Reinstall Node.js LTS and try again.
  pause
  exit /b 1
)

node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit((M===20&&m>=19)||M>=22?0:1)"
if errorlevel 1 (
  echo [opencompress] Your Node.js version is too old or unsupported.
  echo [opencompress] OpenCompress requires Node.js 20.19+ or Node.js 22.12+.
  node --version
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [opencompress] Installing dependencies...
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo [opencompress] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo [opencompress] Building the app...
call npm run build
if errorlevel 1 (
  echo [opencompress] Build failed. Try deleting node_modules and run start.bat again.
  pause
  exit /b 1
)

if "%OPENCOMPRESS_PUBLIC_REFERER%"=="" set "OPENCOMPRESS_PUBLIC_REFERER=https://github.com/SLP-DEV1/OpenCompress"

echo [opencompress] Opening browser...
start "" "http://127.0.0.1:%OPENCOMPRESS_PORT%"

echo [opencompress] Keep this window open while using the app.
echo [opencompress] Close this window or run stop.bat to stop the server.
echo.

call npm start

echo.
echo [opencompress] Server stopped.
pause
