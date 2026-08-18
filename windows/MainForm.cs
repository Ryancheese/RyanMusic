using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace RyanMusic;

public sealed class MainForm : Form
{
    private const int DwmwaUseImmersiveDarkMode = 20;
    private const int DwmwaBorderColor = 34;
    private const int DwmwaCaptionColor = 35;
    private const int DwmwaTextColor = 36;

    private readonly WebView2 _webView = new();
    private bool _daylight;
    private Process? _phpProcess;
    private int _port = 18765;
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(2) };
    private NotifyIcon? _tray;
    private bool _forceExit;
    private bool _balloonShown;

    public MainForm()
    {
        Text = "RyanMusic";
        Width = 1280;
        Height = 860;
        MinimumSize = new Size(980, 700);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(8, 8, 14);
        ForeColor = Color.White;
        TrySetAppIcon();
        InitTray();

        _webView.Dock = DockStyle.Fill;
        Controls.Add(_webView);

        Load += async (_, _) =>
        {
            ApplyTitleBarTheme(_daylight);
            await BootstrapAsync();
        };
        FormClosing += OnFormClosingGuard;
        FormClosed += (_, _) =>
        {
            StopPhp();
            DisposeTray();
        };
        HandleCreated += (_, _) => ApplyTitleBarTheme(_daylight);
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private void ApplyTitleBarTheme(bool daylight)
    {
        _daylight = daylight;
        var color = daylight ? Color.FromArgb(245, 245, 244) : Color.FromArgb(9, 9, 11);
        BackColor = color;
        _webView.DefaultBackgroundColor = Color.FromArgb(255, color.R, color.G, color.B);
        if (!IsHandleCreated)
        {
            return;
        }

        try
        {
            var hwnd = Handle;
            var dark = daylight ? 0 : 1;
            _ = DwmSetWindowAttribute(hwnd, DwmwaUseImmersiveDarkMode, ref dark, sizeof(int));

            // COLORREF: 0x00BBGGRR
            var caption = daylight ? 0x00F4F5F5 : 0x000B0909;
            _ = DwmSetWindowAttribute(hwnd, DwmwaCaptionColor, ref caption, sizeof(int));
            _ = DwmSetWindowAttribute(hwnd, DwmwaBorderColor, ref caption, sizeof(int));
            var text = daylight ? 0x001C1917 : 0x00F5F4F4;
            _ = DwmSetWindowAttribute(hwnd, DwmwaTextColor, ref text, sizeof(int));
        }
        catch
        {
            // 旧系统忽略
        }
    }

    private void InitTray()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("打开 RyanMusic", null, (_, _) => RestoreFromTray());
        menu.Items.Add("复制手机访问地址", null, (_, _) => CopyLanUrl());
        menu.Items.Add("退出时询问", null, (_, _) => AppSettings.SetCloseAction(CloseAction.Ask));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("退出", null, (_, _) => ExitApplication());

        _tray = new NotifyIcon
        {
            Text = "RyanMusic",
            Visible = false,
            ContextMenuStrip = menu
        };
        try
        {
            _tray.Icon = Icon ?? SystemIcons.Application;
        }
        catch
        {
            _tray.Icon = SystemIcons.Application;
        }

        _tray.DoubleClick += (_, _) => RestoreFromTray();
        _tray.MouseClick += (_, e) =>
        {
            if (e.Button == MouseButtons.Left)
            {
                RestoreFromTray();
            }
        };
    }

    private void DisposeTray()
    {
        if (_tray == null)
        {
            return;
        }

        _tray.Visible = false;
        _tray.Dispose();
        _tray = null;
    }

    private void OnFormClosingGuard(object? sender, FormClosingEventArgs e)
    {
        if (_forceExit)
        {
            return;
        }

        if (e.CloseReason is CloseReason.WindowsShutDown or CloseReason.TaskManagerClosing)
        {
            return;
        }

        var pref = AppSettings.GetCloseAction();
        if (pref == CloseAction.Tray)
        {
            e.Cancel = true;
            MinimizeToTray();
            return;
        }

        if (pref == CloseAction.Exit)
        {
            return;
        }

        e.Cancel = true;
        using var dlg = new ClosePromptDialog();
        var result = dlg.ShowDialog(this);
        if (result == DialogResult.Cancel || dlg.ChosenAction == CloseAction.Ask)
        {
            return;
        }

        if (dlg.RememberChoice)
        {
            AppSettings.SetCloseAction(dlg.ChosenAction);
        }

        if (dlg.ChosenAction == CloseAction.Tray)
        {
            MinimizeToTray();
            return;
        }

        ExitApplication();
    }

    private void MinimizeToTray()
    {
        if (_tray == null)
        {
            return;
        }

        Hide();
        ShowInTaskbar = false;
        _tray.Visible = true;
        if (!_balloonShown)
        {
            _balloonShown = true;
            _tray.BalloonTipTitle = "RyanMusic";
            _tray.BalloonTipText = "已缩小到托盘，双击图标可重新打开。";
            _tray.ShowBalloonTip(2500);
        }
    }

    private void RestoreFromTray()
    {
        if (_tray != null)
        {
            _tray.Visible = false;
        }

        ShowInTaskbar = true;
        Show();
        if (WindowState == FormWindowState.Minimized)
        {
            WindowState = FormWindowState.Normal;
        }

        Activate();
        ApplyTitleBarTheme(_daylight);
    }

    private void ExitApplication()
    {
        _forceExit = true;
        if (_tray != null)
        {
            _tray.Visible = false;
        }

        Close();
    }

    private void TrySetAppIcon()
    {
        try
        {
            var exe = Environment.ProcessPath ?? Application.ExecutablePath;
            var icon = Icon.ExtractAssociatedIcon(exe);
            if (icon != null)
            {
                Icon = icon;
                return;
            }
        }
        catch
        {
            // fall through
        }

        try
        {
            var icoPath = Path.Combine(AppContext.BaseDirectory, "AppIcon.ico");
            if (File.Exists(icoPath))
            {
                Icon = new Icon(icoPath);
            }
        }
        catch
        {
            // ignore
        }
    }

    private async Task BootstrapAsync()
    {
        try
        {
            var webRoot = ResolveWebRoot();
            if (!Directory.Exists(webRoot) ||
                !Directory.Exists(Path.Combine(webRoot, "static")))
            {
                MessageBox.Show($"找不到站点目录：\n{webRoot}", "RyanMusic", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }

            _port = PickPort(18765);
            var node = FindNode();
            var serverJs = ResolveServerJs();
            if (node != null && serverJs != null)
            {
                StartNode(node, serverJs, webRoot, _port);
            }
            else if (serverJs == null)
            {
                MessageBox.Show(
                    "安装包缺少 server.mjs。\n请重新下载完整安装包，或从源码重新打包。",
                    "RyanMusic",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Close();
                return;
            }
            else
            {
                MessageBox.Show(
                    "未找到 Node.js。\n请安装 Node 22+，或使用已内嵌 Node 的安装包（推荐从 GitHub Releases 下载）。",
                    "RyanMusic",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Close();
                return;
            }

            // Program Files 下默认 UserData 无写权限 → E_ACCESSDENIED
            var options = new CoreWebView2EnvironmentOptions
            {
                AdditionalBrowserArguments = string.Join(" ",
                    "--enable-gpu",
                    "--enable-gpu-rasterization",
                    "--enable-zero-copy",
                    "--ignore-gpu-blocklist",
                    "--disable-features=CalculateNativeWinOcclusion")
            };
            var env = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: ResolveDataDir("WebView2"),
                options);
            await _webView.EnsureCoreWebView2Async(env);
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.UserAgent =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                "document.documentElement.classList.add('platform-windows-app');");
            await InjectNativeBridgesAsync();
            _webView.CoreWebView2.NavigationCompleted += async (_, args) =>
            {
                if (!args.IsSuccess) return;
                await Task.Delay(150);
                await SyncTitleBarFromPageAsync();
            };
            await WaitAndNavigateAsync();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"启动失败：{ex.Message}", "RyanMusic", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private async Task InjectNativeBridgesAsync()
    {
        // 兼容前端：webkit.messageHandlers.ryanSave / ryanChrome / ryanUpdate
        const string script = """
            (() => {
              window.webkit = window.webkit || {};
              window.webkit.messageHandlers = window.webkit.messageHandlers || {};
              const post = (payload) => {
                try { window.chrome.webview.postMessage(payload); } catch (e) {}
              };
              if (!window.webkit.messageHandlers.ryanSave) {
                window.webkit.messageHandlers.ryanSave = { postMessage: post };
              }
              window.webkit.messageHandlers.ryanChrome = { postMessage: post };
              window.webkit.messageHandlers.ryanUpdate = { postMessage: post };
            })();
            """;
        await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
    }

    private async Task SyncTitleBarFromPageAsync()
    {
        if (_webView.CoreWebView2 == null)
        {
            return;
        }

        try
        {
            var stored = await _webView.CoreWebView2.ExecuteScriptAsync(
                "localStorage.getItem('ryanmusic-theme')");
            ApplyTitleBarTheme(stored.Contains("daylight", StringComparison.OrdinalIgnoreCase));
        }
        catch
        {
            // 页面尚未写入主题
        }
    }

    private async Task WaitAndNavigateAsync()
    {
        var url = $"http://127.0.0.1:{_port}/";
        for (var i = 0; i < 50; i++)
        {
            try
            {
                using var resp = await Http.GetAsync(url);
                if ((int)resp.StatusCode is >= 200 and < 400)
                {
                    _webView.CoreWebView2.Navigate(url);
                    return;
                }
            }
            catch
            {
                // wait
            }
            await Task.Delay(200);
        }

        MessageBox.Show("服务启动超时，请重试", "RyanMusic", MessageBoxButtons.OK, MessageBoxIcon.Error);
        Close();
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            await HandleHostPayloadAsync(doc.RootElement);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"WebMessage error: {ex.Message}");
        }
    }

    private async Task HandleHostPayloadAsync(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.String)
        {
            var raw = root.GetString();
            if (string.IsNullOrWhiteSpace(raw) || raw[0] != '{')
            {
                return;
            }

            using var inner = JsonDocument.Parse(raw);
            await HandleHostPayloadAsync(inner.RootElement);
            return;
        }

        if (root.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        if (root.TryGetProperty("daylight", out var daylightEl)
            && daylightEl.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            ApplyTitleBarTheme(daylightEl.GetBoolean());
            return;
        }

        if (root.TryGetProperty("action", out var actionEl) && actionEl.ValueKind == JsonValueKind.String)
        {
            var action = actionEl.GetString();
            if (string.Equals(action, "check", StringComparison.OrdinalIgnoreCase))
            {
                await CheckAppUpdateAsync(replyToWeb: true);
                return;
            }

            if (string.Equals(action, "install", StringComparison.OrdinalIgnoreCase))
            {
                await InstallAppUpdateAsync(replyToWeb: true);
                return;
            }
        }

        if (!root.TryGetProperty("filename", out var filenameEl))
        {
            return;
        }

        try
        {
            var filename = SanitizeFilename(filenameEl.GetString() ?? "RyanMusic");
            using var dialog = new SaveFileDialog
            {
                FileName = filename,
                Filter = "All files|*.*",
                OverwritePrompt = true
            };
            if (dialog.ShowDialog(this) != DialogResult.OK)
            {
                return;
            }

            if (root.TryGetProperty("text", out var textEl) && textEl.ValueKind == JsonValueKind.String)
            {
                await File.WriteAllTextAsync(dialog.FileName, textEl.GetString() ?? "", Encoding.UTF8);
                ShowDownloadSuccess(dialog.FileName);
                return;
            }

            if (root.TryGetProperty("url", out var urlEl) && urlEl.ValueKind == JsonValueKind.String)
            {
                var url = urlEl.GetString();
                if (string.IsNullOrWhiteSpace(url))
                {
                    return;
                }

                if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                {
                    url = $"http://127.0.0.1:{_port}/{url.TrimStart('/')}";
                }

                using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
                using var resp = await client.GetAsync(url);
                resp.EnsureSuccessStatusCode();
                await using var fs = File.Create(dialog.FileName);
                await resp.Content.CopyToAsync(fs);
                ShowDownloadSuccess(dialog.FileName);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"保存失败：{ex.Message}", "RyanMusic", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    private void ShowDownloadSuccess(string path)
    {
        var name = Path.GetFileName(path);
        var result = MessageBox.Show(
            this,
            $"下载成功：{name}\n\n是否打开所在文件夹？",
            "RyanMusic",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Information);
        if (result != DialogResult.Yes)
        {
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"/select,\"{path}\"",
                UseShellExecute = true
            });
        }
        catch
        {
            // ignore
        }
    }

    private static string ResolveWebRoot()
    {
        var baseDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var candidates = new[]
        {
            Path.Combine(baseDir, "maicong-music"),
            Path.GetFullPath(Path.Combine(baseDir, "..", "maicong-music")),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "maicong-music")),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "maicong-music")),
        };
        foreach (var c in candidates)
        {
            if (Directory.Exists(c) && Directory.Exists(Path.Combine(c, "static")))
            {
                return c;
            }
        }
        return Path.Combine(baseDir, "maicong-music");
    }

    private static string? FindPhp()
    {
        // 安装包内嵌 PHP 优先，避免 PATH 里无 curl 的系统 PHP 抢先
        var candidates = new List<string>();
        void AddCandidate(string? path)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            var full = Path.GetFullPath(path);
            if (File.Exists(full) &&
                !candidates.Exists(x => string.Equals(x, full, StringComparison.OrdinalIgnoreCase)))
            {
                candidates.Add(full);
            }
        }

        AddCandidate(Path.Combine(AppContext.BaseDirectory, "php", "php.exe"));
        AddCandidate(Path.Combine(AppContext.BaseDirectory, "runtime", "php", "php.exe"));

        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            AddCandidate(Path.Combine(dir.Trim('"'), "php.exe"));
        }

        AddCandidate(@"C:\php\php.exe");
        AddCandidate(@"C:\Program Files\PHP\php.exe");
        AddCandidate(Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "PHP",
            "php.exe"));

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "where.exe",
                Arguments = "php",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = Process.Start(psi);
            var output = p?.StandardOutput.ReadToEnd() ?? "";
            p?.WaitForExit(3000);
            foreach (var line in output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (line.EndsWith("php.exe", StringComparison.OrdinalIgnoreCase))
                {
                    AddCandidate(line);
                }
            }
        }
        catch
        {
            // ignore
        }

        string? fallback = null;
        foreach (var exe in candidates)
        {
            if (PhpHasCurl(exe))
            {
                return exe;
            }

            fallback ??= exe;
        }

        return fallback;
    }

    private static bool PhpHasCurl(string phpExe)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = phpExe,
                Arguments = "-n -d extension_dir=ext -d extension=curl -m",
                WorkingDirectory = Path.GetDirectoryName(phpExe) ?? "",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = Process.Start(psi);
            if (p == null)
            {
                return false;
            }

            var output = p.StandardOutput.ReadToEnd() + "\n" + p.StandardError.ReadToEnd();
            if (!p.WaitForExit(8000))
            {
                try { p.Kill(entireProcessTree: true); } catch { }
                return false;
            }

            foreach (var line in output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (string.Equals(line, "curl", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            // 再试：依赖已有 php.ini（便携包场景）
            psi.Arguments = "-m";
            using var p2 = Process.Start(psi);
            if (p2 == null)
            {
                return false;
            }

            output = p2.StandardOutput.ReadToEnd();
            if (!p2.WaitForExit(8000))
            {
                try { p2.Kill(entireProcessTree: true); } catch { }
                return false;
            }

            return output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Any(line => string.Equals(line, "curl", StringComparison.OrdinalIgnoreCase));
        }
        catch
        {
            return false;
        }
    }

    private static int PickPort(int start)
    {
        for (var port = start; port < start + 40; port++)
        {
            try
            {
                var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, port);
                listener.Start();
                listener.Stop();
                return port;
            }
            catch
            {
                // busy
            }
        }
        return start;
    }

    private string _logPath = "";

    private void StartPhp(string phpPath, string webRoot, int port)
    {
        _logPath = Path.Combine(ResolveDataDir(), "ryanmusic-php.log");
        try
        {
            File.WriteAllText(
                _logPath,
                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] RyanMusic PHP log\r\nphp={phpPath}\r\nroot={webRoot}\r\nport={port}\r\nlan={FormatLanUrl(port)}\r\n\r\n");
            var hint = Path.Combine(ResolveDataDir(), "如何查看日志.txt");
            File.WriteAllText(
                hint,
                $"PHP 运行日志路径：\r\n{_logPath}\r\n\r\n可在资源管理器地址栏粘贴打开：\r\n{_logPath}\r\n",
                Encoding.UTF8);
        }
        catch
        {
            // ignore
        }

        var phpDir = Path.GetDirectoryName(phpPath) ?? "";
        var iniPath = EnsurePhpIni(phpDir); // 可能写到 LocalAppData，避免 Program Files 拒绝访问

        var args = new StringBuilder();
        if (!string.IsNullOrEmpty(iniPath))
        {
            args.Append("-c \"").Append(iniPath).Append("\" ");
        }
        args.Append("-S 0.0.0.0:").Append(port);
        args.Append(" -t \"").Append(webRoot).Append('"');

        var psi = new ProcessStartInfo
        {
            FileName = phpPath,
            Arguments = args.ToString(),
            WorkingDirectory = webRoot,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        // 音源缓存写到可写目录（Program Files 下 core/cache 无写权限）
        psi.Environment["RYANMUSIC_CACHE_DIR"] = ResolveDataDir("cache");
        _phpProcess = new Process { StartInfo = psi, EnableRaisingEvents = true };
        _phpProcess.OutputDataReceived += (_, e) => AppendLog(e.Data);
        _phpProcess.ErrorDataReceived += (_, e) => AppendLog(e.Data);
        if (!_phpProcess.Start())
        {
            throw new InvalidOperationException("无法启动 PHP 进程");
        }
        _phpProcess.BeginOutputReadLine();
        _phpProcess.BeginErrorReadLine();
    }

    private static string? ResolveServerJs()
    {
        var baseDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var candidates = new[]
        {
            Path.Combine(baseDir, "server.mjs"),
            Path.Combine(baseDir, "server", "dist", "server.mjs"),
            Path.GetFullPath(Path.Combine(baseDir, "..", "server", "dist", "server.mjs")),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "server", "dist", "server.mjs")),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "server", "dist", "server.mjs")),
        };
        foreach (var c in candidates)
        {
            if (File.Exists(c))
            {
                return c;
            }
        }
        return null;
    }

    private static string? FindNode()
    {
        var candidates = new List<string>();
        void AddCandidate(string? path)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            var full = Path.GetFullPath(path);
            if (File.Exists(full) &&
                !candidates.Exists(x => string.Equals(x, full, StringComparison.OrdinalIgnoreCase)))
            {
                candidates.Add(full);
            }
        }

        AddCandidate(Path.Combine(AppContext.BaseDirectory, "node", "node.exe"));
        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            AddCandidate(Path.Combine(dir.Trim('"'), "node.exe"));
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "where.exe",
                Arguments = "node",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = Process.Start(psi);
            var output = p?.StandardOutput.ReadToEnd() ?? "";
            p?.WaitForExit(3000);
            foreach (var line in output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (line.EndsWith("node.exe", StringComparison.OrdinalIgnoreCase))
                {
                    AddCandidate(line);
                }
            }
        }
        catch
        {
            // ignore
        }

        return candidates.Count > 0 ? candidates[0] : null;
    }

    private void StartNode(string nodePath, string serverJs, string webRoot, int port)
    {
        _logPath = Path.Combine(ResolveDataDir(), "ryanmusic-server.log");
        try
        {
            File.WriteAllText(
                _logPath,
                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] RyanMusic Node log\r\nnode={nodePath}\r\nserver={serverJs}\r\nroot={webRoot}\r\nport={port}\r\nlan={FormatLanUrl(port)}\r\n\r\n");
        }
        catch
        {
            // ignore
        }

        var psi = new ProcessStartInfo
        {
            FileName = nodePath,
            Arguments =
                $"\"{serverJs}\" --listen 0.0.0.0 --port {port} --web-root \"{webRoot}\" --cache-dir \"{ResolveDataDir("cache")}\"",
            WorkingDirectory = webRoot,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        psi.Environment["RYANMUSIC_CACHE_DIR"] = ResolveDataDir("cache");
        _phpProcess = new Process { StartInfo = psi, EnableRaisingEvents = true };
        _phpProcess.OutputDataReceived += (_, e) => AppendLog(e.Data);
        _phpProcess.ErrorDataReceived += (_, e) => AppendLog(e.Data);
        if (!_phpProcess.Start())
        {
            throw new InvalidOperationException("无法启动 Node 服务");
        }
        _phpProcess.BeginOutputReadLine();
        _phpProcess.BeginErrorReadLine();
    }

    private void CopyLanUrl()
    {
        var url = FormatLanUrl(_port);
        if (string.IsNullOrEmpty(url) || url.Contains("未检测到"))
        {
            MessageBox.Show(
                "未检测到局域网地址。请确认电脑已连 Wi‑Fi。",
                "RyanMusic",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        try
        {
            Clipboard.SetText(url);
        }
        catch
        {
            // ignore
        }

        if (_tray != null)
        {
            _tray.Visible = true;
            _tray.ShowBalloonTip(4000, "RyanMusic", "已复制手机访问地址：\n" + url, ToolTipIcon.Info);
        }
        else
        {
            MessageBox.Show("手机访问地址：\n" + url, "RyanMusic", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }

    private static string FormatLanUrl(int port)
    {
        var ip = GetLanIPv4();
        return ip == null ? "未检测到局域网 IP" : $"http://{ip}:{port}/";
    }

    private static string? GetLanIPv4()
    {
        try
        {
            foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.OperationalStatus != OperationalStatus.Up)
                {
                    continue;
                }
                if (nic.NetworkInterfaceType is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel)
                {
                    continue;
                }

                foreach (var addr in nic.GetIPProperties().UnicastAddresses)
                {
                    if (addr.Address.AddressFamily != AddressFamily.InterNetwork)
                    {
                        continue;
                    }
                    var ip = addr.Address;
                    if (IPAddress.IsLoopback(ip))
                    {
                        continue;
                    }
                    var text = ip.ToString();
                    if (text.StartsWith("169.254.", StringComparison.Ordinal))
                    {
                        continue;
                    }
                    return text;
                }
            }
        }
        catch
        {
            // ignore
        }
        return null;
    }

    private static string ResolveDataDir(string? subdir = null)
    {
        var dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "RyanMusic");
        if (!string.IsNullOrWhiteSpace(subdir))
        {
            dir = Path.Combine(dir, subdir);
        }
        Directory.CreateDirectory(dir);
        return dir;
    }

    private void AppendLog(string? line)
    {
        if (string.IsNullOrEmpty(line) || string.IsNullOrEmpty(_logPath))
        {
            return;
        }
        try
        {
            File.AppendAllText(_logPath, line + Environment.NewLine);
        }
        catch
        {
            // ignore
        }
    }

    /// <summary>
    /// 确保 curl 等扩展启用。优先改安装目录 php.ini；若无写权限则复制到 LocalAppData。
    /// </summary>
    private static string? EnsurePhpIni(string phpDir)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(phpDir) || !Directory.Exists(phpDir))
            {
                return null;
            }

            var bundledIni = Path.Combine(phpDir, "php.ini");
            string? sourceIni = File.Exists(bundledIni) ? bundledIni : null;
            if (sourceIni == null)
            {
                foreach (var name in new[] { "php.ini-development", "php.ini-production" })
                {
                    var src = Path.Combine(phpDir, name);
                    if (File.Exists(src))
                    {
                        sourceIni = src;
                        break;
                    }
                }
            }

            var lines = sourceIni != null
                ? File.ReadAllLines(sourceIni).ToList()
                : new List<string>();
            var extDir = Path.Combine(phpDir, "ext").Replace('\\', '/');

            void Upsert(string keyPattern, string valueLine)
            {
                for (var i = 0; i < lines.Count; i++)
                {
                    if (System.Text.RegularExpressions.Regex.IsMatch(lines[i], keyPattern))
                    {
                        lines[i] = valueLine;
                        return;
                    }
                }
                lines.Add(valueLine);
            }

            Upsert(@"^\s*;?\s*extension_dir\s*=", $"extension_dir=\"{extDir}\"");
            foreach (var ext in new[] { "curl", "openssl", "mbstring", "fileinfo" })
            {
                Upsert($@"^\s*;?\s*extension\s*=\s*{ext}\b", $"extension={ext}");
            }

            // 先尝试写回安装目录（绿色包场景）
            try
            {
                File.WriteAllLines(bundledIni, lines);
                return bundledIni;
            }
            catch (UnauthorizedAccessException)
            {
                // Program Files：落到可写目录
            }
            catch (IOException)
            {
                // fall through
            }

            var userIni = Path.Combine(ResolveDataDir("php"), "php.ini");
            File.WriteAllLines(userIni, lines);
            return userIni;
        }
        catch
        {
            return null;
        }
    }

    private sealed class ReleaseUpdateInfo
    {
        public bool Ok { get; init; }
        public bool HasUpdate { get; init; }
        public string Current { get; init; } = "";
        public string Latest { get; init; } = "";
        public string Notes { get; init; } = "";
        public string Url { get; init; } = "";
        public string? DownloadUrl { get; init; }
        public string Error { get; init; } = "";
    }

    private static string CurrentAppVersion()
    {
        var version = typeof(MainForm).Assembly.GetName().Version;
        if (version == null)
        {
            return "0";
        }

        return $"{version.Major}.{version.Minor}.{version.Build}";
    }

    private static int CompareSemver(string left, string right)
    {
        static int[] Parts(string value) =>
            value.TrimStart('v', 'V')
                .Split('.', StringSplitOptions.RemoveEmptyEntries)
                .Select(part => int.TryParse(part, out var n) ? n : 0)
                .ToArray();

        var a = Parts(left);
        var b = Parts(right);
        var len = Math.Max(a.Length, b.Length);
        for (var i = 0; i < len; i++)
        {
            var da = i < a.Length ? a[i] : 0;
            var db = i < b.Length ? b[i] : 0;
            if (da != db)
            {
                return da.CompareTo(db);
            }
        }

        return 0;
    }

    private void ReplyUpdate(object payload)
    {
        if (_webView.CoreWebView2 == null)
        {
            return;
        }

        var json = JsonSerializer.Serialize(payload);
        var script = $"window.__ryanUpdateResolve && window.__ryanUpdateResolve({json});";
        void Run()
        {
            _ = _webView.CoreWebView2.ExecuteScriptAsync(script);
        }

        if (InvokeRequired)
        {
            BeginInvoke(Run);
        }
        else
        {
            Run();
        }
    }

    private void ReplyUpdateProgress(double percent, string stage, long received = 0, long total = 0)
    {
        if (_webView.CoreWebView2 == null)
        {
            return;
        }

        var payload = new Dictionary<string, object?>
        {
            ["percent"] = Math.Round(Math.Clamp(percent, 0, 100), 1),
            ["stage"] = stage,
            ["received"] = received,
            ["total"] = total,
        };
        var json = JsonSerializer.Serialize(payload);
        var script = $"window.__ryanUpdateProgress && window.__ryanUpdateProgress({json});";
        void Run()
        {
            _ = _webView.CoreWebView2.ExecuteScriptAsync(script);
        }

        if (InvokeRequired)
        {
            BeginInvoke(Run);
        }
        else
        {
            Run();
        }
    }

    private async Task<ReleaseUpdateInfo> FetchLatestReleaseAsync()
    {
        var current = CurrentAppVersion();
        const string page = "https://github.com/Ryancheese/RyanMusic/releases/latest";
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
            client.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/vnd.github+json");
            client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", $"RyanMusic/{current}");
            using var resp = await client.GetAsync("https://api.github.com/repos/Ryancheese/RyanMusic/releases/latest");
            resp.EnsureSuccessStatusCode();
            await using var stream = await resp.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var root = doc.RootElement;
            var latest = (root.TryGetProperty("tag_name", out var tagEl) ? tagEl.GetString() : "")?.TrimStart('v', 'V') ?? "";
            var notes = root.TryGetProperty("body", out var bodyEl) ? bodyEl.GetString() ?? "" : "";
            var htmlUrl = root.TryGetProperty("html_url", out var urlEl) ? urlEl.GetString() ?? page : page;
            string? download = null;
            if (root.TryGetProperty("assets", out var assets) && assets.ValueKind == JsonValueKind.Array)
            {
                foreach (var asset in assets.EnumerateArray())
                {
                    var name = (asset.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : "")?.ToLowerInvariant() ?? "";
                    if (name.Contains("setup") && name.EndsWith(".exe", StringComparison.Ordinal))
                    {
                        download = asset.TryGetProperty("browser_download_url", out var dlEl) ? dlEl.GetString() : null;
                        break;
                    }
                }

                if (download == null)
                {
                    foreach (var asset in assets.EnumerateArray())
                    {
                        var name = (asset.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : "")?.ToLowerInvariant() ?? "";
                        if (name.Contains("ryanmusic") && name.EndsWith(".exe", StringComparison.Ordinal))
                        {
                            download = asset.TryGetProperty("browser_download_url", out var dlEl) ? dlEl.GetString() : null;
                            break;
                        }
                    }
                }
            }

            var newer = !string.IsNullOrWhiteSpace(latest) && CompareSemver(current, latest) < 0;
            return new ReleaseUpdateInfo
            {
                Ok = true,
                HasUpdate = newer,
                Current = current,
                Latest = latest,
                Notes = notes,
                Url = htmlUrl,
                DownloadUrl = download,
                Error = newer && string.IsNullOrWhiteSpace(download) ? "发布页里没有 Windows 安装包" : "",
            };
        }
        catch (Exception ex)
        {
            return new ReleaseUpdateInfo
            {
                Ok = false,
                HasUpdate = false,
                Current = current,
                Url = page,
                Error = ex.Message,
            };
        }
    }

    private async Task CheckAppUpdateAsync(bool replyToWeb)
    {
        var info = await FetchLatestReleaseAsync();
        if (!replyToWeb)
        {
            return;
        }

        ReplyUpdate(new
        {
            ok = info.Ok,
            hasUpdate = info.HasUpdate,
            current = info.Current,
            latest = info.Latest,
            notes = info.Notes,
            url = info.Url,
            error = info.Error,
        });
    }

    private async Task InstallAppUpdateAsync(bool replyToWeb)
    {
        var info = await FetchLatestReleaseAsync();
        if (!info.HasUpdate || string.IsNullOrWhiteSpace(info.DownloadUrl))
        {
            var error = string.IsNullOrWhiteSpace(info.Error) ? "没有可安装的更新" : info.Error;
            if (replyToWeb)
            {
                ReplyUpdate(new
                {
                    ok = false,
                    hasUpdate = info.HasUpdate,
                    current = info.Current,
                    latest = info.Latest,
                    url = info.Url,
                    error,
                });
            }

            return;
        }

        try
        {
            ReplyUpdateProgress(0, "开始下载…");
            var setupPath = Path.Combine(Path.GetTempPath(), "RyanMusic-Setup-update.exe");
            if (File.Exists(setupPath))
            {
                File.Delete(setupPath);
            }

            using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(30) };
            client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", $"RyanMusic/{info.Current}");
            using var resp = await client.GetAsync(info.DownloadUrl, HttpCompletionOption.ResponseHeadersRead);
            resp.EnsureSuccessStatusCode();
            var total = resp.Content.Headers.ContentLength ?? -1L;
            await using (var input = await resp.Content.ReadAsStreamAsync())
            await using (var output = File.Create(setupPath))
            {
                var buffer = new byte[81920];
                long received = 0;
                var lastReport = DateTime.UtcNow;
                int read;
                while ((read = await input.ReadAsync(buffer.AsMemory(0, buffer.Length))) > 0)
                {
                    await output.WriteAsync(buffer.AsMemory(0, read));
                    received += read;
                    var now = DateTime.UtcNow;
                    if ((now - lastReport).TotalMilliseconds < 120 && received != total)
                    {
                        continue;
                    }

                    lastReport = now;
                    var percent = total > 0 ? received * 100.0 / total : Math.Min(95, received / (1024.0 * 1024.0));
                    ReplyUpdateProgress(percent, "正在下载安装包…", received, total);
                }
            }

            ReplyUpdateProgress(100, "准备覆盖安装…");
            var installDir = Path.GetDirectoryName(Application.ExecutablePath)?.TrimEnd('\\', '/')
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "RyanMusic");
            var exePath = Path.Combine(installDir, "RyanMusic.exe");
            var batPath = Path.Combine(Path.GetTempPath(), $"ryanmusic-update-{Environment.ProcessId}.cmd");
            var bat = $"""
                @echo off
                setlocal
                :wait
                tasklist /FI "PID eq {Environment.ProcessId}" 2>NUL | find "{Environment.ProcessId}" >NUL
                if not errorlevel 1 (
                  timeout /t 1 /nobreak >NUL
                  goto wait
                )
                "{setupPath}" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS /FORCECLOSEAPPLICATIONS /DIR="{installDir}"
                if exist "{exePath}" start "" "{exePath}"
                del /f /q "{setupPath}" >NUL 2>&1
                del /f /q "%~f0" >NUL 2>&1
                """;
            await File.WriteAllTextAsync(batPath, bat, Encoding.ASCII);
            Process.Start(new ProcessStartInfo
            {
                FileName = batPath,
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true,
            });

            if (replyToWeb)
            {
                ReplyUpdate(new
                {
                    ok = true,
                    hasUpdate = true,
                    installing = true,
                    current = info.Current,
                    latest = info.Latest,
                    url = info.Url,
                    progress = 100,
                    stage = "即将重启…",
                });
            }

            await Task.Delay(400);
            _forceExit = true;
            if (InvokeRequired)
            {
                BeginInvoke(Close);
            }
            else
            {
                Close();
            }
        }
        catch (Exception ex)
        {
            if (replyToWeb)
            {
                ReplyUpdate(new
                {
                    ok = false,
                    hasUpdate = true,
                    current = info.Current,
                    latest = info.Latest,
                    url = info.Url,
                    error = ex.Message,
                });
            }
        }
    }

    private void StopPhp()
    {
        try
        {
            if (_phpProcess is { HasExited: false })
            {
                _phpProcess.Kill(entireProcessTree: true);
                _phpProcess.WaitForExit(2000);
            }
        }
        catch
        {
            // ignore
        }
        finally
        {
            _phpProcess?.Dispose();
            _phpProcess = null;
        }
    }

    private static string SanitizeFilename(string name)
    {
        foreach (var c in Path.GetInvalidFileNameChars())
        {
            name = name.Replace(c, '_');
        }
        name = name.Trim();
        return string.IsNullOrWhiteSpace(name) ? "RyanMusic" : name;
    }
}
