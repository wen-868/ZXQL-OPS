using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;

// OPS-SECURITY-DESKTOP-MODERNIZATION-01：安装器进程参数纯函数构造层。
// tar.exe 调用使用 ArgumentList，禁止字符串拼接。
public static class InstallerCommandBuilder
{
    public static ProcessStartInfo BuildExtractTar(string tarExe, string payload, string outDir)
    {
        if (string.IsNullOrEmpty(tarExe)) throw new ArgumentException("tarExe required", "tarExe");
        if (string.IsNullOrEmpty(payload)) throw new ArgumentException("payload required", "payload");
        if (string.IsNullOrEmpty(outDir)) throw new ArgumentException("outDir required", "outDir");
        var psi = new ProcessStartInfo(tarExe)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        psi.ArgumentList.Add("-xf");
        psi.ArgumentList.Add(payload);
        psi.ArgumentList.Add("-C");
        psi.ArgumentList.Add(outDir);
        return psi;
    }

    public static IReadOnlyList<string> ExpectedExtractArgs(string payload, string outDir)
    {
        return new[] { "-xf", payload, "-C", outDir };
    }
}
