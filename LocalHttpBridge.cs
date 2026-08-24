using System;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Cryo
{
    public class LocalHttpBridge
    {
        private HttpListener _listener;
        private bool _isRunning;
        private HardwareManager _hardwareManager;

        public LocalHttpBridge(HardwareManager hwManager, int port = 5050)
        {
            _hardwareManager = hwManager;
            _listener = new HttpListener();
            _listener.Prefixes.Add($"http://localhost:{port}/");
            _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
        }

        public void Start()
        {
            try
            {
                _listener.Start();
                _isRunning = true;
                Task.Run(ListenLoop);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[HttpBridge Warning] Could not start local HTTP server: {ex.Message}");
            }
        }

        public void Stop()
        {
            _isRunning = false;
            try { _listener.Stop(); } catch { }
        }

        private async Task ListenLoop()
        {
            while (_isRunning)
            {
                try
                {
                    var ctx = await _listener.GetContextAsync();
                    ProcessRequest(ctx);
                }
                catch
                {
                    if (!_isRunning) break;
                }
            }
        }

        private void ProcessRequest(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var res = ctx.Response;

            // Enable CORS
            res.AddHeader("Access-Control-Allow-Origin", "*");
            res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.AddHeader("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 204;
                res.Close();
                return;
            }

            try
            {
                string path = req.Url?.AbsolutePath ?? "/";
                string lowerPath = path.ToLowerInvariant();

                if (lowerPath == "/api/telemetry" && req.HttpMethod == "GET")
                {
                    var temps = new System.Collections.Generic.List<object>();
                    var fans = new System.Collections.Generic.List<object>();
                    var loads = new System.Collections.Generic.List<object>();

                    foreach (var s in _hardwareManager.AllTemperatures)
                        temps.Add(new { name = s.Name, value = s.Value });
                    foreach (var s in _hardwareManager.AllFans)
                        fans.Add(new { name = s.Name, value = s.Value });
                    foreach (var s in _hardwareManager.AllLoads)
                        loads.Add(new { name = s.Name, value = s.Value });

                    var payload = new
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
                    };

                    byte[] data = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));
                    res.ContentType = "application/json";
                    res.ContentLength64 = data.Length;
                    res.OutputStream.Write(data, 0, data.Length);
                }
                else if (lowerPath == "/api/set-fan-speed" && req.HttpMethod == "POST")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = reader.ReadToEnd();
                    using var doc = JsonDocument.Parse(body);
                    int speed = doc.RootElement.GetProperty("speed").GetInt32();

                    var (ok, msg) = OmenFanControl.SetFanSpeed(speed);
                    var result = new { success = ok, message = msg, speed };

                    byte[] data = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(result));
                    res.ContentType = "application/json";
                    res.ContentLength64 = data.Length;
                    res.OutputStream.Write(data, 0, data.Length);
                }
                else if (lowerPath == "/api/set-power-plan" && req.HttpMethod == "POST")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = reader.ReadToEnd();
                    using var doc = JsonDocument.Parse(body);
                    string plan = doc.RootElement.GetProperty("plan").GetString() ?? "Balanced";

                    bool ok = PowerManager.SetPlan(plan);
                    var result = new { success = ok, plan };

                    byte[] data = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(result));
                    res.ContentType = "application/json";
                    res.ContentLength64 = data.Length;
                    res.OutputStream.Write(data, 0, data.Length);
                }
                else if (lowerPath == "/api/purge-ram" && req.HttpMethod == "POST")
                {
                    long freed = _hardwareManager.PurgeRam();
                    var result = new { success = true, freedBytes = freed, message = "Purged inactive standby working sets." };
                    byte[] data = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(result));
                    res.ContentType = "application/json";
                    res.ContentLength64 = data.Length;
                    res.OutputStream.Write(data, 0, data.Length);
                }
                else
                {
                    // Serve static files from ui/dist
                    ServeStaticFile(path, res);
                }
            }
            catch (Exception ex)
            {
                res.StatusCode = 500;
                byte[] err = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { error = ex.Message }));
                res.OutputStream.Write(err, 0, err.Length);
            }
            finally
            {
                try { res.Close(); } catch { }
            }
        }

        private void ServeStaticFile(string relativePath, HttpListenerResponse res)
        {
            if (relativePath == "/" || string.IsNullOrEmpty(relativePath))
                relativePath = "/index.html";

            string distFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ui", "dist");
            if (!Directory.Exists(distFolder))
            {
                string altDist = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "ui", "dist"));
                if (Directory.Exists(altDist)) distFolder = altDist;
            }

            string filePath = Path.Combine(distFolder, relativePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

            if (File.Exists(filePath))
            {
                string ext = Path.GetExtension(filePath).ToLowerInvariant();
                res.ContentType = ext switch
                {
                    ".html" => "text/html; charset=utf-8",
                    ".js" => "application/javascript; charset=utf-8",
                    ".css" => "text/css; charset=utf-8",
                    ".svg" => "image/svg+xml",
                    ".png" => "image/png",
                    ".jpg" or ".jpeg" => "image/jpeg",
                    ".json" => "application/json",
                    _ => "application/octet-stream"
                };

                byte[] content = File.ReadAllBytes(filePath);
                res.ContentLength64 = content.Length;
                res.OutputStream.Write(content, 0, content.Length);
            }
            else
            {
                // Fallback for SPA routing to index.html
                string indexPath = Path.Combine(distFolder, "index.html");
                if (File.Exists(indexPath))
                {
                    res.ContentType = "text/html; charset=utf-8";
                    byte[] content = File.ReadAllBytes(indexPath);
                    res.ContentLength64 = content.Length;
                    res.OutputStream.Write(content, 0, content.Length);
                }
                else
                {
                    res.StatusCode = 404;
                }
            }
        }
    }
}
