<#
.SYNOPSIS
  智享全链运营系统 · 正式一键启动器（生产模式）。
  探测端口 → 解压 MariaDB(首次) → 起 MariaDB/Redis → 跑数据库迁移 →
  起后端(production) → 起统一门户(8080) → 启动自检。

.PARAMETER Tenant
  冒烟租户，缺省 't_demo'。
.PARAMETER Rollback
  回滚：停止本脚本启动的全部进程，清理 logs/ 与 pid 文件（保留数据目录）。

.EXAMPLE
  .\start.ps1                 # 生产模式一键启动
  .\start.ps1 -Rollback       # 停止全部并清理运行态
#>
param(
  [string]$Tenant = 't_demo',
  [switch]$Rollback
)

$ErrorActionPreference = 'Stop'
$ROOT      = $PSScriptRoot
$BACKEND   = Join-Path $ROOT 'backend'
$FRONTEND  = Join-Path $ROOT 'frontend'
$MARIADB_ZIP = (Join-Path (Join-Path $ROOT 'tools') 'mariadb.zip')
$MARIADB_DIR = (Join-Path (Join-Path $ROOT 'tools') 'mariadb')
$MARIADB_BIN = (Join-Path (Join-Path (Join-Path $MARIADB_DIR 'mariadb-11.4.5-winx64') 'bin') 'mysqld.exe')
$MARIADB_DATA= (Join-Path $MARIADB_DIR 'data')
$REDIS     = (Join-Path (Join-Path $ROOT 'tools') 'redis-server.exe')
$LOGDIR    = Join-Path $ROOT 'logs'

# —— 端口 ——
$PORTS = @{ MariaDB = 3306; Redis = 6379; Backend = 3100; Portal = 8080 }

function Log($msg) {
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "$ts $msg"
  if (-not (Test-Path $LOGDIR)) { New-Item -ItemType Directory -Path $LOGDIR -Force | Out-Null }
  $line | Tee-Object -FilePath (Join-Path $LOGDIR 'start.log') -Append
}
function Test-Port($port) {
  $t = New-Object Net.Sockets.TcpClient
  try { $t.Connect('127.0.0.1', $port); return $t.Connected } catch { return $false } finally { $t.Dispose() }
}
function Wait-Http($uri, $timeoutSec = 60) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try { if ((Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { return $true } } catch {}
    Start-Sleep -Seconds 1
  }
  return $false
}
function Save-Pid($name, $processId) {
  $processId | Out-File -FilePath (Join-Path $LOGDIR "$name.pid") -Encoding ascii
}
function Stop-ByPid($name) {
  $pf = Join-Path $LOGDIR "$name.pid"
  if (Test-Path $pf) {
    $id = (Get-Content $pf -Raw).Trim()
    if ($id -match '^\d+$') {
      try { Stop-Process -Id ([int]$id) -Force -ErrorAction SilentlyContinue } catch {}
      Log "已停止 $name (pid=$id)"
    }
    Remove-Item $pf -Force
  }
}

# ============ 回滚模式 ============
if ($Rollback) {
  Log '▶ 执行回滚：停止本脚本启动的进程…'
  Stop-ByPid 'portal'; Stop-ByPid 'backend'; Stop-ByPid 'redis'; Stop-ByPid 'mariadb'
  Get-ChildItem $LOGDIR -Filter '*.pid' -ErrorAction SilentlyContinue | Remove-Item -Force
  Log '✅ 回滚完成（数据目录已保留）。'
  exit 0
}

# ============ 前置检查 ============
Log '▶ 前置检查：端口占用探测…'
foreach ($kv in $PORTS.GetEnumerator()) {
  if (Test-Port $kv.Value) {
    Log "❌ 端口 $($kv.Value) ($($kv.Key)) 已被占用，请先释放或停止冲突进程后再启动。"
    exit 1
  }
}
if (-not (Test-Path (Join-Path (Join-Path (Join-Path $BACKEND 'dist') 'src') 'main.js'))) {
  Log '❌ 未找到后端产物 backend/dist/src/main.js，请先运行 build-release.ps1 打包。'
  exit 1
}
if (-not (Test-Path (Join-Path $FRONTEND 'index.html'))) {
  Log '❌ 未找到前端产物 frontend/index.html，请先运行 build-release.ps1 打包。'
  exit 1
}

# ============ 1. MariaDB（首次解压）============
if (-not (Test-Path $MARIADB_DATA)) {
  if (-not (Test-Path $MARIADB_ZIP)) {
    Log '❌ 未找到 tools/mariadb.zip，无法解压 MariaDB。'
    exit 1
  }
  Log '▶ 首次运行：解压 MariaDB（约 87MB）…'
  Expand-Archive -Path $MARIADB_ZIP -DestinationPath (Join-Path $ROOT 'tools') -Force
}
Log '▶ 启动 MariaDB (3306)…'
Start-Process -FilePath $MARIADB_BIN -ArgumentList "--datadir=$MARIADB_DATA","--port=3306","--bind-address=127.0.0.1","--skip-ssl" -WindowStyle Hidden -PassThru | ForEach-Object { Save-Pid 'mariadb' $_.Id }
if (-not (Wait-Http 'http://127.0.0.1:3306' -timeoutSec 1)) { Start-Sleep -Seconds 4 }

# ============ 2. Redis ============
if (-not (Test-Path $REDIS)) {
  Log '❌ 未找到 tools/redis-server.exe。'
  exit 1
}
Log '▶ 启动 Redis (6379)…'
Start-Process -FilePath $REDIS -WindowStyle Hidden -PassThru | ForEach-Object { Save-Pid 'redis' $_.Id }
Start-Sleep -Seconds 2

# ============ 3. 数据库迁移（幂等）============
Log '▶ 执行数据库迁移（建表，已存在则跳过）…'
Push-Location $BACKEND
$migJs = Join-Path (Join-Path (Join-Path $BACKEND 'dist') 'db') 'migrate.js'
# 用 cmd /c 合并 node 的 stderr 到 stdout，避免 $ErrorActionPreference='Stop' 下
# migrate.js 的“表已存在跳过”类提示被当作终止错误导致启动中断。
$migOut = & cmd.exe /d /c "node `"$migJs`" 2>&1"
$migOut | ForEach-Object { Log "[migrate] $_" }
Pop-Location
Log '✅ 迁移完成'

# ============ 4. 后端（production）============
$env:NODE_ENV = 'production'
Log '▶ 启动后端 (3100, NODE_ENV=production)…'
Start-Process -FilePath 'node' -ArgumentList (Join-Path (Join-Path (Join-Path $BACKEND 'dist') 'src') 'main.js') -WorkingDirectory $BACKEND -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LOGDIR 'backend.log') -RedirectStandardError (Join-Path $LOGDIR 'backend.err.log') -PassThru | ForEach-Object { Save-Pid 'backend' $_.Id }
if (-not (Wait-Http 'http://127.0.0.1:3100/api/ops/health' -timeoutSec 60)) {
  Log '❌ 后端健康检查超时，详见 logs/backend.err.log'
  exit 1
}
Log '✅ 后端已就绪 (3100)'

# ============ 5. 统一门户（8080）============
$env:OPS_APP_DIR = $FRONTEND
Log '▶ 启动统一门户 (8080)…'
Start-Process -FilePath 'node' -ArgumentList (Join-Path $ROOT 'serve.js') -WorkingDirectory $ROOT -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LOGDIR 'portal.log') -RedirectStandardError (Join-Path $LOGDIR 'portal.err.log') -PassThru | ForEach-Object { Save-Pid 'portal' $_.Id }
if (-not (Wait-Http 'http://127.0.0.1:8080' -timeoutSec 30)) {
  Log '❌ 门户启动超时，详见 logs/portal.err.log'
  exit 1
}
Log '✅ 门户已就绪 (8080)'

# ============ 6. 启动自检 ============
Log '▶ 启动自检（健康 + 关键接口）…'
$okHealth = Wait-Http 'http://127.0.0.1:8080/api/ops/health' -timeoutSec 5
$okAuth   = (Invoke-WebRequest -Uri 'http://127.0.0.1:8080/api/ops/system/status' -Headers @{'x-tenant-id'=$Tenant} -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200
if ($okHealth -and $okAuth) { Log '✅ 自检通过：health + auth/status 均 200' }
else { Log "⚠ 自检部分未通过（health=$okHealth, auth=$okAuth）" }

Log ''
Log '=========================================='
Log '智享全链运营系统已启动（生产模式）'
Log "门户/看板:  http://localhost:8080   (租户输入框填 $Tenant)"
Log '运营前端:   http://localhost:8080/ops-app'
Log '看板:       http://localhost:8080/dashboard'
Log '后端 API:   http://localhost:3100/api/ops'
Log '日志目录:   logs/'
Log '停止:       .\start.ps1 -Rollback'
Log '=========================================='
