using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace Cryo
{
    public partial class MainWindow : Window
    {
        private HardwareManager _hardwareManager;

        public MainWindow()
        {
            InitializeComponent();
            _hardwareManager = new HardwareManager();
            _hardwareManager.StartMonitoring();
            
            // Push telemetry to the UI every 2 seconds
            _hardwareManager.PropertyChanged += (_, e) => SendTelemetry();

            InitializeAsync();
        }

        async void InitializeAsync()
        {
            try
            {
                string cacheFolder = Path.Combine(Path.GetTempPath(), "CryoWebView2Cache");
                var env = await CoreWebView2Environment.CreateAsync(null, cacheFolder);
                await webView.EnsureCoreWebView2Async(env);

                // Listen for messages FROM the React frontend
                webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

                string distFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui", "dist");
                if (!Directory.Exists(distFolder))
                {
                    MessageBox.Show($"UI folder not found:\n{distFolder}", "Cryo Error");
                    return;
                }

                // Serve local files via virtual host (bypasses file:// UAC restrictions)
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "cryo.app", distFolder, CoreWebView2HostResourceAccessKind.Allow);

                webView.Source = new Uri("https://cryo.app/index.html");

                // Send initial telemetry once page is ready
                webView.CoreWebView2.NavigationCompleted += (_, _) =>
                {
                    SendTelemetry();
                    // Send HP WMI diagnostic so the UI can show what's available
                    string diag = OmenFanControl.GetDiagnostics();
                    SendJson(new { type = "HP_DIAGNOSTICS", message = diag });
                };
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to initialize UI:\n{ex.Message}", "Cryo Error");
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
                    // Build sensor arrays
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
                            temps,
                            fans,
                            loads
                        }
                    });
                }
                catch { }
            });
        }

        private void SendJson(object payload)
        {
            try
            {
                string json = JsonSerializer.Serialize(payload);
                webView.CoreWebView2?.PostWebMessageAsString(json);
            }
            catch { }
        }

        protected override void OnClosed(EventArgs e)
        {
            base.OnClosed(e);
            _hardwareManager?.Close();
        }
    }
}