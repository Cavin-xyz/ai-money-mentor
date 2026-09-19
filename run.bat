@echo off
rem ---------------------------------------------------------------------------
rem  FinMind - start backend + frontend for development
rem
rem    run.bat            start Qdrant, Ollama, backend (:8080) and frontend (:5174)
rem    run.bat stop       stop backend and frontend
rem    run.bat stop all   also stop Qdrant and Ollama
rem    run.bat nobrowser  start without opening the browser
rem
rem  Backend and frontend each open in their own window; close a window to stop it.
rem ---------------------------------------------------------------------------
setlocal EnableExtensions
set "ROOT=%~dp0"
set "DATA=%ROOT%data"
set "OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
set "JAVA_HOME=%ROOT%tools\jdk"

rem Settings inherited by the processes started below
set "QDRANT__STORAGE__STORAGE_PATH=%DATA%\qdrant\storage"
set "QDRANT__STORAGE__SNAPSHOTS_PATH=%DATA%\qdrant\snapshots"
set "QDRANT__TELEMETRY_DISABLED=true"
set "OLLAMA_FLASH_ATTENTION=1"
set "OLLAMA_KV_CACHE_TYPE=q8_0"

if /i "%~1"=="stop" goto stop

echo.
echo   FinMind - starting everything on this laptop
echo   -------------------------------------------------
if not exist "%DATA%" mkdir "%DATA%"

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo   [!] JDK not found in tools\jdk - see README.md
  goto fail
)
where npm >nul 2>&1
if errorlevel 1 (
  echo   [!] Node.js / npm not found - install Node 20 or newer
  goto fail
)

rem 1. Vector database
curl -s -o nul -m 2 http://localhost:6333
if errorlevel 1 (
  echo   [..] Starting Qdrant
  start "Qdrant" /min /d "%DATA%" "%ROOT%tools\qdrant\qdrant.exe"
) else (
  echo   [ok] Qdrant already running
)

rem 2. Local LLM
if not exist "%OLLAMA%" (
  echo   [!] Ollama is not installed - explanations will fall back to templates
) else (
  curl -s -o nul -m 2 http://localhost:11434/api/version
  if errorlevel 1 (
    echo   [..] Starting Ollama
    start "Ollama" /min "%OLLAMA%" serve
  ) else (
    echo   [ok] Ollama already running
  )
)

rem 3. Backend
curl -s -o nul -m 2 http://localhost:8080/api/system/status
if errorlevel 1 (
  echo   [..] Starting backend in a new window
  start "Money Mentor - backend" cmd /k "cd /d "%ROOT%backend" && mvnw.cmd spring-boot:run"
) else (
  echo   [ok] Backend already running on :8080
)

rem 4. Frontend
curl -s -o nul -m 2 http://localhost:5174
if errorlevel 1 (
  echo   [..] Starting frontend in a new window
  start "Money Mentor - frontend" cmd /k "cd /d "%ROOT%frontend" & (if not exist node_modules call npm install) & npm run dev"
) else (
  echo   [ok] Frontend already running on :5174
)

rem 5. Wait until both answer, then open the browser
echo   [..] Waiting for the backend (first start can take a minute)
set /a tries=0
:waitbackend
curl -s -o nul -m 2 http://localhost:8080/api/system/status && goto waitfrontend
set /a tries+=1
if %tries% geq 120 (
  echo   [!] Backend is taking long - check the "Money Mentor - backend" window
  goto waitfrontend
)
timeout /t 2 /nobreak >nul
goto waitbackend

:waitfrontend
set /a tries=0
:waitfrontendloop
curl -s -o nul -m 2 http://localhost:5174 && goto ready
set /a tries+=1
if %tries% geq 60 (
  echo   [!] Frontend is taking long - check the "Money Mentor - frontend" window
  goto end
)
timeout /t 2 /nobreak >nul
goto waitfrontendloop

:ready
echo.
echo   Ready:  http://localhost:5174   (API on http://localhost:8080)
echo   Stop with:  run.bat stop
if /i not "%~1"=="nobrowser" start "" http://localhost:5174
goto end

:stop
echo   Stopping backend and frontend...
taskkill /fi "WINDOWTITLE eq Money Mentor - backend*" /t /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq Money Mentor - frontend*" /t /f >nul 2>&1
powershell -NoProfile -Command "foreach ($p in 8080, 5174) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
if /i "%~2"=="all" (
  echo   Stopping Qdrant and Ollama...
  taskkill /im qdrant.exe /f >nul 2>&1
  taskkill /im "ollama app.exe" /f >nul 2>&1
  taskkill /im ollama.exe /f >nul 2>&1
)
echo   Done.
goto end

:fail
echo.
pause
exit /b 1

:end
endlocal
