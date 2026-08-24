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

            // Enable CORS for browser dev server
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
                string path = req.Url?.AbsolutePath.ToLowerInvariant() ?? "";

                if (path == "/api/telemetry" && req.HttpMethod == "GET")
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
                        temps,
                        fans,
                        loads
                    };

                    byte[] data = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));
                    res.ContentType = "application/json";
                    res.ContentLength64 = data.Length;
                    res.OutputStream.Write(data, 0, data.Length);
                }
                else if (path == "/api/set-fan-speed" && req.HttpMethod == "POST")
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
                else if (path == "/api/set-power-plan" && req.HttpMethod == "POST")
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
                else
                {
                    res.StatusCode = 404;
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
    }
}
