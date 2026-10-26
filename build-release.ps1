<#
.SYNOPSIS
  智享全链运营系统 · 一键打包脚本。产出 ops-release/。

  依赖决策（已确认）：
    node_modules → 原样复制（离线可用，≈185MB）
    MariaDB      → 仅带 87MB zip，首次启动由 start.ps1 解压
    Redis        → 随包 redis-server.exe
#>
$ErrorActionPreference = 'Continue'
$ROOT       = $PSScriptRoot
$BACKEND    = Join-Path $ROOT 'zhixiang-ops-backend'
$FRONTEND   = Join-Path $ROOT 'zhixiang-ops-frontend'
$DASHBOARD  = Join-Path $ROOT 'ops-dashboard'
$ASSETS     = Join-Path $ROOT 'release-assets'
$OUT        = Join-Path $ROOT 'ops-release'
$VERSION    = '0.1.0'
$BUILD_TS   = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

Write-Host ''
Write-Host '=== 0. 清理旧产物（保留已生成的 mariadb.zip）===' -ForegroundColor Cyan
if (Test-Path $OUT) {
  Get-ChildItem $OUT -Exclude 'tools' | Remove-Item -Recurse -Force
  if (-not (Test-Path (Join-Path (Join-Path $OUT 'tools') 'mariadb.zip'))) {
    Remove-Item (Join-Path $OUT 'tools') -Recurse -Force -ErrorAction SilentlyContinue
  }
}
New-Item -ItemType Directory -Path $OUT -Force | Out-Null

Write-Host ''
Write-Host '=== 1. 构建后端 ===' -ForegroundColor Cyan
Push-Location $BACKEND
npm run build 2>&1 | Select-Object -Last 6
Pop-Location
if (-not (Test-Path (Join-Path (Join-Path (Join-Path (Join-Path $BACKEND 'dist') 'db') 'migrations') '001_base.sql'))) {
  Write-Host '迁移 SQL 未进入 dist/db/migrations，打包中止' -ForegroundColor Red
  exit 1
}
Write-Host '后端构建完成，迁移 SQL 已随产物' -ForegroundColor Green

Write-Host ''
Write-Host '=== 2. 构建前端（清空 dist 后重 build，默认租户 t_demo）===' -ForegroundColor Cyan
Push-Location $FRONTEND
if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }
$env:VITE_TENANT_ID = 't_demo'
npm run build 2>&1 | Select-Object -Last 6
Remove-Item Env:VITE_TENANT_ID -ErrorAction SilentlyContinue
Pop-Location
if (-not (Test-Path (Join-Path (Join-Path $FRONTEND 'dist') 'index.html'))) {
  Write-Host '前端构建产物缺失，打包中止' -ForegroundColor Red
  exit 1
}
Write-Host '前端构建完成' -ForegroundColor Green

Write-Host ''
Write-Host '=== 3. 拷贝后端运行时 ===' -ForegroundColor Cyan
$outBackend = Join-Path $OUT 'backend'
New-Item -ItemType Directory -Path $outBackend -Force | Out-Null
Copy-Item (Join-Path $BACKEND 'dist') $outBackend -Recurse -Force
# 生产依赖：仅 dependencies（omit=dev）。临时目录安装后镜像进发布包，
# 既缩小体积（约 87MB）、减少文件数（约 1.4 万），也避免数万小文件拖慢打 EXE 步骤。
Write-Host '准备生产依赖（仅 dependencies，请稍候）…'
$tmpNm = Join-Path $env:TEMP ('ops-prod-nm-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpNm -Force | Out-Null
Copy-Item (Join-Path $BACKEND 'package.json') $tmpNm -Force
Copy-Item (Join-Path $BACKEND 'package-lock.json') $tmpNm -Force
Push-Location $tmpNm
npm install --omit=dev --no-audit --no-fund 2>&1 | Select-Object -Last 4
Pop-Location
$outNm = Join-Path $outBackend 'node_modules'
if (-not (Test-Path $outNm)) { New-Item -ItemType Directory -Path $outNm -Force | Out-Null }
robocopy (Join-Path $tmpNm 'node_modules') $outNm /MIR /NFL /NDL /R:1 /W:1 | Out-Null
Remove-Item $tmpNm -Recurse -Force -ErrorAction SilentlyContinue
Write-Host '生产依赖已就位' -ForegroundColor Green

Write-Host ''
Write-Host '=== 4. 生成生产 .env ===' -ForegroundColor Cyan
$envSrc = Join-Path $BACKEND '.env'
$envLines = Get-Content $envSrc -Encoding utf8
$envLines = $envLines -replace '^NODE_ENV=.*', 'NODE_ENV=production'
$envLines = $envLines -replace '^OPS_DEMO_MODE=.*', 'OPS_DEMO_MODE=true'
# 交付包安全默认：清空可能含真实凭证的密钥，部署时再填（避免密钥随包泄露）
$envLines = $envLines -replace '^OPS_LLM_GATEWAY_KEY=.*', 'OPS_LLM_GATEWAY_KEY='
# 每次打包生成独立强随机 JWT_SECRET/CSRF_SECRET（拒绝占位符随包分发；后端启动时校验强度）
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$mkSecret = {
  $buf = New-Object byte[] 48
  $rng.GetBytes($buf)
  [Convert]::ToBase64String($buf)
}
$envLines = $envLines -replace '^JWT_SECRET=.*', ('JWT_SECRET=' + (& $mkSecret))
$envLines = $envLines -replace '^CSRF_SECRET=.*', ('CSRF_SECRET=' + (& $mkSecret))
$header = @(
  '# ============================================================',
  '# 智享全链运营系统 生产环境配置（由 build-release.ps1 生成）',
  ('# 构建版本: ' + $VERSION + '   构建时间: ' + $BUILD_TS),
  '# 修改后需重启后端生效（.\start.ps1 -Rollback 再 .\start.ps1）',
  '#',
  '# 部署前必改项：',
  '#   1. JWT_SECRET / CSRF_SECRET：本包已随机生成；如需与管理系统 SSO 互通须改为同一强随机串',
  '#   2. DB_PASSWORD：与随包 MariaDB 的 root 密码一致（默认 your_password，建议修改）',
  '#   3. OPS_INTEGRATION_MODE=connected 时填 OPS_MS_CLIENT_ID/SECRET',
  '#   4. OPS_OSS_*：生产建议配置对象存储（默认落本地 ./uploads）',
  '#   5. OPS_LLM_GATEWAY_KEY：已清空（避免密钥随包泄露），部署时按需填免费模型 Key',
  '#   6. OPS_DEMO_MODE=true：登录页免密“演示登录”一键进入演示租户（t_demo，随包内置演示数据）',
  '#     正式使用时建议改为 false（admin/Admin@123 正常登录）',
  '# ============================================================',
  ''
)
($header + $envLines) | Out-File -FilePath (Join-Path $outBackend '.env') -Encoding utf8
Write-Host '生产 .env 已生成（NODE_ENV=production, OPS_DEMO_MODE=true, 随机 JWT/CSRF 密钥）' -ForegroundColor Green

Write-Host ''
Write-Host '=== 5. 拷贝前端 ===' -ForegroundColor Cyan
Copy-Item (Join-Path $FRONTEND 'dist') (Join-Path $OUT 'frontend') -Recurse -Force

Write-Host ''
Write-Host '=== 6. 拷贝门户与看板 ===' -ForegroundColor Cyan
$portalFiles = @('serve.js', 'portal.html', 'index.html', 'portal.css', 'portal.js')
foreach ($f in $portalFiles) {
  if (Test-Path (Join-Path $DASHBOARD $f)) { Copy-Item (Join-Path $DASHBOARD $f) $OUT -Force }
}
if (Test-Path (Join-Path $DASHBOARD 'vendor')) { Copy-Item (Join-Path $DASHBOARD 'vendor') $OUT -Recurse -Force }

Write-Host ''
Write-Host '=== 7. 拷贝工具依赖 ===' -ForegroundColor Cyan
$outTools = Join-Path $OUT 'tools'
New-Item -ItemType Directory -Path $outTools -Force | Out-Null
$redisSrc = 'C:\Program Files\Redis\redis-server.exe'
if (Test-Path $redisSrc) {
  Copy-Item $redisSrc $outTools -Force
  Write-Host 'redis-server.exe 已复制'
} else {
  Write-Host '未找到 C:\Program Files\Redis\redis-server.exe，请手动放入 tools/' -ForegroundColor Yellow
}
$mariadbZip = Join-Path $outTools 'mariadb.zip'
if (-not (Test-Path $mariadbZip)) {
  # 快照一致性：压缩前若本机 MariaDB 正在运行，先优雅停机再打包，避免压出损坏/不一致的数据快照
  $devMdb = 'D:\Users\ZXQL\ZXQL-OPS\tools\mariadb\mariadb-11.4.5-winx64\bin\mysqladmin.exe'
  $dbPass = ($envLines | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace '^DB_PASSWORD=', ''
  if ([string]::IsNullOrEmpty($dbPass)) { $dbPass = 'your_password' }
  if (Test-Path $devMdb) {
    $t = New-Object Net.Sockets.TcpClient
    $running = $false
    try { $t.Connect('127.0.0.1', 3306); $running = $t.Connected } catch { } finally { $t.Dispose() }
    if ($running) {
      Write-Host '检测到本机 MariaDB 运行中，先优雅停机再打包快照…' -ForegroundColor Yellow
      & $devMdb -h 127.0.0.1 -uroot -p"$dbPass" shutdown 2>&1 | Out-Null
      $deadline = (Get-Date).AddSeconds(30)
      while ((Get-Date) -lt $deadline) {
        $t2 = New-Object Net.Sockets.TcpClient
        try { $t2.Connect('127.0.0.1', 3306); if (-not $t2.Connected) { break } } catch { break } finally { $t2.Dispose() }
        Start-Sleep -Seconds 1
      }
      Write-Host 'MariaDB 已停机' -ForegroundColor Green
    }
  }
  Write-Host '压缩 MariaDB（约 87MB，请稍候）…'
  Compress-Archive -Path (Join-Path (Join-Path $ROOT 'tools') 'mariadb') -DestinationPath $mariadbZip -Force
  Write-Host 'mariadb.zip 已生成'
  # 恢复本机开发库
  if ($running) {
    Write-Host '重新启动本机开发 MariaDB…' -ForegroundColor Yellow
    Start-Process -FilePath (Join-Path (Join-Path (Join-Path (Join-Path $ROOT 'tools') 'mariadb') 'mariadb-11.4.5-winx64') 'bin\mariadbd.exe') -ArgumentList '--datadir=D:\Users\ZXQL\ZXQL-OPS\tools\mariadb\data','--port=3306','--bind-address=127.0.0.1','--skip-ssl' -WindowStyle Hidden | Out-Null
  }
} else {
  Write-Host '复用已存在的 mariadb.zip（跳过压缩）'
}

Write-Host ''
Write-Host '=== 8. 启动脚本 / 备份 / 版本 / 说明 ===' -ForegroundColor Cyan
Copy-Item (Join-Path $ASSETS 'start.ps1') $OUT -Force
Copy-Item (Join-Path $ASSETS 'backup.ps1') $OUT -Force
('version=' + $VERSION + "`nbuild=" + $BUILD_TS) | Out-File -FilePath (Join-Path $OUT 'version.txt') -Encoding utf8
$readme = @"
# 智享全链运营系统 正式发布包 (v$VERSION)

## 目录结构
- backend/        后端编译产物(dist) + node_modules + 生产 .env
- frontend/       运营前端构建产物（SPA）
- serve.js        统一门户（门户 + 看板 + 反代后端/管理系统）
- portal.html     统一登录门户
- index.html      运营决策看板
- tools/          mariadb.zip（首次解压）+ redis-server.exe
- logs/           运行日志
- backups/        数据库备份（backup.ps1 生成）
- start.ps1       一键启动（生产模式）
- backup.ps1      数据库备份脚本
- version.txt     版本与构建时间

## 一键启动
    .\start.ps1
浏览器打开 http://localhost:8080

## 停止 / 回滚
    .\start.ps1 -Rollback

## 数据备份（重要：本包内置数据库，建议定期备份）
    .\backup.ps1                  # 备份到 backups/，保留最近 7 天
    .\backup.ps1 -KeepDays 14     # 自定义保留天数
    # 每日 03:00 自动备份（计划任务，一条命令）：
    schtasks /Create /TN "ZXQLOps-Backup" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"%LOCALAPPDATA%\ZXQL-Ops\backup.ps1\"" /SC DAILY /ST 03:00

## 部署前必改（backend/.env）
1. JWT_SECRET / CSRF_SECRET：强随机串，且与管理系统一致
2. DB_PASSWORD：与随包 MariaDB root 密码一致
3. OPS_INTEGRATION_MODE=connected 时填 OPS_MS_CLIENT_ID/SECRET
4. OPS_OSS_*：生产建议配置对象存储
5. OPS_LLM_GATEWAY_KEY：已清空，部署时按需填写
6. OPS_DEMO_MODE=true 时登录页可免密“演示登录”（一键进入 t_demo 演示租户）

## 默认账号
- 演示登录：登录页“演示登录”按钮（免密，OPS_DEMO_MODE=true 时可用）
- 正式账号：admin / Admin@123（t_demo 租户管理员）

## 依赖决策
- node_modules 原样随包（离线可用）
- MariaDB 仅 87MB zip，首次启动由 start.ps1 解压到 tools/mariadb
- Redis 随包 redis-server.exe，start.ps1 一并拉起
"@
$readme | Out-File -FilePath (Join-Path $OUT 'README.md') -Encoding utf8

Write-Host ''
Write-Host '=== 打包完成（目录包）===' -ForegroundColor Green
Write-Host ('ops-release/ 已生成（v' + $VERSION + ' @ ' + $BUILD_TS + '）') -ForegroundColor Green
Get-ChildItem $OUT | ForEach-Object {
  if ($_.PSIsContainer) {
    $sz = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
    '{0,-12} {1:N0} MB' -f $_.Name, ($sz / 1MB)
  } else {
    '{0,-12} {1:N0} MB' -f $_.Name, ($_.Length / 1MB)
  }
}

Write-Host ''
Write-Host '=== 9. 打包为单文件 EXE（自解压安装器）===' -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ROOT 'make-exe.ps1') -Source $OUT -Version $VERSION

Write-Host ''
Write-Host '下一步：双击 智享全链运营系统_v' + $VERSION + '.exe 即可一键安装并启动' -ForegroundColor Cyan
