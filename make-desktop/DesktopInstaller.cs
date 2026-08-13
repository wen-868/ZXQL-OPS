using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;

// 智享全链运营系统 · 桌面版安装器（自解压）
// 双击 → 解压 payload 到同目录 zhixiang-ops-desktop/ → 创建桌面快捷方式 → 启动桌面客户端。
// 编译：csc /nologo /target:winexe /platform:anycpu /optimize /out:DesktopInstaller.exe
//       /r:System.dll /r:System.Core.dll /r:System.Windows.Forms.dll /r:Microsoft.CSharp.dll
//       DesktopInstaller.cs
public class DesktopInstaller
{
    [STAThread]
    public static int Main()
    {
        try
        {
            string exe = System.Reflection.Assembly.GetExecutingAssembly().Location;
            string baseDir = Path.GetDirectoryName(exe);
            string outDir = Path.Combine(baseDir, "zhixiang-ops-desktop");
            string verFile = Path.Combine(outDir, "version.txt");
            string payload = Path.Combine(baseDir, "._payload.tar");
            string tarExe = "C:\\Windows\\system32\\tar.exe";

            // 读取尾部 8 字节 = 内嵌 tar 长度，流式写出（避免大文件整包入内存）
            long len;
            using (var fs = new FileStream(exe, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                fs.Seek(-8, SeekOrigin.End);
                byte[] tail = new byte[8];
                int got = 0; while (got < 8) { int r = fs.Read(tail, got, 8 - got); if (r == 0) break; got += r; }
                len = BitConverter.ToInt64(tail, 0);
                fs.Seek(fs.Length - 8 - len, SeekOrigin.Begin);
                using (var outf = new FileStream(payload, FileMode.Create, FileAccess.Write))
                {
                    byte[] buf = new byte[1 << 20];
                    long remaining = len;
                    while (remaining > 0)
                    {
                        int toRead = (int)Math.Min(buf.Length, remaining);
                        int r = fs.Read(buf, 0, toRead); if (r == 0) break;
                        outf.Write(buf, 0, r); remaining -= r;
                    }
                }
            }

            if (!File.Exists(verFile))
            {
                Directory.CreateDirectory(outDir);
                var psi = new ProcessStartInfo(tarExe, "-xf \"" + payload + "\" -C \"" + outDir + "\"")
                {
                    UseShellExecute = false, CreateNoWindow = true,
                    RedirectStandardOutput = true, RedirectStandardError = true
                };
                using (var p = Process.Start(psi))
                {
                    p.WaitForExit();
                    if (p.ExitCode != 0) MessageBox.Show("解压失败: " + p.StandardError.ReadToEnd(),
                        "智享全链运营系统", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            try { File.Delete(payload); } catch { }

            string appExe = Path.Combine(outDir, "ZXQLOpsDesktop.exe");
            if (!File.Exists(appExe))
            {
                MessageBox.Show("安装不完整：未找到 ZXQLOpsDesktop.exe", "智享全链运营系统",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }

            CreateShortcut(appExe, outDir);

            try
            {
                Process.Start(new ProcessStartInfo(appExe) { WorkingDirectory = outDir, UseShellExecute = true });
            }
            catch (Exception ex)
            {
                MessageBox.Show("启动桌面客户端失败: " + ex.Message, "智享全链运营系统",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show("安装失败: " + ex.Message, "智享全链运营系统",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private static void CreateShortcut(string targetExe, string workingDir)
    {
        try
        {
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string lnk = Path.Combine(desktop, "智享全链运营系统.lnk");
            dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            dynamic sc = shell.CreateShortcut(lnk);
            sc.TargetPath = targetExe;
            sc.WorkingDirectory = workingDir;
            sc.Description = "智享全链运营系统（短视频/直播带货运营）";
            sc.Save();
        }
        catch { }
    }
}