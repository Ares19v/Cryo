using System;
using System.Diagnostics;

namespace Cryo
{
    public static class PowerManager
    {
        // Well-known Windows power plan GUIDs
        private const string PowerSaverGuid       = "a1841308-3541-4fab-bc81-f71556f20b4a";
        private const string BalancedGuid          = "381b4222-f694-41f0-9685-ff5bb260df2e";
        private const string HighPerformanceGuid   = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";

        public static bool SetPlan(string planName)
        {
            string guid = planName switch
            {
                "Power Saver"      => PowerSaverGuid,
                "Balanced"         => BalancedGuid,
                "High Performance" => HighPerformanceGuid,
                _                  => BalancedGuid
            };

            try
            {
                var psi = new ProcessStartInfo("powercfg", $"/setactive {guid}")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false,
                };
                using var p = Process.Start(psi);
                p?.WaitForExit(3000);
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
