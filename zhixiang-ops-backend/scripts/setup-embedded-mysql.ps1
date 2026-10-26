# 下载并解压内嵌 MySQL 二进制到 vendor/mysql（打包前执行一次；已存在则跳过）
# 用法: powershell -ExecutionPolicy Bypass -File scripts/setup-embedded-mysql.ps1
param(
  [string]$Version = '8.0.28',
  [string]$Mirror  = 'https://mirrors.aliyun.com/mysql/MySQL-8.0'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root    = Split-Path -Parent $PSScriptRoot
$vendor  = Join-Path $root 'vendor'
$target  = Join-Path $vendor 'mysql'
$mysqld  = Join-Path $target 'bin\mysqld.exe'

if (Test-Path $mysqld) {
  Write-Host "[setup-embedded-mysql] 已存在: $mysqld ，跳过"
  exit 0
}

New-Item -ItemType Directory -Force -Path $vendor | Out-Null
$zip = Join-Path $vendor "mysql-$Version-winx64.zip"
$url = "$Mirror/mysql-$Version-winx64.zip"

Write-Host "[setup-embedded-mysql] 下载 $url"
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 1800

$tmp = Join-Path $vendor 'mysql-extract'
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
Write-Host "[setup-embedded-mysql] 解压..."
Expand-Archive -Path $zip -DestinationPath $tmp -Force

$inner = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
if (-not $inner) { throw '解压结果异常：未找到目录' }
if (Test-Path $target) { Remove-Item -Recurse -Force $target }
Move-Item -Path $inner.FullName -Destination $target

Remove-Item -Recurse -Force $tmp
Remove-Item -Force $zip
Write-Host "[setup-embedded-mysql] 完成: $target"
& (Join-Path $target 'bin\mysqld.exe') --version
