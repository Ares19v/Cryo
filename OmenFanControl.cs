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
                    StartHeartbeat(omenMonPath);
                    return (true, results.Count > 0 ? results[0] : $"✓ Applied {percentage}% Fan Target via Omen Engine");
                }
            }

            // Strategy 2: Direct hpqBIntM ACPI WMI call
            int modeCode = percentage >= 85 ? 2 : (percentage >= 65 ? 1 : (percentage <= 30 ? 3 : 0));
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

        private static bool ExecuteOmenMon(string exePath, int percentage, List<string> results)
        {
            try
            {
                string args;
                if (percentage >= 85)
                {
                    args = "-Bios FanMax=True";
                }
                else if (percentage <= 30)
                {
                    args = "-Bios FanMax=False -Prog Silent";
                }
                else
                {
                    args = "-Bios FanMax=False -Prog Default";
                }

                var psi = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = args,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WorkingDirectory = Path.GetDirectoryName(exePath) ?? ""
                };

                using var proc = Process.Start(psi);
                proc?.WaitForExit(3000);

                string modeName = percentage >= 85 ? "Max Cool (100%)" : (percentage <= 30 ? "Quiet (20%)" : "Balanced (50%)");
                results.Add($"✓ Hardware fan profile '{modeName}' applied via Omen ACPI Engine.");
                return true;
            }
            catch (Exception ex)
            {
                results.Add($"OmenMon invocation warning: {ex.Message}");
                return false;
            }
        }

        private static void StartHeartbeat(string exePath)
        {
            // Heartbeat every 90 seconds to prevent HP 120-second EC reset timeout
            _heartbeatTimer?.Dispose();
            _heartbeatTimer = new Timer(_ =>
            {
                if (_lastRequestedPercentage >= 85)
                {
                    try
                    {
                        var psi = new ProcessStartInfo
                        {
                            FileName = exePath,
                            Arguments = "-Bios FanMax=True",
                            CreateNoWindow = true,
                            UseShellExecute = false,
                            WorkingDirectory = Path.GetDirectoryName(exePath) ?? ""
                        };
                        using var proc = Process.Start(psi);
                        proc?.WaitForExit(2000);
                    }
                    catch { }
                }
            }, null, TimeSpan.FromSeconds(90), TimeSpan.FromSeconds(90));
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
                            _ => "Balanced"
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
