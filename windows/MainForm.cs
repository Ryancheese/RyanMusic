using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
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

    private readonly WebView2 _webView = new();
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
            ApplyDarkTitleBar();
            await BootstrapAsync();
        };
        FormClosing += OnFormClosingGuard;
        FormClosed += (_, _) =>
        {
            StopPhp();
            DisposeTray();
        };
        HandleCreated += (_, _) => ApplyDarkTitleBar();
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private void ApplyDarkTitleBar()
    {
        if (!IsHandleCreated)
        {
            return;
        }

        try
        {
            var hwnd = Handle;
            var dark = 1;
            _ = DwmSetWindowAttribute(hwnd, DwmwaUseImmersiveDarkMode, ref dark, sizeof(int));

            // COLORREF: 0x00BBGGRR，贴近应用背景 #08080e
            var caption = 0x0E0808;
            _ = DwmSetWindowAttribute(hwnd, DwmwaCaptionColor, ref caption, sizeof(int));
            var border = 0x0E0808;
            _ = DwmSetWindowAttribute(hwnd, DwmwaBorderColor, ref border, sizeof(int));
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
        ApplyDarkTitleBar();
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
            var php = FindPhp();
            if (php == null)
            {
                MessageBox.Show(
                    "未找到可用的 PHP（需启用 curl）。\n请重装 RyanMusic，或安装 PHP 并启用 curl 扩展。",
                    "RyanMusic",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Close();
                return;
            }

            if (!PhpHasCurl(php))
            {
                MessageBox.Show(
                    "当前 PHP 未启用 Curl 模块，无法启动。\n\n已检测到：\n" + php +
                    "\n\n请使用安装包自带 PHP，或在 php.ini 中启用 extension=curl 后重试。",
                    "RyanMusic",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Close();
                return;
            }

            var webRoot = ResolveWebRoot();
            if (!Directory.Exists(webRoot) || !File.Exists(Path.Combine(webRoot, "index.php")))
            {
                MessageBox.Show($"找不到站点目录：\n{webRoot}", "RyanMusic", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }

            _port = PickPort(18765);
            StartPhp(php, webRoot, _port);

            // Program Files 下默认 UserData 无写权限 → E_ACCESSDENIED
            var env = await CoreWebView2Environment.CreateAsync(
                userDataFolder: ResolveDataDir("WebView2"));
            await _webView.EnsureCoreWebView2Async(env);
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.UserAgent =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(
                "document.documentElement.classList.add('platform-windows-app');");
            await InjectNativeSaveBridgeAsync();
            await WaitAndNavigateAsync();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"启动失败：{ex.Message}", "RyanMusic", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private async Task InjectNativeSaveBridgeAsync()
    {
        // 兼容前端 canNativeSave()：提供 webkit.messageHandlers.ryanSave
        const string script = """
            (() => {
              if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ryanSave) return;
              window.webkit = window.webkit || {};
              window.webkit.messageHandlers = window.webkit.messageHandlers || {};
              window.webkit.messageHandlers.ryanSave = {
                postMessage: (payload) => {
                  try {
                    window.chrome.webview.postMessage(payload);
                  } catch (e) {}
                }
              };
            })();
            """;
        await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
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
            var root = doc.RootElement;
            if (!root.TryGetProperty("filename", out var filenameEl))
            {
                return;
            }

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
            if (Directory.Exists(c) && File.Exists(Path.Combine(c, "index.php")))
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
                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] RyanMusic PHP log\r\nphp={phpPath}\r\nroot={webRoot}\r\nport={port}\r\n\r\n");
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
        args.Append("-S 127.0.0.1:").Append(port);
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
