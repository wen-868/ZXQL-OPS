<#
.SYNOPSIS
  智享全链运营系统 · 桌面版单文件 EXE 生成器。
  将 ops-release/ + 桌面客户端（ZXQLOpsDesktop.exe + WebView2 DLL）打成 tar，
  用 csc 编译安装器引导器，嵌入尾部，产出：
    双击 → 解压到同目录 zhixiang-ops-desktop/ → 创建桌面快捷方式 → 启动桌面客户端。
  依赖：Windows 自带 .NET Framework 4.8 + csc.exe + tar.exe。
#>
param(
  [string]$Source  = (Join-Path $PSScriptRoot 'ops-release'),
  [string]$Desktop = (Join-Path $PSScriptRoot 'desktop'),
  [string]$Version = '0.1.0'
)
$ErrorActionPreference = 'Stop'
$ROOT     = $PSScriptRoot
$BUNDLE   = Join-Path $ROOT 'desktop-bundle'
$TAR      = 'C:\Windows\system32\tar.exe'
$CSC      = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$PAYLOAD  = Join-Path $ROOT 'desktop-payload.tar'
$CS_FILE  = Join-Path $ROOT 'make-desktop\DesktopInstaller.cs'
$SELF_EXE = Join-Path $ROOT 'DesktopInstaller.exe'
$FINAL    = Join-Path $ROOT ('智享全链运营系统_桌面版_v' + $Version + '.exe')

if (-not (Test-Path (Join-Path $Desktop 'ZXQLOpsDesktop.exe'))) {
  Write-Host "未找到桌面客户端 $Desktop\ZXQLOpsDesktop.exe" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '=== A. 组装桌面包（ops-release + 桌面客户端）===' -ForegroundColor Cyan
if (Test-Path $BUNDLE) { Remove-Item $BUNDLE -Recurse -Force }
Copy-Item $Source $BUNDLE -Recurse -Force
Copy-Item (Join-Path $Desktop 'ZXQLOpsDesktop.exe') $BUNDLE -Force
Copy-Item (Join-Path $Desktop 'Microsoft.Web.WebView2.Core.dll') $BUNDLE -Force
Copy-Item (Join-Path $Desktop 'Microsoft.Web.WebView2.WinForms.dll') $BUNDLE -Force
Copy-Item (Join-Path $Desktop 'WebView2Loader.dll') $BUNDLE -Force
Write-Host '桌面包已组装' -ForegroundColor Green

Write-Host ''
Write-Host '=== B. 打包 tar（未压缩）===' -ForegroundColor Cyan
if (Test-Path $PAYLOAD) { Remove-Item $PAYLOAD -Force }
& $TAR -cf $PAYLOAD -C $BUNDLE .
if (-not (Test-Path $PAYLOAD)) { Write-Host '打包失败' -ForegroundColor Red; exit 1 }
Write-Host ('tar 大小: ' + [math]::Round((Get-Item $PAYLOAD).Length / 1MB, 1) + ' MB') -ForegroundColor Green

Write-Host ''
Write-Host '=== C. 编译安装器（csc.exe）===' -ForegroundColor Cyan
if (Test-Path $SELF_EXE) { Remove-Item $SELF_EXE -Force }
$iconArg = '/win32icon:' + (Join-Path $Desktop 'logo.ico')
$cscOut = & $CSC /nologo /target:winexe /platform:anycpu /optimize $iconArg /out:$SELF_EXE `
  /r:System.dll /r:System.Core.dll /r:System.Windows.Forms.dll /r:Microsoft.CSharp.dll `
  $CS_FILE 2>&1 | Out-String
if (-not (Test-Path $SELF_EXE)) {
  Write-Host '安装器编译失败：' -ForegroundColor Red
  Write-Host $cscOut
  exit 1
}
Write-Host '安装器已编译' -ForegroundColor Green

Write-Host ''
Write-Host '=== D. 嵌入 tar 到 EXE 尾部 ===' -ForegroundColor Cyan
$src = [IO.File]::OpenRead($PAYLOAD)
$dst = [IO.File]::Open($SELF_EXE, [IO.FileMode]::Append, [IO.FileAccess]::Write)
$buf = New-Object byte[] 1048576
$total = 0
try {
  while (($r = $src.Read($buf, 0, $buf.Length)) -gt 0) {
    $dst.Write($buf, 0, $r)
    $total += $r
  }
} finally {
  $src.Close()
  $dst.Close()
}
$lenBytes = [BitConverter]::GetBytes([long]$total)
$dst2 = [IO.File]::Open($SELF_EXE, [IO.FileMode]::Append, [IO.FileAccess]::Write)
try { $dst2.Write($lenBytes, 0, 8) } finally { $dst2.Close() }
Write-Host '已嵌入内嵌包' -ForegroundColor Green

Move-Item $SELF_EXE $FINAL -Force
Remove-Item $PAYLOAD -Force
Remove-Item $BUNDLE -Recurse -Force
Write-Host ''
Write-Host ('✅ 已生成桌面版 EXE: ' + $FINAL) -ForegroundColor Green
Write-Host ('   大小: ' + [math]::Round((Get-Item $FINAL).Length / 1MB, 1) + ' MB') -ForegroundColor Green
Write-Host '   使用: 双击 EXE → 解压到同目录 zhixiang-ops-desktop/ → 桌面快捷方式 → 启动桌面客户端' -ForegroundColor Cyan