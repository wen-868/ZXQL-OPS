using System;
using System.Collections.Generic;
using System.Diagnostics;

// OPS-SECURITY-DESKTOP-MODERNIZATION-01：桌面进程参数的纯函数构造层。
// 所有受控调用点必须使用 ArgumentList（结构化参数数组），禁止拼接 Arguments 字符串。
// 可被契约测试与 mutation 探针引用。
public static class DesktopCommandBuilder
{
    public static readonly string SourceCommit = "2d24afd9e19f545c2cc502d957add68334c57381";

    public static ProcessStartInfo BuildStartService(string startPsPath, string baseDir)
    {
        if (string.IsNullOrEmpty(startPsPath)) throw new ArgumentException("startPsPath required", "startPsPath");
        if (string.IsNullOrEmpty(baseDir)) throw new ArgumentException("baseDir required", "baseDir");
        var psi = new ProcessStartInfo("powershell.exe")
        {
            WorkingDirectory = baseDir,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        psi.ArgumentList.Add("-NoProfile");
        psi.ArgumentList.Add("-ExecutionPolicy");
        psi.ArgumentList.Add("Bypass");
        psi.ArgumentList.Add("-File");
        psi.ArgumentList.Add(startPsPath);
        return psi;
    }

    public static ProcessStartInfo BuildRollbackService(string startPsPath, string baseDir)
    {
        var psi = BuildStartService(startPsPath, baseDir);
        psi.ArgumentList.Add("-Rollback");
        return psi;
    }

    // explorer.exe 无法通过 ArgumentList 可靠传递路径（Shell 行为），单独最小化处理：
    // 仅允许绝对路径作为单一参数，不拼接额外开关；使用 UseShellExecute=false 避免命令解释。
    public static ProcessStartInfo BuildOpenLogsExplorer(string logsDir)
    {
        if (string.IsNullOrEmpty(logsDir)) throw new ArgumentException("logsDir required", "logsDir");
        if (!System.IO.Path.IsPathRooted(logsDir)) throw new ArgumentException("logsDir must be absolute", "logsDir");
        var psi = new ProcessStartInfo("explorer.exe")
        {
            UseShellExecute = false,
            CreateNoWindow = false
        };
        // explorer 对 ArgumentList 支持有限；此处使用单一参数字符串但不来自用户拼接，仅传入受控绝对路径。
        // 路径若含引号/特殊字符由调用方保证为文件系统合法路径；不追加任何其他 token。
        psi.Arguments = QuoteSinglePath(logsDir);
        return psi;
    }

    internal static string QuoteSinglePath(string p)
    {
        // 仅用于 explorer 单参数场景；不做通用命令行拼接。
        if (p.IndexOf('"') >= 0) throw new ArgumentException("path contains quote", "p");
        return "\"" + p + "\"";
    }

    public static IReadOnlyList<string> ExpectedStartArgs(string startPsPath)
    {
        return new[] { "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", startPsPath };
    }

    public static IReadOnlyList<string> ExpectedRollbackArgs(string startPsPath)
    {
        return new[] { "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", startPsPath, "-Rollback" };
    }
}
