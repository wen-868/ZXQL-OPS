<#
.SYNOPSIS
  智享全链运营系统 · 单文件 EXE 生成器（自解压安装器）。
  把 ops-release/ 打成（未压缩）tar 包，编译 C# 引导器并嵌入 EXE 尾部。
  OPS-SECURITY-DESKTOP-MODERNIZATION-01：主链改为 dotnet publish（现代 .NET，ArgumentList 可用），
  不再依赖 .NET Framework 4.8 csc.exe 作为主链；csc 仅作显式受限 fallback 并记录告警。
#>
param(
  [string]$Source  = (Join-Path $PSScriptRoot 'ops-release'),
  [string]$Version = '0.1.0'
)
$ErrorActionPreference = 'Stop'
$ROOT        = $PSScriptRoot
$RELEASE_TAR = Join-Path $ROOT 'ops-release.tar'
$CS_FILE     = Join-Path $ROOT 'SelfExtractor.cs'
$PROJ_FILE   = Join-Path $ROOT 'SelfExtractor.csproj'
$PUBLISH_OUT = Join-Path $ROOT 'selfextractor-publish'
$SELF_EXE    = Join-Path $PUBLISH_OUT 'SelfExtractor.exe'
$TAR         = 'C:\Windows\system32\tar.exe'
$FINAL       = Join-Path $ROOT ('智享全链运营系统_v' + $Version + '.exe')
$SOURCE_COMMIT = '2d24afd9e19f545c2cc502d957add68334c57381'

if (-not (Test-Path $Source)) {
  Write-Host "未找到 $Source，请先运行 build-release.ps1" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $TAR)) {
  Write-Host "未找到 tar.exe ($TAR)，无法打包/解包" -ForegroundColor Red
  exit 1
}

Write-Host ('[build-meta] sourceCommit=' + $SOURCE_COMMIT + ' version=' + $Version)
Write-Host ''
Write-Host '=== A. 打包 ops-release → tar（未压缩，请稍候）===' -ForegroundColor Cyan
if (Test-Path $RELEASE_TAR) { Remove-Item $RELEASE_TAR -Force }
& $TAR -cf $RELEASE_TAR -C $Source .
if (-not (Test-Path $RELEASE_TAR)) { Write-Host "打包失败，未生成 tar" -ForegroundColor Red; exit 1 }
Write-Host ('tar 大小: ' + [math]::Round((Get-Item $RELEASE_TAR).Length / 1MB, 1) + ' MB') -ForegroundColor Green

Write-Host ''
Write-Host '=== B. 生成 C# 自解压引导器源码（ArgumentList，net8.0-windows）===' -ForegroundColor Cyan
$cs = @'
using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Net.Sockets;

class SelfExtractor {
  // OPS-SECURITY-DESKTOP-MODERNIZATION-01：进程启动仅用 ArgumentList，不使用 Arguments 字符串拼接。
  internal const string SourceCommit = "2d24afd9e19f545c2cc502d957add68334c57381";
  static int Main() {
    string exe = Environment.ProcessPath ?? System.Reflection.Assembly.GetExecutingAssembly().Location;
    Console.WriteLine("智享全链运营系统 - 自解压安装器");
    Console.WriteLine("程序: " + exe);
    Console.WriteLine("源锚点: " + SourceCommit);
    string baseDir = Path.GetDirectoryName(exe) ?? ".";
    string outDir = Path.Combine(baseDir, "zhixiang-ops-release");
    string verFile = Path.Combine(outDir, "version.txt");
    string tarExe = "C:\\Windows\\system32\\tar.exe";
    string payload = Path.Combine(baseDir, "._payload.tar");

    long len, start;
    using (var fs = new FileStream(exe, FileMode.Open, FileAccess.Read, FileShare.Read)) {
      fs.Seek(-8, SeekOrigin.End);
      byte[] tail = new byte[8];
      int got = 0; while (got < 8) { int r = fs.Read(tail, got, 8 - got); if (r == 0) break; got += r; }
      len = BitConverter.ToInt64(tail, 0);
      start = fs.Length - 8 - len;
      fs.Seek(start, SeekOrigin.Begin);
      using (var outf = new FileStream(payload, FileMode.Create, FileAccess.Write)) {
        byte[] buf = new byte[1 << 20];
        long remaining = len;
        while (remaining > 0) {
          int toRead = (int)Math.Min(buf.Length, remaining);
          int r = fs.Read(buf, 0, toRead); if (r == 0) break;
          outf.Write(buf, 0, r); remaining -= r;
        }
      }
    }

    if (!File.Exists(verFile)) {
      Console.WriteLine("目标目录: " + outDir);
      Console.WriteLine("正在解压，请稍候（首次运行约需几分钟）...");
      Directory.CreateDirectory(outDir);
      var psi = new ProcessStartInfo(tarExe) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
      psi.ArgumentList.Add("-xf");
      psi.ArgumentList.Add(payload);
      psi.ArgumentList.Add("-C");
      psi.ArgumentList.Add(outDir);
      using (var p = Process.Start(psi)) {
        if (p != null) {
          p.WaitForExit();
          string err = p.StandardError.ReadToEnd();
          if (p.ExitCode != 0) Console.WriteLine("解压警告: " + err);
        }
      }
      Console.WriteLine("解压完成。");
    } else {
      Console.WriteLine("检测到目标目录已解压，跳过解压（如需重装请先删除 " + outDir + "）。");
    }
    try { File.Delete(payload); } catch {}

    string ps = Path.Combine(outDir, "start.ps1");
    if (File.Exists(ps)) {
      var psi = new ProcessStartInfo("powershell.exe") { WorkingDirectory = outDir, UseShellExecute = false, CreateNoWindow = true };
      psi.ArgumentList.Add("-NoProfile");
      psi.ArgumentList.Add("-ExecutionPolicy");
      psi.ArgumentList.Add("Bypass");
      psi.ArgumentList.Add("-File");
      psi.ArgumentList.Add(ps);
      try { Process.Start(psi); Console.WriteLine("已启动 start.ps1，服务正在初始化..."); }
      catch (Exception ex) { Console.WriteLine("启动失败: " + ex.Message); }
    } else {
      Console.WriteLine("未找到 start.ps1，请确认解压完整。");
    }

    bool up = false;
    for (int i = 0; i < 120; i++) {
      try { using (var c = new TcpClient()) { c.Connect("127.0.0.1", 8080); up = true; break; } } catch {}
      Thread.Sleep(1000);
    }
    if (up) {
      try { Process.Start(new ProcessStartInfo("http://localhost:8080") { UseShellExecute = true }); Console.WriteLine("门户已就绪，浏览器已打开 http://localhost:8080"); }
      catch { Console.WriteLine("门户已就绪，请手动打开 http://localhost:8080"); }
    } else {
      Console.WriteLine("门户未在 120 秒内就绪，请检查 logs/start.log，或手动打开 http://localhost:8080");
    }
    Console.WriteLine("按任意键关闭本窗口（服务已在后台运行；停止请用 start.ps1 -Rollback）...");
    try { Console.ReadKey(); } catch {}
    return 0;
  }
}
'@
[System.IO.File]::WriteAllText($CS_FILE, $cs, [System.Text.Encoding]::UTF8)

$proj = @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <ImplicitUsings>disable</ImplicitUsings>
    <Nullable>disable</Nullable>
    <AssemblyName>SelfExtractor</AssemblyName>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
    <Deterministic>true</Deterministic>
    <Version>$Version</Version>
  </PropertyGroup>
  <ItemGroup><Compile Include="SelfExtractor.cs" /></ItemGroup>
</Project>
"@
[System.IO.File]::WriteAllText($PROJ_FILE, $proj, [System.Text.Encoding]::UTF8)

Write-Host '=== C. 编译引导器（dotnet publish 主链）===' -ForegroundColor Cyan
if (Test-Path $PUBLISH_OUT) { Remove-Item $PUBLISH_OUT -Recurse -Force }
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if ($dotnet) {
  & dotnet publish $PROJ_FILE -c Release -r win-x64 --self-contained false -o $PUBLISH_OUT /p:SourceRevisionId=$SOURCE_COMMIT
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $SELF_EXE)) { Write-Host 'dotnet publish 引导器失败' -ForegroundColor Red; exit 1 }
  Write-Host '引导器已通过 dotnet publish 编译' -ForegroundColor Green
} else {
  # 受限 fallback：无 dotnet SDK 环境。csc/.NET Framework 4.8 不支持 ArgumentList（net48 引导器需字符串）。
  # 为满足“主链现代化+受控路径注入消除”目标，此处仅生成结构校验产物提示并阻断伪造发布；真实发布需 dotnet SDK。
  Write-Host 'WARN: dotnet SDK 不可用，dotnet publish 主链无法执行；csc fallback 不能生成 net8 ArgumentList 引导器，构建阻断（非伪造）' -ForegroundColor Yellow
  exit 2
}

Write-Host ''
Write-Host '=== D. 嵌入 tar 到 EXE 尾部 ===' -ForegroundColor Cyan
$src = [IO.File]::OpenRead($RELEASE_TAR)
$dst = [IO.File]::Open($SELF_EXE, [IO.FileMode]::Append, [IO.FileAccess]::Write)
$buf = New-Object byte[] 1048576
$total = 0
try {
  while (($r = $src.Read($buf, 0, $buf.Length)) -gt 0) {
    $dst.Write($buf, 0, $r)
    $total += $r
  }
} finally { $src.Close(); $dst.Close() }
$lenBytes = [BitConverter]::GetBytes([long]$total)
$dst2 = [IO.File]::Open($SELF_EXE, [IO.FileMode]::Append, [IO.FileAccess]::Write)
try { $dst2.Write($lenBytes, 0, 8) } finally { $dst2.Close() }
Write-Host '已嵌入内嵌包' -ForegroundColor Green

Move-Item $SELF_EXE $FINAL -Force
Remove-Item $RELEASE_TAR -Force
Remove-Item $CS_FILE -Force
Remove-Item $PROJ_FILE -Force
if (Test-Path $PUBLISH_OUT) { Remove-Item $PUBLISH_OUT -Recurse -Force }
Write-Host ''
Write-Host ('✅ 已生成单文件 EXE: ' + $FINAL) -ForegroundColor Green
Write-Host ('   大小: ' + [math]::Round((Get-Item $FINAL).Length / 1MB, 1) + ' MB') -ForegroundColor Green
Write-Host ('   源锚点: ' + $SOURCE_COMMIT) -ForegroundColor Cyan
Write-Host '   使用: 双击 EXE → 自动解压到同目录 zhixiang-ops-release/ → 自动启动并打开浏览器 http://localhost:8080' -ForegroundColor Cyan
