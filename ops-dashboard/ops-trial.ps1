<#
.SYNOPSIS
  智享全链运营 · 试运营一键启动器（Windows PowerShell）。
  确保本地基建（MariaDB/Redis）+ 后端(3100) + 看板(8080) 就绪，然后跑全链路冒烟。

.PARAMETER Tenant
  试运营租户，缺省 't_dev'。

.EXAMPLE
  .\ops-trial.ps1                 # 启动全栈 + 默认租户冒烟
  .\ops-trial.ps1 -Tenant 1       # 指定租户
#>
param(
  [string]$Tenant = 't_dev',
  [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot
$BACKEND = Join-Path $ROOT '..\zhixiang-ops-backend'
$MARIADB = Join-Path $ROOT '..\tools\mariadb\mariadb-11.4.5-winx64'
$REDIS = 'C:\Program Files\Redis\redis-server.exe'

function Test-Port($port) {
  $t = New-Object Net.Sockets.TcpClient
  try { $t.Connect('127.0.0.1', $port); return $t.Connected } catch { return $false } finally { $t.Dispose() }
}
function Wait-Health {
  param($uri, $timeoutSec = 40)
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try { if ((Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { return $true } } catch {}
    Start-Sleep -Seconds 1
  }
  return $false
}

# —— 1. 基建：MariaDB / Redis ——
if (-not (Test-Port 3306)) {
  Write-Host '▶ 启动 MariaDB (3306)…'
  Start-Process -FilePath (Join-Path $MARIADB 'bin\mysqld.exe') -ArgumentList "--datadir=$(Join-Path (Split-Path $MARIADB) 'data')","--port=3306","--bind-address=127.0.0.1","--skip-ssl" -WindowStyle Hidden
  Wait-Health 'http://127.0.0.1:3306' -timeoutSec 1 | Out-Null
  Start-Sleep -Seconds 3
}
if (-not (Test-Port 6379)) {
  Write-Host '▶ 启动 Redis (6379)…'
  Start-Process -FilePath $REDIS -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

# —— 2. 后端 (3100) ——
if (-not (Test-Port 3100)) {
  Write-Host '▶ 后端未运行，编译并启动…'
  if (-not $NoBuild) {
    Push-Location $BACKEND
    npx tsc --noEmit | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host '❌ tsc 失败，停止'; Pop-Location; exit 1 }
    npm run build | Out-Null
    Pop-Location
  }
  $pidFile = Join-Path $ROOT 'smoke.pid'
  Start-Process -FilePath 'node' -ArgumentList (Join-Path $BACKEND 'dist\src\main.js') -WorkingDirectory $BACKEND -WindowStyle Hidden -PassThru | ForEach-Object { $_.Id | Out-File -FilePath $pidFile -Encoding ascii }
  if (-not (Wait-Health 'http://127.0.0.1:3100/api/ops/health')) { Write-Host '❌ 后端口健康超时'; exit 1 }
  Write-Host '✅ 后端已启动 (3100)'
} else {
  Write-Host '✅ 后端已在运行 (3100)'
}

# —— 3. 看板 (8080) ——
if (-not (Test-Port 8080)) {
  Write-Host '▶ 启动看板 (8080)…'
  Start-Process -FilePath 'node' -ArgumentList (Join-Path $ROOT 'serve.js') -WorkingDirectory $ROOT -WindowStyle Hidden
  Start-Sleep -Seconds 2
} else {
  Write-Host '✅ 看板已在运行 (8080)'
}

# —— 4. 全链路冒烟 ——
Write-Host "`n▶ 运行试运营冒烟（租户 $Tenant）…"
Push-Location $ROOT
node trial-smoke.js $Tenant
$rc = $LASTEXITCODE
Pop-Location
Write-Host "`n看板预览： http://localhost:8080  （租户输入框填入 $Tenant）"
exit $rc
