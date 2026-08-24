using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace Cryo
{
    public static class PowerManager
    {
        private const string DefaultBalancedGuid        = "381b4222-f694-41f0-9685-ff5bb260df2e";
        private const string DefaultHighPerformanceGuid = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
        private const string DefaultPowerSaverGuid      = "a1841308-3541-4fab-bc81-f71556f20b4a";

        public static bool SetPlan(string planName)
        {
            try
            {
                // 1. Discover all installed power plans dynamically from powercfg /list
                var availablePlans = GetInstalledPowerPlans();

                string targetGuid = "";

                if (planName.Equals("Power Saver", StringComparison.OrdinalIgnoreCase))
                {
                    if (availablePlans.TryGetValue("Power Saver", out var guid) ||
                        availablePlans.TryGetValue("Power saver", out guid) ||
                        availablePlans.TryGetValue("Saver", out guid))
                    {
                        targetGuid = guid;
                    }
                    else
                    {
                        // Try to duplicate/unlock default Power Saver scheme
                        TryUnlockScheme(DefaultPowerSaverGuid);
                        targetGuid = DefaultPowerSaverGuid;
                    }
                }
                else if (planName.Equals("High Performance", StringComparison.OrdinalIgnoreCase))
                {
                    if (availablePlans.TryGetValue("High Performance", out var guid) ||
                        availablePlans.TryGetValue("High performance", out guid) ||
                        availablePlans.TryGetValue("Ultimate Performance", out guid) ||
                        availablePlans.TryGetValue("Performance", out guid))
                    {
                        targetGuid = guid;
                    }
                    else
                    {
                        targetGuid = DefaultHighPerformanceGuid;
                    }
                }
                else
                {
                    // Balanced
                    if (availablePlans.TryGetValue("Balanced", out var guid))
                    {
                        targetGuid = guid;
                    }
                    else
                    {
                        targetGuid = DefaultBalancedGuid;
                    }
                }

                if (!string.IsNullOrEmpty(targetGuid))
                {
                    var psi = new ProcessStartInfo("powercfg", $"/setactive {targetGuid}")
                    {
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    using var p = Process.Start(psi);
                    p?.WaitForExit(3000);
                    return p?.ExitCode == 0;
                }

                return false;
            }
            catch
            {
                return false;
            }
        }

        private static Dictionary<string, string> GetInstalledPowerPlans()
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                var psi = new ProcessStartInfo("powercfg", "/list")
                {
                    RedirectStandardOutput = true,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                using var p = Process.Start(psi);
                if (p != null)
                {
                    string output = p.StandardOutput.ReadToEnd();
                    p.WaitForExit(3000);

                    // Parse GUIDs and Names: Power Scheme GUID: <guid>  (<name>)
                    var regex = new Regex(@"GUID:\s*([a-fA-F0-9\-]+)\s*\(([^)]+)\)");
                    var matches = regex.Matches(output);
                    foreach (Match m in matches)
                    {
                        if (m.Groups.Count >= 3)
                        {
                            string guid = m.Groups[1].Value.Trim();
                            string name = m.Groups[2].Value.Trim().TrimEnd('*').Trim();
                            map[name] = guid;
                        }
                    }
                }
            }
            catch { }
            return map;
        }

        private static void TryUnlockScheme(string guid)
        {
            try
            {
                var psi = new ProcessStartInfo("powercfg", $"/duplicatescheme {guid}")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                using var p = Process.Start(psi);
                p?.WaitForExit(2000);
            }
            catch { }
        }
    }
}
