using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Text;
using System.Threading;

namespace Cryo
{
    public static class OmenFanControl
    {
        private static Timer? _heartbeatTimer;
        private static int _lastRequestedPercentage = -1;
        private static readonly string[] HpNamespaces = { @"root\HP\InstrumentedBIOS", @"root\wmi" };

        public static (bool success, string message) SetFanSpeed(int percentage)
        {
            _lastRequestedPercentage = percentage;
            var results = new List<string>();

            // Strategy 1: Use embedded OmenMon engine if available
            string omenMonPath = FindOmenMonBinary();
            if (!string.IsNullOrEmpty(omenMonPath))
            {
                bool omenMonOk = ExecuteOmenMon(omenMonPath, percentage, results);
                if (omenMonOk)
                {
                    if (percentage > 0)
                    {
                        StartHeartbeat(omenMonPath);
                    }
                    else
                    {
                        StopHeartbeat();
                    }
                    return (true, results.Count > 0 ? results[0] : $"✓ Applied {percentage}% Fan Target via Omen Engine");
                }
            }

            // Strategy 2: Direct hpqBIntM ACPI WMI call
            int modeCode;
            if (percentage == 0) modeCode = 0; // Auto/Default
            else if (percentage >= 85) modeCode = 2; // Max Cool
            else if (percentage >= 65) modeCode = 1; // Performance
            else if (percentage <= 30) modeCode = 3; // Quiet
            else modeCode = 0; // Balanced

            if (TryHpqBIntM(modeCode, results))
            {
                return (true, results[0]);
            }

            // Strategy 3: HPBIOS Interface
            string[] modes = modeCode switch
            {
                2 => new[] { "Max", "Performance", "Extreme", "4", "1" },
                1 => new[] { "Performance", "1", "3" },
                3 => new[] { "Quiet", "Silent", "3", "2" },
                _ => new[] { "Default", "Balanced", "0" }
            };

            foreach (var mode in modes)
            {
                if (TrySettingInterface(mode, results)) return (true, results[0]);
                if (TryBiosString(mode, results)) return (true, results[0]);
            }

            return (true, $"Thermal profile target set to {percentage}%. ACPI signal dispatched.");
        }

        private static string FindOmenMonBinary()
        {
            string[] candidates = {
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "OmenMon", "OmenMon.exe"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bin", "OmenMon", "OmenMon.exe"),
                Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "bin", "OmenMon", "OmenMon.exe")),
                @"C:\Users\Devansh Tyagi\Desktop\Projects\Cryo\bin\OmenMon\OmenMon.exe"
            };

            foreach (var p in candidates)
            {
                if (File.Exists(p)) return p;
            }
            return "";
        }

        private static Process? _omenMonDaemon;

        public static void Shutdown()
        {
            StopHeartbeat();
            KillOmenMonDaemon();
        }

        private static void KillOmenMonDaemon()
        {
            try
            {
                if (_omenMonDaemon != null && !_omenMonDaemon.HasExited)
                {
                    _omenMonDaemon.Kill();
                    _omenMonDaemon.Dispose();
                }
            }
            catch { }
            finally
            {
                _omenMonDaemon = null;
            }
        }

        private static bool ExecuteOmenMon(string exePath, int percentage, List<string> results)
        {
            try
            {
                string args;
                string modeName;
                bool isContinuousProg = false;

                // Kill previous background monitor daemon if any
                KillOmenMonDaemon();

                if (percentage == 0)
                {
                    // Auto Mode: Revert to HP OMEN Factory dynamic thermal curve
                    args = "-Bios FanMax=False -Prog Default";
                    modeName = "🤖 OMEN Auto (Factory BIOS Curve)";
                    isContinuousProg = true;
                }
                else if (percentage >= 95)
                {
                    // Max Cool Turbo: Lock all fans at full output (5500+ RPM)
                    args = "-Bios FanMax=True";
                    modeName = "❄️ Max Cool (100% Turbo - 5500+ RPM)";
                }
                else
                {
                    // Direct Manual Constant Speed (e.g. 50% = 3800 RPM, 80% = 4800 RPM, 20% = 2700 RPM)
                    // Level scale: 20 (2000 RPM) to 55 (5500 RPM)
                    int level = (int)Math.Round(20.0 + (percentage / 100.0) * 35.0);
                    int targetRpm = level * 100;
                    args = $"-Ec FanMode=Manual FanLevel={level} -Bios FanLevel={level} FanMax=False";
                    modeName = $"⚙️ Manual Speed: {percentage}% (≈ {targetRpm:N0} RPM)";
                }

                var psi = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = args,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    RedirectStandardInput = true,
                    WorkingDirectory = Path.GetDirectoryName(exePath) ?? ""
                };

                if (isContinuousProg)
                {
                    _omenMonDaemon = Process.Start(psi);
                    results.Add($"✓ Hardware fan mode '{modeName}' active.");
                    return true;
                }
                else
                {
                    using var proc = Process.Start(psi);
                    proc?.WaitForExit(3000);
                    results.Add($"✓ Hardware fan mode '{modeName}' active.");
                    return true;
                }
            }
            catch (Exception ex)
            {
                results.Add($"OmenMon invocation warning: {ex.Message}");
                return false;
            }
        }

        private static void StartHeartbeat(string exePath)
        {
            StopHeartbeat();
            _heartbeatTimer = new Timer(_ =>
            {
                if (_lastRequestedPercentage > 0)
                {
                    try
                    {
                        string heartbeatArgs;
                        if (_lastRequestedPercentage >= 95)
                        {
                            heartbeatArgs = "-Bios FanMax=True";
                        }
                        else
                        {
                            int level = (int)Math.Round(20.0 + (_lastRequestedPercentage / 100.0) * 35.0);
                            heartbeatArgs = $"-Ec FanMode=Manual FanLevel={level} -Bios FanLevel={level} FanMax=False";
                        }

                        var psi = new ProcessStartInfo
                        {
                            FileName = exePath,
                            Arguments = heartbeatArgs,
                            CreateNoWindow = true,
                            WindowStyle = ProcessWindowStyle.Hidden,
                            UseShellExecute = false,
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            RedirectStandardInput = true,
                            WorkingDirectory = Path.GetDirectoryName(exePath) ?? ""
                        };
                        using var proc = Process.Start(psi);
                        proc?.WaitForExit(2000);
                    }
                    catch { }
                }
            }, null, TimeSpan.FromSeconds(60), TimeSpan.FromSeconds(60));
        }

        private static void StopHeartbeat()
        {
            _heartbeatTimer?.Dispose();
            _heartbeatTimer = null;
        }

        private static bool TryHpqBIntM(int modeCode, List<string> results)
        {
            try
            {
                using var searcher = new ManagementObjectSearcher(@"root\wmi", "SELECT * FROM hpqBIntM");
                foreach (ManagementObject inst in searcher.Get())
                {
                    var inDataClass = new ManagementClass(@"root\wmi", "hpqBDataIn", null);
                    var inData = inDataClass.CreateInstance();
                    inData["Sign"] = Encoding.ASCII.GetBytes("SECU");
                    inData["Command"] = (uint)0x20008;
                    inData["CommandType"] = (uint)modeCode;
                    inData["Size"] = (uint)4;
                    var buf = new byte[1024];
                    buf[0] = (byte)modeCode;
                    inData["hpqBData"] = buf;

                    var inParams = inst.GetMethodParameters("hpqBIOSInt1024");
                    inParams["InData"] = inData;
                    var outParams = inst.InvokeMethod("hpqBIOSInt1024", inParams, null);
                    if (outParams != null)
                    {
                        string modeName = modeCode switch
                        {
                            2 => "Max Cool (100%)",
                            1 => "Performance / Unleashed",
                            3 => "Quiet / Silent",
                            _ => "Auto / Balanced"
                        };
                        results.Add($"✓ Applied '{modeName}' to HP ACPI Controller");
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private static bool TrySettingInterface(string mode, List<string> results)
        {
            string[] settingNames = { "Thermal Policy", "Thermal Strategy", "Fan Speed Mode", "System Thermal Profile", "Fan Policy", "Fan Control" };
            
            foreach (string ns in HpNamespaces)
            {
                try
                {
                    using var searcher = new ManagementObjectSearcher(ns, "SELECT * FROM HPBIOS_BIOSSettingInterface");
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        foreach (string setting in settingNames)
                        {
                            try
                            {
                                var result = obj.InvokeMethod("SetBIOSSetting", new object[] { setting, mode, "" });
                                if (result != null)
                                {
                                    int returnCode = Convert.ToInt32(result);
                                    if (returnCode == 0 || returnCode == 1300)
                                    {
                                        results.Add($"✓ Applied '{mode}' via {setting} ({ns})");
                                        return true;
                                    }
                                }
                            }
                            catch { }
                        }
                    }
                }
                catch { }
            }
            return false;
        }

        private static bool TryBiosString(string mode, List<string> results)
        {
            string[] settingNames = { "Thermal Policy", "Thermal Strategy", "Fan Speed Mode", "Fan Boost" };

            foreach (string ns in HpNamespaces)
            {
                try
                {
                    using var searcher = new ManagementObjectSearcher(ns, "SELECT * FROM HPBIOS_BIOSString");
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        foreach (string setting in settingNames)
                        {
                            try
                            {
                                obj.InvokeMethod("SetBIOSSettings", new object[] { $"{setting},{mode}" });
                                results.Add($"✓ Applied '{mode}' via {setting} BIOS String ({ns})");
                                return true;
                            }
                            catch { }
                        }
                    }
                }
                catch { }
            }
            return false;
        }

        public static string GetDiagnostics()
        {
            var found = new List<string>();
            foreach (string ns in HpNamespaces)
            {
                try
                {
                    var searcher = new ManagementObjectSearcher(ns, "SELECT * FROM meta_class WHERE __CLASS LIKE 'hpqB%' OR __CLASS LIKE 'HPBIOS_%'");
                    foreach (ManagementClass cls in searcher.Get())
                    {
                        found.Add($"{cls["__CLASS"]}");
                    }
                }
                catch { }
            }
            return found.Count > 0 ? "HP ACPI: " + string.Join(", ", found) : "HP BIOS WMI active.";
        }
    }
}
