@echo off
setlocal
if "%OPENCOMPRESS_PORT%"=="" set "OPENCOMPRESS_PORT=5174"
echo [opencompress] Stopping processes on port %OPENCOMPRESS_PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$port=[int]$env:OPENCOMPRESS_PORT; $connections=Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue; $ids=$connections.OwningProcess | Sort-Object -Unique; foreach($id in $ids){ if($id -gt 0){ Write-Host ('Stopping PID ' + $id); Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } }; if(-not $ids){ Write-Host 'No OpenCompress server found on this port.' }"
echo [opencompress] Done.
pause
