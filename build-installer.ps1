<#
.SYNOPSIS
  智享全链运营系统 · NSIS 完整安装版构建器。
  将 ops-release/ + 桌面客户端组装为 installer-bundle/，用 makensis 编译出安装版 EXE：
    安装向导 → Program Files → 开始菜单/桌面快捷方式 → 控制面板可卸载 → 卸载时自动停止服务栈。
  依赖：NSIS 3.x（winget install NSIS.NSIS）。
#>
param(
  [string]$Source  = (Join-Path $PSScriptRoot 'ops-release'),
  [string]$Version = '0.1.0'
)
$ErrorActionPreference = 'Stop'
$ROOT     = $PSScriptRoot
$DESKTOP  = Join-Path $ROOT 'desktop'
$BUNDLE   = Join-Path $ROOT 'installer-bundle'
$NSI      = Join-Path $ROOT 'installer.nsi'
$NSI_BOM  = Join-Path $ROOT 'installer-bom.nsi'
$MAKENSIS = 'C:\Program Files (x86)\NSIS\makensis.exe'
$FINAL    = Join-Path $ROOT ('智享全链运营系统_安装版_v' + $Version + '.exe')

if (-not (Test-Path (Join-Path $DESKTOP 'ZXQLOpsDesktop.exe'))) {
  Write-Host "未找到桌面客户端 $DESKTOP\ZXQLOpsDesktop.exe（先运行 build-release.ps1）" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '=== A. 组装安装包目录（ops-release + 桌面客户端）===' -ForegroundColor Cyan
if (Test-Path $BUNDLE) { Remove-Item $BUNDLE -Recurse -Force }
New-Item -ItemType Directory -Path $BUNDLE -Force | Out-Null
robocopy $Source $BUNDLE /MIR /NFL /NDL /R:1 /W:1 | Out-Null
Copy-Item (Join-Path $DESKTOP 'ZXQLOpsDesktop.exe') $BUNDLE -Force
Copy-Item (Join-Path $DESKTOP 'Microsoft.Web.WebView2.Core.dll') $BUNDLE -Force
Copy-Item (Join-Path $DESKTOP 'Microsoft.Web.WebView2.WinForms.dll') $BUNDLE -Force
Copy-Item (Join-Path $DESKTOP 'WebView2Loader.dll') $BUNDLE -Force
Copy-Item (Join-Path $DESKTOP 'logo.ico') $BUNDLE -Force
$sz = (Get-ChildItem $BUNDLE -Recurse -File | Measure-Object -Property Length -Sum).Sum
Write-Host ('安装包内容: ' + [math]::Round($sz / 1MB, 1) + ' MB') -ForegroundColor Green

Write-Host ''
Write-Host '=== B. NSIS 脚本转 UTF-8 BOM（Unicode 中文）===' -ForegroundColor Cyan
$content = [IO.File]::ReadAllText($NSI, [Text.Encoding]::UTF8)
[IO.File]::WriteAllText($NSI_BOM, $content, (New-Object System.Text.UTF8Encoding($true)))

Write-Host ''
Write-Host '=== C. 编译安装器（makensis，LZMA 压缩请稍候）===' -ForegroundColor Cyan
& $MAKENSIS /V2 $NSI_BOM
if (-not (Test-Path $FINAL)) {
  Write-Host '编译失败' -ForegroundColor Red
  exit 1
}
Remove-Item $NSI_BOM -Force
Remove-Item $BUNDLE -Recurse -Force

Write-Host ''
Write-Host ('✅ 已生成安装版 EXE: ' + $FINAL) -ForegroundColor Green
Write-Host ('   大小: ' + [math]::Round((Get-Item $FINAL).Length / 1MB, 1) + ' MB') -ForegroundColor Green
Write-Host '   使用: 双击 → 安装向导 → 选择目录 → 开始菜单/桌面快捷方式 → 控制面板可卸载' -ForegroundColor Cyan
