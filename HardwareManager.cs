using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using LibreHardwareMonitor.Hardware;

namespace Cryo
{
    public class SensorModel : INotifyPropertyChanged
    {
        public string Name { get; set; } = "";
        private string _value = "";
        public string Value
        {
            get => _value;
            set { if (_value != value) { _value = value; OnPropertyChanged(); } }
        }
        public string Type { get; set; } = "";

        public event PropertyChangedEventHandler? PropertyChanged;
        protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }

    public class CoreTempModel
    {
        public string Name { get; set; } = "";
        public int Temp { get; set; }
    }

    public class HardwareManager : INotifyPropertyChanged
    {
        private Computer _computer;
        private CancellationTokenSource _cts = new CancellationTokenSource();

        private string _cpuTemperature = "-- °C";
        public string CpuTemperature { get => _cpuTemperature; set { if (_cpuTemperature != value) { _cpuTemperature = value; OnPropertyChanged(); } } }

        private string _gpuTemperature = "-- °C";
        public string GpuTemperature { get => _gpuTemperature; set { if (_gpuTemperature != value) { _gpuTemperature = value; OnPropertyChanged(); } } }

        private string _cpuLoad = "-- %";
        public string CpuLoad { get => _cpuLoad; set { if (_cpuLoad != value) { _cpuLoad = value; OnPropertyChanged(); } } }

        private string _gpuLoad = "0 %";
        public string GpuLoad { get => _gpuLoad; set { if (_gpuLoad != value) { _gpuLoad = value; OnPropertyChanged(); } } }

        private string _gpuVram = "0 / 8192 MB";
        public string GpuVram { get => _gpuVram; set { if (_gpuVram != value) { _gpuVram = value; OnPropertyChanged(); } } }

        private string _gpuPower = "0.0 W";
        public string GpuPower { get => _gpuPower; set { if (_gpuPower != value) { _gpuPower = value; OnPropertyChanged(); } } }

        private string _gpuClock = "0 MHz";
        public string GpuClock { get => _gpuClock; set { if (_gpuClock != value) { _gpuClock = value; OnPropertyChanged(); } } }

        private string _powerSource = "AC Power (Plugged In)";
        public string PowerSource { get => _powerSource; set { if (_powerSource != value) { _powerSource = value; OnPropertyChanged(); } } }

        private int _batteryPercent = 100;
        public int BatteryPercent { get => _batteryPercent; set { if (_batteryPercent != value) { _batteryPercent = value; OnPropertyChanged(); } } }

        public List<CoreTempModel> PerCoreTemps { get; private set; } = new List<CoreTempModel>();
        public ObservableCollection<SensorModel> AllTemperatures { get; } = new ObservableCollection<SensorModel>();
        public ObservableCollection<SensorModel> AllFans { get; } = new ObservableCollection<SensorModel>();
        public ObservableCollection<SensorModel> AllLoads { get; } = new ObservableCollection<SensorModel>();

        public HardwareManager()
        {
            _computer = new Computer
            {
                IsCpuEnabled = true,
                IsGpuEnabled = true,
                IsMemoryEnabled = true,
                IsMotherboardEnabled = true,
                IsControllerEnabled = true,
                IsNetworkEnabled = true,
                IsStorageEnabled = true
            };

            try { _computer.Open(); } catch { }
        }

        public void StartMonitoring()
        {
            var token = _cts.Token;
            Task.Run(async () =>
            {
                using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(1500));
                while (!token.IsCancellationRequested && await timer.WaitForNextTickAsync(token))
                {
                    try
                    {
                        if (System.Windows.Application.Current?.Dispatcher != null)
                        {
                            System.Windows.Application.Current.Dispatcher.Invoke(UpdateHardware);
                        }
                        else
                        {
                            UpdateHardware();
                        }
                    }
                    catch { }
                }
            }, token);
        }

        public void UpdateHardware()
        {
            try
            {
                bool hasCpuTemp = false;
                bool hasGpuTemp = false;
                bool hasCpuLoad = false;
                var coreTemps = new List<CoreTempModel>();

                // 1. Query Power Status via Win32_Battery
                try
                {
                    using var searcher = new ManagementObjectSearcher("SELECT BatteryStatus, EstimatedChargeRemaining FROM Win32_Battery");
                    foreach (ManagementObject obj in searcher.Get())
                    {
                        int status = Convert.ToInt32(obj["BatteryStatus"]);
                        PowerSource = (status == 2 || status == 6 || status == 7 || status == 8) ? "AC Power (Plugged In)" : "Battery Mode";
                        BatteryPercent = Convert.ToInt32(obj["EstimatedChargeRemaining"] ?? 100);
                        break;
                    }
                }
                catch { }

                // 2. Query LibreHardwareMonitor
                foreach (var hardware in _computer.Hardware)
                {
                    hardware.Update();
                    foreach (var sub in hardware.SubHardware) sub.Update();

                    foreach (var sensor in hardware.Sensors.Concat(hardware.SubHardware.SelectMany(s => s.Sensors)))
                    {
                        if (!sensor.Value.HasValue) continue;

                        string cleanName = $"{hardware.Name} - {sensor.Name}";

                        if (sensor.SensorType == SensorType.Temperature)
                        {
                            UpdateOrAddSensor(AllTemperatures, cleanName, $"{sensor.Value.Value:F0} °C", "Temperature");

                            if (hardware.HardwareType == HardwareType.Cpu)
                            {
                                if (sensor.Name.Contains("Package") || sensor.Name.Contains("Core (Max)"))
                                {
                                    CpuTemperature = $"{sensor.Value.Value:F0} °C";
                                    hasCpuTemp = true;
                                }

                                if (sensor.Name.StartsWith("Core") || sensor.Name.StartsWith("P-Core") || sensor.Name.StartsWith("E-Core") || sensor.Name.StartsWith("CPU Core"))
                                {
                                    coreTemps.Add(new CoreTempModel
                                    {
                                        Name = sensor.Name.Replace("Core #", "Core ").Replace("P-Core #", "P-Core ").Replace("E-Core #", "E-Core "),
                                        Temp = (int)Math.Round(sensor.Value.Value)
                                    });
                                }
                            }

                            if (hardware.HardwareType == HardwareType.GpuNvidia || hardware.HardwareType == HardwareType.GpuAmd)
                            {
                                GpuTemperature = $"{sensor.Value.Value:F0} °C";
                                hasGpuTemp = true;
                            }
                        }
                        else if (sensor.SensorType == SensorType.Fan)
                        {
                            UpdateOrAddSensor(AllFans, cleanName, $"{sensor.Value.Value:F0} RPM", "Fan");
                        }
                        else if (sensor.SensorType == SensorType.Load)
                        {
                            UpdateOrAddSensor(AllLoads, cleanName, $"{sensor.Value.Value:F1} %", "Load");
                            if (hardware.HardwareType == HardwareType.Cpu && (sensor.Name.Contains("Total") || sensor.Name.Contains("Utilization")))
                            {
                                CpuLoad = $"{sensor.Value.Value:F0} %";
                                hasCpuLoad = true;
                            }
                        }
                    }
                }

                if (coreTemps.Count > 0)
                {
                    PerCoreTemps = coreTemps;
                }

                // 3. GPU Query via nvidia-smi (High Precision for RTX 5060)
                try
                {
                    var gpuData = QueryNvidiaSmi();
                    if (gpuData.temp > 0)
                    {
                        if (!hasGpuTemp || GpuTemperature == "-- °C")
                        {
                            GpuTemperature = $"{gpuData.temp} °C";
                            UpdateOrAddSensor(AllTemperatures, "NVIDIA GeForce RTX 5060 - Core Temp", $"{gpuData.temp} °C", "Temperature");
                        }
                        GpuLoad = $"{gpuData.load} %";
                        GpuVram = $"{gpuData.vramUsed} / {gpuData.vramTotal} MB";
                        GpuPower = $"{gpuData.power:F1} W";
                        GpuClock = $"{gpuData.clock} MHz";
                    }
                }
                catch { }

                // 4. Fallback for CPU Load: WMI Performance Formatted Data
                if (!hasCpuLoad)
                {
                    try
                    {
                        using var searcher = new ManagementObjectSearcher("SELECT PercentProcessorUtility, PercentProcessorTime FROM Win32_PerfFormattedData_Counters_ProcessorInformation WHERE Name='_Total'");
                        foreach (ManagementObject obj in searcher.Get())
                        {
                            var util = obj["PercentProcessorUtility"] ?? obj["PercentProcessorTime"];
                            if (util != null)
                            {
                                CpuLoad = $"{Convert.ToInt32(util)} %";
                                UpdateOrAddSensor(AllLoads, "CPU Total Load", $"{Convert.ToInt32(util)} %", "Load");
                                break;
                            }
                        }
                    }
                    catch { }
                }

                // 5. Fallback for CPU Temp: ACPI Thermal Zone
                if (!hasCpuTemp)
                {
                    try
                    {
                        using var searcher = new ManagementObjectSearcher(@"root\WMI", "SELECT CurrentTemperature, InstanceName FROM MSAcpi_ThermalZoneTemperature");
                        foreach (ManagementObject obj in searcher.Get())
                        {
                            int raw = Convert.ToInt32(obj["CurrentTemperature"]);
                            double c = (raw - 2732) / 10.0;
                            if (c > 10 && c < 115)
                            {
                                CpuTemperature = $"{c:F0} °C";
                                UpdateOrAddSensor(AllTemperatures, "ACPI Thermal Zone", $"{c:F0} °C", "Temperature");
                                break;
                            }
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }

        private (int temp, int load, int vramUsed, int vramTotal, double power, int clock) QueryNvidiaSmi()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "nvidia-smi",
                    Arguments = "--query-gpu=temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw,clocks.current.graphics --format=csv,noheader,nounits",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var proc = Process.Start(psi);
                if (proc != null)
                {
                    string output = proc.StandardOutput.ReadToEnd();
                    proc.WaitForExit(1000);
                    var parts = output.Trim().Split(',');
                    if (parts.Length >= 6)
                    {
                        int.TryParse(parts[0].Trim(), out int t);
                        int.TryParse(parts[1].Trim(), out int l);
                        int.TryParse(parts[2].Trim(), out int vU);
                        int.TryParse(parts[3].Trim(), out int vT);
                        double.TryParse(parts[4].Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double p);
                        int.TryParse(parts[5].Trim(), out int clk);
                        return (t, l, vU, vT, p, clk);
                    }
                }
            }
            catch { }
            return (0, 0, 0, 0, 0.0, 0);
        }

        private void UpdateOrAddSensor(ObservableCollection<SensorModel> collection, string name, string value, string type)
        {
            var existing = collection.FirstOrDefault(s => s.Name == name);
            if (existing != null) existing.Value = value;
            else collection.Add(new SensorModel { Name = name, Value = value, Type = type });
        }

        public void Close()
        {
            _cts.Cancel();
            try { _computer.Close(); } catch { }
        }

        public event PropertyChangedEventHandler? PropertyChanged;
        protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
