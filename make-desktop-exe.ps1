<#
.SYNOPSIS
  智享全链运营系统 · 桌面版单文件 EXE 生成器。
  将 ops-release/ + 桌面客户端（ZXQLOpsDesktop.exe + WebView2 DLL）打成 tar，
  用现代 dotnet publish 编译安装器引导器，嵌入尾部，产出：
    双击 → 解压到同目录 zhixiang-ops-desktop/ → 创建桌面快捷方式 → 启动桌面客户端。
  OPS-SECURITY-DESKTOP-MODERNIZATION-01：主链改为 dotnet publish（net8.0-windows），
  不再依赖 .NET Framework 4.8 csc.exe 作为主链；csc 仅作显式受限 fallback 并记录告警。
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
$PAYLOAD  = Join-Path $ROOT 'desktop-payload.tar'
$INST_PROJ = Join-Path $ROOT 'make-desktop\ZXQLOpsInstaller.csproj'
$PUBLISH_OUT = Join-Path $ROOT 'make-desktop\bin\publish-installer'
$SELF_EXE = Join-Path $PUBLISH_OUT 'DesktopInstaller.exe'
$FINAL    = Join-Path $ROOT ('智享全链运营系统_桌面版_v' + $Version + '.exe')
$SOURCE_COMMIT = '2d24afd9e19f545c2cc502d957add68334c57381'

if (-not (Test-Path (Join-Path $Desktop 'ZXQLOpsDesktop.exe'))) {
  Write-Host "未找到桌面客户端 $Desktop\ZXQLOpsDesktop.exe" -ForegroundColor Red
  exit 1
}

Write-Host ('[build-meta] sourceCommit=' + $SOURCE_COMMIT + ' version=' + $Version)

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
Write-Host '=== C. 编译安装器（dotnet publish 主链）===' -ForegroundColor Cyan
if (Test-Path $PUBLISH_OUT) { Remove-Item $PUBLISH_OUT -Recurse -Force }
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnet) {
  & dotnet publish $INST_PROJ -c Release -r win-x64 --self-contained false -o $PUBLISH_OUT /p:Version=$Version /p:SourceRevisionId=$SOURCE_COMMIT
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $SELF_EXE)) { Write-Host 'dotnet publish 安装器失败' -ForegroundColor Red; exit 1 }
  Write-Host '安装器已通过 dotnet publish 编译' -ForegroundColor Green
} else {
  # 受限 fallback：仅在无 dotnet SDK 环境下使用 csc，需明确告警并记录；不作为主链。
  Write-Host 'WARN: dotnet SDK 不可用，使用受限 csc fallback（非主链，产物不具备现代 ArgumentList 运行时保障）' -ForegroundColor Yellow
  $CSC = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  $CS_FILE = Join-Path $ROOT 'make-desktop\DesktopInstaller.cs'
  $ICB = Join-Path $ROOT 'make-desktop\InstallerCommandBuilder.cs'
  $SELF_EXE_LEGACY = Join-Path $ROOT 'DesktopInstaller.exe'
  if (Test-Path $SELF_EXE_LEGACY) { Remove-Item $SELF_EXE_LEGACY -Force }
  $iconArg = '/win32icon:' + (Join-Path $Desktop 'logo.ico')
  $manArg  = '/win32manifest:' + (Join-Path $Desktop 'app.manifest')
  $cscOut = & $CSC /nologo /target:winexe /platform:anycpu /optimize $iconArg $manArg /out:$SELF_EXE_LEGACY `
    /r:System.dll /r:System.Core.dll /r:System.Windows.Forms.dll /r:Microsoft.CSharp.dll `
    $CS_FILE $ICB 2>&1 | Out-String
  if (-not (Test-Path $SELF_EXE_LEGACY)) { Write-Host "csc fallback 失败: $cscOut" -ForegroundColor Red; exit 1 }
  $SELF_EXE = $SELF_EXE_LEGACY
  Write-Host '安装器已通过 csc fallback 编译（受限）' -ForegroundColor Yellow
}

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
if (Test-Path $BUNDLE) { Remove-Item $BUNDLE -Recurse -Force }
Write-Host ''
Write-Host ('✅ 已生成桌面版 EXE: ' + $FINAL) -ForegroundColor Green
Write-Host ('   大小: ' + [math]::Round((Get-Item $FINAL).Length / 1MB, 1) + ' MB') -ForegroundColor Green
Write-Host ('   源锚点: ' + $SOURCE_COMMIT) -ForegroundColor Cyan
Write-Host '   使用: 双击 EXE → 解压到同目录 zhixiang-ops-desktop/ → 桌面快捷方式 → 启动桌面客户端' -ForegroundColor Cyan