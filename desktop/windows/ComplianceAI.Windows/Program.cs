using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Diagnostics;
using System.Net.Http;
using System.Net.Sockets;
using System.Text;

namespace ComplianceAI.Windows;

internal static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}

internal sealed class MainForm : Form
{
    private readonly WebView2 _webView;
    private Process? _serverProcess;
    private readonly string _baseDir;
    private readonly string _webDir;
    private readonly string _pythonDir;
    private readonly int _port;

    public MainForm()
    {
        _baseDir = AppContext.BaseDirectory;
        _webDir = Path.Combine(_baseDir, "payload", "web");
        _pythonDir = Path.Combine(_baseDir, "python");
        _port = GetFreePort();

        Text = "ComplianceAI";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1200, 820);
        ClientSize = new Size(1440, 960);

        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.White,
        };

        Controls.Add(_webView);
        FormClosing += OnFormClosing;
        Shown += async (_, __) => await StartAsync();
    }

    private async Task StartAsync()
    {
        try
        {
            EnsureBundle();
            StartServer();
            await WaitForServerAsync();

            var userDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "ComplianceAI",
                "WebView2");
            Directory.CreateDirectory(userDataDir);

            var env = await CoreWebView2Environment.CreateAsync(null, userDataDir);
            await _webView.EnsureCoreWebView2Async(env);
            _webView.Source = new Uri($"http://127.0.0.1:{_port}/");
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"ComplianceAI 启动失败\n\n{ex.Message}",
                "ComplianceAI",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }
    }

    private void EnsureBundle()
    {
        string[] requiredPaths =
        {
            Path.Combine(_webDir, "server_entry.py"),
            Path.Combine(_webDir, "app.py"),
            Path.Combine(_webDir, "templates"),
            Path.Combine(_baseDir, "payload", "projects", "data-compliance-ai-project-kit", "knowledge-base", "local-regulations.sqlite3"),
            Path.Combine(_pythonDir, "python.exe"),
        };

        foreach (var path in requiredPaths)
        {
            if (!File.Exists(path) && !Directory.Exists(path))
            {
                throw new InvalidOperationException($"缺少运行资源：{path}");
            }
        }
    }

    private void StartServer()
    {
        var pythonExe = Path.Combine(_pythonDir, "python.exe");
        var startInfo = new ProcessStartInfo
        {
            FileName = pythonExe,
            WorkingDirectory = _webDir,
            Arguments = $"server_entry.py --port {_port}",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };

        startInfo.Environment["COMPLIANCEAI_PYTHON"] = pythonExe;
        startInfo.Environment["PYTHONUNBUFFERED"] = "1";

        _serverProcess = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        _serverProcess.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrWhiteSpace(e.Data))
            {
                Debug.WriteLine(e.Data);
            }
        };
        _serverProcess.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrWhiteSpace(e.Data))
            {
                Debug.WriteLine(e.Data);
            }
        };
        _serverProcess.Start();
        _serverProcess.BeginOutputReadLine();
        _serverProcess.BeginErrorReadLine();
    }

    private async Task WaitForServerAsync()
    {
        using var client = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(2)
        };
        var deadline = DateTime.UtcNow.AddSeconds(45);
        var uri = new Uri($"http://127.0.0.1:{_port}/");

        while (DateTime.UtcNow < deadline)
        {
            try
            {
                var response = await client.GetAsync(uri);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch
            {
                // wait and retry
            }

            await Task.Delay(300);
        }

        throw new TimeoutException("应用启动超时，请检查打包资源是否完整。");
    }

    private void OnFormClosing(object? sender, FormClosingEventArgs e)
    {
        try
        {
            if (_serverProcess is { HasExited: false })
            {
                _serverProcess.Kill(entireProcessTree: true);
                _serverProcess.WaitForExit(2000);
            }
        }
        catch
        {
            // ignore shutdown errors
        }
    }

    private static int GetFreePort()
    {
        using var listener = new TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        return ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;
    }
}
