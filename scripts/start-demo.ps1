<#
  Starts the whole FinMind stack on this laptop, fully offline-capable:
    Qdrant (vector DB) -> Ollama (local LLM) -> Spring Boot (serves API + built UI) -> browser.

  Usage (from anywhere):
    powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1            # start
    powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1 -Rebuild   # rebuild UI + backend first
    powershell -ExecutionPolicy Bypass -File scripts\start-demo.ps1 -Ingest    # also (re)ingest knowledge docs
#>
param([switch]$Rebuild, [switch]$Ingest, [switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root 'data'
New-Item -ItemType Directory -Force $data | Out-Null

function Test-Url($url) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $url | Out-Null; return $true } catch { return $false }
}
function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

# 1. Qdrant
Step 'Vector database (Qdrant)'
if (Test-Url 'http://localhost:6333') {
    Write-Host 'already running'
} else {
    $env:QDRANT__STORAGE__STORAGE_PATH = Join-Path $data 'qdrant\storage'
    $env:QDRANT__STORAGE__SNAPSHOTS_PATH = Join-Path $data 'qdrant\snapshots'
    $env:QDRANT__TELEMETRY_DISABLED = 'true'
    Start-Process (Join-Path $root 'tools\qdrant\qdrant.exe') -WorkingDirectory $data -WindowStyle Minimized
    Write-Host 'started'
}

# 2. Ollama
Step 'Local LLM (Ollama)'
$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (Test-Url 'http://localhost:11434/api/version') {
    Write-Host 'already running'
} else {
    $env:OLLAMA_FLASH_ATTENTION = '1'
    $env:OLLAMA_KV_CACHE_TYPE = 'q8_0'
    Start-Process $ollama -ArgumentList 'serve' -WindowStyle Hidden
    for ($i = 0; $i -lt 20 -and -not (Test-Url 'http://localhost:11434/api/version'); $i++) { Start-Sleep 1 }
    Write-Host 'started'
}
$models = & $ollama list | Out-String
foreach ($m in 'qwen3.5:4b', 'bge-m3-cpu') {
    if ($models -notmatch [regex]::Escape($m)) {
        Write-Host "Missing model $m" -ForegroundColor Yellow
        if ($m -eq 'bge-m3-cpu') { Write-Host "  run: ollama pull bge-m3; ollama create bge-m3-cpu -f backend\ollama\Modelfile.embed" }
        else { Write-Host "  run: ollama pull $m" }
    }
}

# 3. Frontend build (served by Spring Boot)
$dist = Join-Path $root 'frontend\dist\index.html'
if ($Rebuild -or -not (Test-Path $dist)) {
    Step 'Building the UI'
    Push-Location (Join-Path $root 'frontend'); npm run build; Pop-Location
}

# 4. Backend
Step 'Backend (Spring Boot)'
$env:JAVA_HOME = Join-Path $root 'tools\jdk'
$backend = Join-Path $root 'backend'
$jar = Join-Path $backend 'target\backend-0.0.1-SNAPSHOT.jar'
if (Test-Url 'http://localhost:8080/api/system/status') {
    Write-Host 'already running (stop it first to pick up a rebuild)'
} else {
    if ($Rebuild -or -not (Test-Path $jar)) {
        Push-Location $backend; & .\mvnw.cmd -q -B package -DskipTests; Pop-Location
    }
    Start-Process (Join-Path $env:JAVA_HOME 'bin\java.exe') -ArgumentList '-jar', $jar -WorkingDirectory $backend `
        -RedirectStandardOutput (Join-Path $data 'backend.log') -RedirectStandardError (Join-Path $data 'backend.err.log') -WindowStyle Hidden
    Write-Host -NoNewline 'waiting'
    for ($i = 0; $i -lt 90 -and -not (Test-Url 'http://localhost:8080/api/system/status'); $i++) { Start-Sleep 1; Write-Host -NoNewline '.' }
    Write-Host ''
}

if ($Ingest) {
    Step 'Ingesting knowledge documents'
    Invoke-RestMethod -Method Post 'http://localhost:8080/api/admin/ingest' | Out-Null
    do { Start-Sleep 3; $s = Invoke-RestMethod 'http://localhost:8080/api/admin/ingest'; Write-Host "  $($s.state) $($s.current)" } while ($s.state -eq 'running')
    $s | ConvertTo-Json -Depth 3
}

# 5. Status + open
Step 'Status'
try {
    $st = Invoke-RestMethod 'http://localhost:8080/api/system/status'
    Write-Host "state: $($st.state) | model: $($st.ollama.chatModel) | vectors: $($st.qdrant.vectors) | docs: $($st.knowledge.documents) | AMFI NAV: $($st.amfi.navDate)"
} catch {
    Write-Host 'Backend did not come up - see data\backend.log' -ForegroundColor Red
    exit 1
}
if (-not $NoBrowser) { Start-Process 'http://localhost:8080' }
