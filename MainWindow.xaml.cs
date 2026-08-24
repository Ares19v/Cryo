using System;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace Cryo
{
    public partial class MainWindow : Window
    {
        private HardwareManager _hardwareManager;
        private LocalHttpBridge _httpBridge;

        public MainWindow()
        {
            InitializeComponent();
            _hardwareManager = new HardwareManager();
            _hardwareManager.StartMonitoring();

            // Start HTTP bridge for external browsers / tools & internal WebView2
            _httpBridge = new LocalHttpBridge(_hardwareManager, 5050);
            _httpBridge.Start();
            
            // Push telemetry to the WebView2 UI whenever hardware updates
            _hardwareManager.PropertyChanged += (_, e) => SendTelemetry();

            Loaded += (_, _) => InitializeAsync();
        }

        async void InitializeAsync()
        {
            try
            {
                string cacheFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Cryo", "WebView2Data");
                if (!Directory.Exists(cacheFolder))
                {
                    Directory.CreateDirectory(cacheFolder);
                }

                var options = new CoreWebView2EnvironmentOptions("--disable-features=RendererCodeIntegrity --allow-insecure-localhost --disable-gpu-sandbox");
                var env = await CoreWebView2Environment.CreateAsync(null, cacheFolder, options);
                await webView.EnsureCoreWebView2Async(env);

                // Listen for messages FROM the React frontend
                webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

                // Priority 1: Check if Vite dev server is active on localhost:5173
                bool devServerRunning = false;
                try
                {
                    using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(400) };
                    var resp = await client.GetAsync("http://localhost:5173");
                    if (resp.IsSuccessStatusCode) devServerRunning = true;
                }
                catch { }

                if (devServerRunning)
                {
                    webView.Source = new Uri("http://localhost:5173");
                }
                else
                {
                    // Priority 2: Use internal HTTP server on port 5050
                    webView.Source = new Uri("http://localhost:5050/");
                }

                webView.CoreWebView2.NavigationCompleted += (_, args) =>
                {
                    if (!args.IsSuccess)
                    {
                        MessageBox.Show($"UI Navigation error: {args.WebErrorStatus}", "Cryo Diagnostics");
                    }
                    SendTelemetry();
                    string diag = OmenFanControl.GetDiagnostics();
                    SendJson(new { type = "HP_DIAGNOSTICS", message = diag });
                };

                webView.CoreWebView2.ProcessFailed += (_, args) =>
                {
                    MessageBox.Show($"Renderer process failed: {args.ProcessFailedKind} ({args.Reason})", "Cryo Error");
                };
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to initialize WebView2:\n{ex.Message}\n\nFallback: Open http://localhost:5050 in Chrome/Edge.", "Cryo Startup Diagnostics");
            }
        }

        /// <summary>
        /// Handle messages sent from React via window.chrome.webview.postMessage(...)
        /// </summary>
        private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string raw = e.TryGetWebMessageAsString();
                using var doc = JsonDocument.Parse(raw);
                string type = doc.RootElement.GetProperty("type").GetString() ?? "";

                switch (type)
                {
                    case "SET_POWER_PLAN":
                        string plan = doc.RootElement.GetProperty("plan").GetString() ?? "Balanced";
                        bool planOk = PowerManager.SetPlan(plan);
                        SendJson(new { type = "POWER_PLAN_RESULT", success = planOk, plan });
                        break;

                    case "SET_FAN_SPEED":
                        int speed = doc.RootElement.GetProperty("speed").GetInt32();
                        var (fanOk, msg) = OmenFanControl.SetFanSpeed(speed);
                        SendJson(new { type = "FAN_SPEED_RESULT", success = fanOk, message = msg, speed });
                        break;

                    case "PURGE_RAM":
                        long freed = _hardwareManager.PurgeRam();
                        SendJson(new { type = "PURGE_RAM_RESULT", success = true, freedBytes = freed });
                        break;

                    case "GET_TELEMETRY":
                        SendTelemetry();
                        break;
                }
            }
            catch (Exception ex)
            {
                SendJson(new { type = "ERROR", message = ex.Message });
            }
        }

        /// <summary>
        /// Push live sensor data to React
        /// </summary>
        private void SendTelemetry()
        {
            Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    var temps  = new System.Collections.Generic.List<object>();
                    var fans   = new System.Collections.Generic.List<object>();
                    var loads  = new System.Collections.Generic.List<object>();

                    foreach (var s in _hardwareManager.AllTemperatures)
                        temps.Add(new { name = s.Name, value = s.Value });
                    foreach (var s in _hardwareManager.AllFans)
                        fans.Add(new { name = s.Name, value = s.Value });
                    foreach (var s in _hardwareManager.AllLoads)
                        loads.Add(new { name = s.Name, value = s.Value });

                    SendJson(new
                    {
                        type = "TELEMETRY",
                        payload = new
                        {
                            cpuTemp = _hardwareManager.CpuTemperature,
                            gpuTemp = _hardwareManager.GpuTemperature,
                            cpuLoad = _hardwareManager.CpuLoad,
                            gpuLoad = _hardwareManager.GpuLoad,
                            gpuVram = _hardwareManager.GpuVram,
                            gpuPower = _hardwareManager.GpuPower,
                            gpuClock = _hardwareManager.GpuClock,
                            ramUsed = _hardwareManager.RamUsed,
                            ramTotal = _hardwareManager.RamTotal,
                            ramPercent = _hardwareManager.RamPercent,
                            powerSource = _hardwareManager.PowerSource,
                            batteryPercent = _hardwareManager.BatteryPercent,
                            perCoreTemps = _hardwareManager.PerCoreTemps,
                            temps,
                            fans,
                            loads
                        }
                    });
                }
                catch { }
            });
        }

        private void SendJson(object obj)
        {
            try
            {
                if (webView?.CoreWebView2 != null)
                {
                    string json = JsonSerializer.Serialize(obj);
                    webView.CoreWebView2.PostWebMessageAsString(json);
                }
            }
            catch { }
        }

        protected override void OnClosed(EventArgs e)
        {
            OmenFanControl.Shutdown();
            _httpBridge?.Stop();
            _hardwareManager?.Close();
            base.OnClosed(e);
        }
    }
}