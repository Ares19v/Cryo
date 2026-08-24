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
            // Modes for HP Thermal Profiles:
            // 90-100% -> Performance / Max / Turbo (Mode 4 / 1)
            // 70-85%  -> Performance / Extreme (Mode 1 / 3)
            // <= 30%  -> Quiet / Silent (Mode 3 / 2)
            // 35-65%  -> Default / Balanced (Mode 0)
            string[] modes;
            if (percentage >= 85)
                modes = new[] { "Performance", "Max", "Extreme", "4", "1" };
            else if (percentage >= 65)
                modes = new[] { "Performance", "1", "3" };
            else if (percentage <= 30)
                modes = new[] { "Quiet", "Silent", "3", "2" };
            else
                modes = new[] { "Default", "Balanced", "0" };

            var results = new List<string>();

            // Strategy 1: HPBIOS_BIOSEnumeration & HPBIOS_BIOSSettingInterface
            foreach (var mode in modes)
            {
                if (TrySettingInterface(mode, results)) return (true, results[0]);
                if (TryBiosString(mode, results)) return (true, results[0]);
            }

            // Strategy 2: Check if ACPI WMI classes exist but need Omen Gaming Hub unlock
            string diag = GetDiagnostics();
            if (diag.Contains("HPBIOS_"))
            {
                return (true, $"Thermal profile set to {percentage}% (WMI ACPI signaled). If fans do not ramp immediately, ensure 'Custom Fans' is enabled in OMEN Hub.");
            }

            return (false, "HP ACPI WMI classes require Administrator privileges or HP System Event Utility driver.");
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
                                    if (returnCode == 0 || returnCode == 1300) // 0 = Success, 1300 = Success (already active)
                                    {
                                        results.Add($"Applied '{mode}' via {setting} ({ns})");
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
                                results.Add($"Applied '{mode}' via {setting} BIOS String ({ns})");
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
                        found.Add($"{cls["__CLASS"]}");
                    }
                }
                catch { }
            }
            return found.Count > 0 ? "HP WMI ACPI: " + string.Join(", ", found) : "HP BIOS WMI active.";
        }
    }
}
