<#
.SYNOPSIS
  智享全链运营系统 · 数据库备份脚本。
  使用随包 MariaDB 的 mysqldump 全量导出 zhixiang_ops 库到 backups/，
  保留最近 KEEP_DAYS 天（默认 7），旧备份自动清理。

.USAGE
  .\backup.ps1                     # 立即备份
  .\backup.ps1 -KeepDays 14        # 保留 14 天
  配合计划任务可定时备份：
    schtasks /Create /TN "ZXQLOps-Backup" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"<安装目录>\backup.ps1\"" /SC DAILY /ST 03:00
#>
param(
  [int]$KeepDays = 7
)
$ErrorActionPreference = 'Stop'
$ROOT    = $PSScriptRoot
$MYSQL   = Join-Path (Join-Path (Join-Path (Join-Path $ROOT 'tools') 'mariadb') 'mariadb-11.4.5-winx64') 'bin\mysqldump.exe'
$BK_DIR  = Join-Path $ROOT 'backups'
$DB_NAME = 'zhixiang_ops'

if (-not (Test-Path $MYSQL)) {
  Write-Host "未找到 mysqldump（$MYSQL），请先运行 start.ps1 完成首次解压。" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $BK_DIR)) { New-Item -ItemType Directory -Path $BK_DIR -Force | Out-Null }

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$out   = Join-Path $BK_DIR ("$DB_NAME" + '_' + $stamp + '.sql')
$pass  = $env:DB_PASSWORD
if ([string]::IsNullOrEmpty($pass)) {
  $envFile = Join-Path (Join-Path $ROOT 'backend') '.env'
  if (Test-Path $envFile) {
    $m = (Get-Content $envFile) | Where-Object { $_ -match '^DB_PASSWORD=' } | Select-Object -First 1
    if ($m) { $pass = ($m -replace '^DB_PASSWORD=', '') }
  }
}
if ([string]::IsNullOrEmpty($pass)) { $pass = 'your_password' }

Write-Host '▶ 备份数据库…'
& $MYSQL -h 127.0.0.1 -uroot -p"$pass" --single-transaction --routines --triggers $DB_NAME | Out-File -FilePath $out -Encoding utf8
if (-not (Test-Path $out) -or (Get-Item $out).Length -eq 0) {
  Write-Host '❌ 备份失败：输出为空（请确认 MariaDB 已通过 start.ps1 启动，或 DB_PASSWORD 与 backend/.env 一致）' -ForegroundColor Red
  exit 1
}
Write-Host ('✅ 备份完成: ' + $out + ' (' + [math]::Round((Get-Item $out).Length / 1MB, 2) + ' MB)') -ForegroundColor Green

# 清理过期备份
$cutoff = (Get-Date).AddDays(-$KeepDays)
Get-ChildItem $BK_DIR -Filter "$DB_NAME`_*.sql" | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
  Remove-Item $_.FullName -Force
  Write-Host ("已清理过期备份: " + $_.Name)
}
Write-Host ("当前保留: " + (Get-ChildItem $BK_DIR -Filter "$DB_NAME`_*.sql" | Measure-Object).Count + " 份")