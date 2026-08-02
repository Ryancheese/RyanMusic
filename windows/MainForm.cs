using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace RyanMusic;

public sealed class MainForm : Form
{
    private readonly WebView2 _webView = new();
    private Process? _phpProcess;
    private int _port = 18765;
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(2) };

    public MainForm()
    {
        Text = "RyanMusic";
        Width = 1280;
        Height = 860;
        MinimumSize = new Size(980, 700);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(8, 8, 14);
        TrySetAppIcon();

        _webView.Dock = DockStyle.Fill;
        Controls.Add(_webView);

        Load += async (_, _) => await BootstrapAsync();
        FormClosed += (_, _) => StopPhp();
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
                    "未找到 PHP。\n请先安装 PHP 并加入 PATH，或用 winget：\nwinget install --id PHP.PHP.8.3 -e",
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
        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var exe = Path.Combine(dir.Trim('"'), "php.exe");
            if (File.Exists(exe))
            {
                return exe;
            }
        }

        var extras = new[]
        {
            @"C:\php\php.exe",
            @"C:\Program Files\PHP\php.exe",
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "PHP", "php.exe"),
            Path.Combine(AppContext.BaseDirectory, "php", "php.exe"),
            Path.Combine(AppContext.BaseDirectory, "runtime", "php", "php.exe"),
        };
        foreach (var exe in extras)
        {
            if (File.Exists(exe))
            {
                return exe;
            }
        }

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
                if (line.EndsWith("php.exe", StringComparison.OrdinalIgnoreCase) && File.Exists(line))
                {
                    return line;
                }
            }
        }
        catch
        {
            // ignore
        }

        return null;
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
