<#
.SYNOPSIS
  智享全链运营系统 · 单文件 EXE 生成器（自解压安装器）。
  把 ops-release/ 打成（未压缩）tar 包，并用 csc 编译一个 C# 引导器，
  将 tar 嵌入 EXE 尾部，产出单个可执行文件：
    双击 → 自动解压到同目录 zhixiang-ops-release/ → 自动运行 start.ps1 → 打开浏览器。

  设计要点：
    · 打包用未压缩 tar（-cf），避开 deflate 在数万小文件上的极慢 CPU 开销。
    · 引导器解压直接调用系统 tar.exe（Windows 10+ 自带，原生支持 >260 长路径），
      绕开 .NET/PowerShell 在长路径上的删除/写入限制。
  依赖：Windows 自带 .NET Framework 4.8 + csc.exe + tar.exe（无需额外安装）。
#>
param(
  [string]$Source  = (Join-Path $PSScriptRoot 'ops-release'),
  [string]$Version = '0.1.0'
)
$ErrorActionPreference = 'Stop'
$ROOT        = $PSScriptRoot
$RELEASE_TAR = Join-Path $ROOT 'ops-release.tar'
$CS_FILE     = Join-Path $ROOT 'SelfExtractor.cs'
$SELF_EXE    = Join-Path $ROOT 'SelfExtractor.exe'
$CSC         = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$TAR         = 'C:\Windows\system32\tar.exe'
$FINAL       = Join-Path $ROOT ('智享全链运营系统_v' + $Version + '.exe')

if (-not (Test-Path $Source)) {
  Write-Host "未找到 $Source，请先运行 build-release.ps1" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $CSC)) {
  Write-Host "未找到 csc.exe ($CSC)，无法编译引导器" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $TAR)) {
  Write-Host "未找到 tar.exe ($TAR)，无法打包/解包" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '=== A. 打包 ops-release → tar（未压缩，请稍候）===' -ForegroundColor Cyan
if (Test-Path $RELEASE_TAR) { Remove-Item $RELEASE_TAR -Force }
# -C 进入源目录后压 "."，使 tar 内只含内容（不含 ops-release 顶层目录名）。
& $TAR -cf $RELEASE_TAR -C $Source .
if (-not (Test-Path $RELEASE_TAR)) {
  Write-Host "打包失败，未生成 tar" -ForegroundColor Red
  exit 1
}
Write-Host ('tar 大小: ' + [math]::Round((Get-Item $RELEASE_TAR).Length / 1MB, 1) + ' MB') -ForegroundColor Green

Write-Host ''
Write-Host '=== B. 生成 C# 自解压引导器源码 ===' -ForegroundColor Cyan
# 源码仅运行时字符串含中文；用 UTF-8 BOM 写盘，保证 csc 正确识别。
$cs = @'
using System;
using System.IO;
using System.Diagnostics;
using System.Threading;
using System.Net.Sockets;

class SelfExtractor {
  static int Main() {
    string exe = System.Reflection.Assembly.GetExecutingAssembly().Location;
    Console.WriteLine("智享全链运营系统 - 自解压安装器");
    Console.WriteLine("程序: " + exe);
    string baseDir = Path.GetDirectoryName(exe);
    string outDir = Path.Combine(baseDir, "zhixiang-ops-release");
    string verFile = Path.Combine(outDir, "version.txt");
    string tarExe = "C:\\Windows\\system32\\tar.exe";

    // 读取尾部 8 字节 = 内嵌 tar 长度（不在内存中加载整个 EXE，避免大文件与 int 溢出）
    long len, start;
    string payload = Path.Combine(baseDir, "._payload.tar");
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
      var psi = new ProcessStartInfo(tarExe, "-xf \"" + payload + "\" -C \"" + outDir + "\"") {
        UseShellExecute = false, CreateNoWindow = true,
        RedirectStandardOutput = true, RedirectStandardError = true
      };
      using (var p = Process.Start(psi)) {
        p.WaitForExit();
        string err = p.StandardError.ReadToEnd();
        if (p.ExitCode != 0) Console.WriteLine("解压警告: " + err);
      }
      Console.WriteLine("解压完成。");
    } else {
      Console.WriteLine("检测到目标目录已解压，跳过解压（如需重装请先删除 " + outDir + "）。");
    }
    try { File.Delete(payload); } catch {}

    string ps = Path.Combine(outDir, "start.ps1");
    if (File.Exists(ps)) {
      var psi = new ProcessStartInfo("powershell.exe", "-ExecutionPolicy Bypass -File \"" + ps + "\"") {
        WorkingDirectory = outDir, UseShellExecute = false, CreateNoWindow = true
      };
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
      try { Process.Start(new ProcessStartInfo("http://localhost:8080") { UseShellExecute = true });
            Console.WriteLine("门户已就绪，浏览器已打开 http://localhost:8080"); }
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

Write-Host '=== C. 编译引导器（csc.exe）===' -ForegroundColor Cyan
if (Test-Path $SELF_EXE) { Remove-Item $SELF_EXE -Force }
$cscOut = & $CSC /nologo /out:$SELF_EXE /target:exe $CS_FILE 2>&1 | Out-String
if (-not (Test-Path $SELF_EXE)) {
  Write-Host "引导器编译失败：" -ForegroundColor Red
  Write-Host $cscOut
  exit 1
}
Write-Host '引导器已编译' -ForegroundColor Green

Write-Host ''
Write-Host '=== D. 嵌入 tar 到 EXE 尾部 ===' -ForegroundColor Cyan
$tarBytes = [IO.File]::ReadAllBytes($RELEASE_TAR)
[IO.File]::AppendAllBytes($SELF_EXE, $tarBytes)
[IO.File]::AppendAllBytes($SELF_EXE, [BitConverter]::GetBytes([long]$tarBytes.Length))
Write-Host '已嵌入内嵌包' -ForegroundColor Green

Move-Item $SELF_EXE $FINAL -Force
Remove-Item $RELEASE_TAR -Force
Remove-Item $CS_FILE -Force
Write-Host ''
Write-Host ('✅ 已生成单文件 EXE: ' + $FINAL) -ForegroundColor Green
Write-Host ('   大小: ' + [math]::Round((Get-Item $FINAL).Length / 1MB, 1) + ' MB') -ForegroundColor Green
Write-Host '   使用: 双击 EXE → 自动解压到同目录 zhixiang-ops-release/ → 自动启动并打开浏览器 http://localhost:8080' -ForegroundColor Cyan
