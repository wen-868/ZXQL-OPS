using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// 智享全链运营系统 · 原生桌面客户端（WinForms + WebView2，.NET Framework 4.8）
public class DesktopApp
{
    [DllImport("user32.dll")]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    [STAThread]
    public static int Main(string[] args)
    {
        // 高分屏清晰渲染：PerMonitorV2 DPI 感知（清单已声明，此处兜底，须在窗口创建前调用）
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { }
        bool createdNew;
        using (Mutex m = new Mutex(true, "ZXQL-Ops-Desktop-SingleInstance", out createdNew))
        {
            if (!createdNew)
            {
                MessageBox.Show("智享全链运营系统已在运行中。", "智享全链运营系统",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 0;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
            return 0;
        }
    }
}

public class MainForm : Form
{
    private WebView2 webView;
    private NotifyIcon tray;
    private System.Windows.Forms.Timer healthTimer;
    private ToolStripStatusLabel stMaria, stRedis, stBackend, stPortal, stInfo;
    private string baseDir;
    private bool servicesStarting;
    private bool shuttingDown;
    private const string PortalUrl = "http://localhost:8080/ops-app";
    private const int PortMaria = 3306, PortRedis = 6379, PortBackend = 3100, PortPortal = 8080;

    public MainForm()
    {
        baseDir = AppDomain.CurrentDomain.BaseDirectory;
Text = "智享全链运营系统";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Width = 1280;
        Height = 800;
        MinimumSize = new Size(960, 600);
        StartPosition = FormStartPosition.CenterScreen;

        BuildMenu();
        BuildStatusBar();
        BuildWebView();
        BuildTray();

        FormClosing += OnFormClosing;
        Load += OnLoad;
    }

    // ================= UI =================
    private void BuildMenu()
    {
        MenuStrip menu = new MenuStrip();
        ToolStripMenuItem mNav = new ToolStripMenuItem("导航(&N)");
        mNav.DropDownItems.Add(MakeItem("运营系统", "http://localhost:8080/ops-app"));
        mNav.DropDownItems.Add(MakeItem("运营决策看板", "http://localhost:8080/dashboard"));
        mNav.DropDownItems.Add(MakeItem("统一门户", "http://localhost:8080/portal.html"));
        menu.Items.Add(mNav);

        ToolStripMenuItem mSvc = new ToolStripMenuItem("服务(&S)");
        ToolStripMenuItem mRestart = new ToolStripMenuItem("重启服务");
        mRestart.Click += delegate { RestartServices(); };
        ToolStripMenuItem mOpenLog = new ToolStripMenuItem("打开日志目录");
        mOpenLog.Click += delegate { OpenLogDir(); };
        mSvc.DropDownItems.Add(mRestart);
        mSvc.DropDownItems.Add(mOpenLog);
        menu.Items.Add(mSvc);

        ToolStripMenuItem mHelp = new ToolStripMenuItem("帮助(&H)");
        ToolStripMenuItem mAbout = new ToolStripMenuItem("关于");
        mAbout.Click += delegate
        {
            MessageBox.Show("智享全链运营系统 v0.1.0\n\n本地部署 Web 服务 + 原生桌面客户端\n服务栈：MariaDB / Redis / Node 后端 / 统一门户\n\n默认账号：admin / Admin@123", "关于",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        };
        mHelp.DropDownItems.Add(mAbout);
        menu.Items.Add(mHelp);

        Controls.Add(menu);
        MainMenuStrip = menu;
    }

    private ToolStripMenuItem MakeItem(string text, string url)
    {
        ToolStripMenuItem it = new ToolStripMenuItem(text);
        it.Click += delegate { Navigate(url); };
        return it;
    }

    private void BuildStatusBar()
    {
        StatusStrip bar = new StatusStrip();
        stMaria  = new ToolStripStatusLabel("MariaDB: 检测中");
        stRedis  = new ToolStripStatusLabel("Redis: 检测中");
        stBackend = new ToolStripStatusLabel("后端: 检测中");
        stPortal = new ToolStripStatusLabel("门户: 检测中");
        stInfo   = new ToolStripStatusLabel("   ");
        bar.Items.Add(stMaria);
        bar.Items.Add(stRedis);
        bar.Items.Add(stBackend);
        bar.Items.Add(stPortal);
        bar.Items.Add(new ToolStripStatusLabel("|"));
        bar.Items.Add(stInfo);
        Controls.Add(bar);
    }

    private void BuildWebView()
    {
        webView = new WebView2();
        webView.Dock = DockStyle.Fill;
        Controls.Add(webView);
        webView.BringToFront();
    }

    private void BuildTray()
    {
        tray = new NotifyIcon();
        tray.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        tray.Text = "智享全链运营系统";
        tray.Visible = true;
        tray.DoubleClick += delegate { ShowMainWindow(); };
        ContextMenuStrip cm = new ContextMenuStrip();
        cm.Items.Add("显示主窗口", null, delegate { ShowMainWindow(); });
        cm.Items.Add("重启服务", null, delegate { RestartServices(); });
        cm.Items.Add("退出（停止全部服务）", null, delegate { ExitApp(); });
        tray.ContextMenuStrip = cm;
    }

    private void ShowMainWindow()
    {
        Show();
        WindowState = FormWindowState.Normal;
        Activate();
    }

    // ================= 服务生命周期 =================
    private void OnLoad(object sender, EventArgs e)
    {
        stInfo.Text = "正在检查服务…";
        healthTimer = new System.Windows.Forms.Timer();
        healthTimer.Interval = 3000;
        healthTimer.Tick += delegate { CheckServices(); };
        healthTimer.Start();
        StartServicesIfNeeded();
    }

    private bool IsPortOpen(int port)
    {
        try
        {
            using (TcpClient c = new TcpClient())
            {
                IAsyncResult ar = c.BeginConnect("127.0.0.1", port, null, null);
                if (!ar.AsyncWaitHandle.WaitOne(800)) return false;
                c.EndConnect(ar);
                return c.Connected;
            }
        }
        catch { return false; }
    }

    private bool IsBackendUp()
    {
        try
        {
            using (System.Net.WebClient w = new System.Net.WebClient())
            {
                string body = w.DownloadString("http://127.0.0.1:3100/api/ops/health");
                return body.IndexOf("\"ok\":true", StringComparison.OrdinalIgnoreCase) >= 0;
            }
        }
        catch { return false; }
    }

    private void StartServicesIfNeeded()
    {
        if (servicesStarting) return;
        if (IsPortOpen(PortPortal) && IsPortOpen(PortBackend)) { OnServicesReady(); return; }

        string startPs = Path.Combine(baseDir, "start.ps1");
        if (!File.Exists(startPs))
        {
            stInfo.Text = "未找到 start.ps1（安装不完整）";
            return;
        }
        servicesStarting = true;
        stInfo.Text = "正在启动本地服务（MariaDB/Redis/后端/门户）…";
        ProcessStartInfo psi = new ProcessStartInfo("powershell.exe",
            "-NoProfile -ExecutionPolicy Bypass -File \"" + startPs + "\"")
        {
            WorkingDirectory = baseDir,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        try
        {
            Process p = Process.Start(psi);
            stInfo.Text = "服务初始化中（首次约 1-2 分钟）…";
        }
        catch (Exception ex)
        {
            stInfo.Text = "启动服务失败: " + ex.Message;
            servicesStarting = false;
        }
    }

    private void OnServicesReady()
    {
        if (!servicesStarting && webView.CoreWebView2 != null) return;
        servicesStarting = false;
        stInfo.Text = "服务就绪";
        Navigate(PortalUrl);
    }

    private void CheckServices()
    {
        bool m = IsPortOpen(PortMaria), r = IsPortOpen(PortRedis),
             b = IsPortOpen(PortBackend), p = IsPortOpen(PortPortal);
        stMaria.Text  = "MariaDB: " + (m ? "● 运行中" : "○ 离线");
        stRedis.Text  = "Redis: "   + (r ? "● 运行中" : "○ 离线");
        stBackend.Text = "后端: "   + (b ? "● 运行中" : "○ 离线");
        stPortal.Text = "门户: "    + (p ? "● 运行中" : "○ 离线");
        stMaria.ForeColor  = m ? Color.ForestGreen : Color.Firebrick;
        stRedis.ForeColor  = r ? Color.ForestGreen : Color.Firebrick;
        stBackend.ForeColor = b ? Color.ForestGreen : Color.Firebrick;
        stPortal.ForeColor = p ? Color.ForestGreen : Color.Firebrick;

        if (!servicesStarting && p && b && webView.CoreWebView2 != null &&
            webView.CoreWebView2.Source.IndexOf("localhost") < 0)
        {
            Navigate(PortalUrl);
        }
    }

    private void Navigate(string url)
    {
        if (webView.CoreWebView2 == null)
        {
            InitWebView(url);
            return;
        }
        webView.CoreWebView2.Navigate(url);
    }

    private void InitWebView(string url)
    {
        try
        {
            string wvData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "ZXQL-Ops-Desktop", "WebView2");
            CoreWebView2Environment env =
                CoreWebView2Environment.CreateAsync(null, wvData).GetAwaiter().GetResult();
            webView.EnsureCoreWebView2Async(env).GetAwaiter().GetResult();
            webView.CoreWebView2.Navigate(url);
        }
        catch (Exception ex)
        {
            MessageBox.Show("WebView2 初始化失败（请确认系统已安装 WebView2 运行时）：\n" + ex.Message,
                "智享全链运营系统", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    // ================= 服务重启 / 退出 =================
    private void RestartServices()
    {
        RunRollbackAsync();
        servicesStarting = false;
        stInfo.Text = "正在重启服务…";
        Thread.Sleep(2500);
        StartServicesIfNeeded();
    }

    private void RunRollbackAsync()
    {
        string startPs = Path.Combine(baseDir, "start.ps1");
        if (!File.Exists(startPs)) return;
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo("powershell.exe",
                "-NoProfile -ExecutionPolicy Bypass -File \"" + startPs + "\" -Rollback")
            {
                WorkingDirectory = baseDir,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            Process p = Process.Start(psi);
            if (!p.WaitForExit(20000)) { try { p.Kill(); } catch { } }
        }
        catch { }
    }

    private void ExitApp()
    {
        shuttingDown = true;
        Close();
    }

    private void OnFormClosing(object sender, FormClosingEventArgs e)
    {
        if (shuttingDown)
        {
            tray.Visible = false;
            stInfo.Text = "正在停止服务…";
            RunRollbackAsync();
            return;
        }
        DialogResult dr = MessageBox.Show(
            "退出将停止全部本地服务（MariaDB/Redis/后端/门户）。\n\n确定退出？",
            "智享全链运营系统", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (dr != DialogResult.Yes)
        {
            e.Cancel = true;
            return;
        }
        tray.Visible = false;
        if (healthTimer != null) healthTimer.Stop();
        RunRollbackAsync();
    }

    private void OpenLogDir()
    {
        string logs = Path.Combine(baseDir, "logs");
        if (!Directory.Exists(logs)) Directory.CreateDirectory(logs);
        try { Process.Start("explorer.exe", "\"" + logs + "\""); } catch { }
    }
}