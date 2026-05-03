using System;
using System.Collections.Generic;
using System.Management;

namespace Cryo
{
    public static class OmenFanControl
    {
        private static readonly string[] HpNamespaces = { @"root\HP\InstrumentedBIOS", @"root\WMI" };
        
        public static (bool success, string message) SetFanSpeed(int percentage)
        {
            // Try different HP Omen mode mappings
            // Some models use 0-4, others use strings like "Performance" or "Max"
            string[] modes;
            if (percentage >= 90)
                modes = new[] { "4", "Performance", "Max", "Extreme", "1" };
            else if (percentage >= 70)
                modes = new[] { "1", "Performance", "3" };
            else if (percentage <= 20)
                modes = new[] { "3", "Quiet", "2" };
            else
                modes = new[] { "0", "Default", "Balanced" };

            var results = new List<string>();

            foreach (var mode in modes)
            {
                if (TrySettingInterface(mode, results)) return (true, results[0]);
                if (TryBiosString(mode, results)) return (true, results[0]);
            }

            return (false, "HP WMI call succeeded but motherboard didn't trigger fan ramp. You may need to enable 'Max Fans' in OMEN Gaming Hub first to unlock manual control.");
        }

        private static bool TrySettingInterface(string mode, List<string> results)
        {
            string[] settingNames = { "Thermal Policy", "Thermal Strategy", "Fan Speed Mode", "System Thermal Profile" };
            
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
                                int returnCode = Convert.ToInt32(result);
                                if (returnCode == 0)
                                {
                                    results.Add($"✓ Applied '{mode}' via {setting} ({ns})");
                                    return true;
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
                    var searcher = new ManagementObjectSearcher(ns, "SELECT * FROM meta_class WHERE __CLASS LIKE 'HPBIOS_%'");
                    foreach (ManagementClass cls in searcher.Get())
                    {
                        found.Add($"{ns}:{cls["__CLASS"]}");
                    }
                }
                catch { }
            }
            return found.Count > 0 ? "HP WMI Found: " + string.Join(", ", found) : "No HP BIOS WMI classes found.";
        }
    }
}
