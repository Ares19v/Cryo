using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Management;
using System.Runtime.CompilerServices;
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

    public class HardwareManager : INotifyPropertyChanged
    {
        private Computer _computer;
        private bool _isRunning;

        private string _cpuTemperature = "-- °C";
        public string CpuTemperature { get => _cpuTemperature; set { if (_cpuTemperature != value) { _cpuTemperature = value; OnPropertyChanged(); } } }

        private string _gpuTemperature = "-- °C";
        public string GpuTemperature { get => _gpuTemperature; set { if (_gpuTemperature != value) { _gpuTemperature = value; OnPropertyChanged(); } } }

        private string _cpuLoad = "-- %";
        public string CpuLoad { get => _cpuLoad; set { if (_cpuLoad != value) { _cpuLoad = value; OnPropertyChanged(); } } }

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
            _isRunning = true;
            Task.Run(async () =>
            {
                while (_isRunning)
                {
                    try
                    {
                        if (Application.Current?.Dispatcher != null)
                        {
                            Application.Current.Dispatcher.Invoke(UpdateHardware);
                        }
                        else
                        {
                            UpdateHardware();
                        }
                    }
                    catch { }

                    await Task.Delay(1500);
                }
            });
        }

        public void UpdateHardware()
        {
            try
            {
                bool hasCpuTemp = false;
                bool hasGpuTemp = false;
                bool hasCpuLoad = false;

                // 1. Primary: Query LibreHardwareMonitor
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
                            if (hardware.HardwareType == HardwareType.Cpu && (sensor.Name.Contains("Package") || sensor.Name.Contains("Core (Max)")))
                            {
                                CpuTemperature = $"{sensor.Value.Value:F0} °C";
                                hasCpuTemp = true;
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

                // 2. Secondary Fallback for GPU: nvidia-smi query (for modern RTX 50-series / 40-series mobile)
                if (!hasGpuTemp)
                {
                    try
                    {
                        var (gpuTemp, gpuLoad) = QueryNvidiaSmi();
                        if (gpuTemp > 0)
                        {
                            GpuTemperature = $"{gpuTemp:F0} °C";
                            UpdateOrAddSensor(AllTemperatures, "NVIDIA GeForce GPU - Core Temp", $"{gpuTemp:F0} °C", "Temperature");
                        }
                        if (gpuLoad >= 0)
                        {
                            UpdateOrAddSensor(AllLoads, "NVIDIA GeForce GPU - Core Load", $"{gpuLoad:F1} %", "Load");
                        }
                    }
                    catch { }
                }

                // 3. Secondary Fallback for CPU Load: WMI Performance Formatted Data
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

                // 4. Secondary Fallback for CPU Temp: ACPI Thermal Zone
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

        private (int temp, int load) QueryNvidiaSmi()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "nvidia-smi",
                    Arguments = "--query-gpu=temperature.gpu,utilization.gpu --format=csv,noheader,nounits",
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
                    if (parts.Length >= 2)
                    {
                        int.TryParse(parts[0].Trim(), out int t);
                        int.TryParse(parts[1].Trim(), out int l);
                        return (t, l);
                    }
                }
            }
            catch { }
            return (0, 0);
        }

        private void UpdateOrAddSensor(ObservableCollection<SensorModel> collection, string name, string value, string type)
        {
            var existing = collection.FirstOrDefault(s => s.Name == name);
            if (existing != null) existing.Value = value;
            else collection.Add(new SensorModel { Name = name, Value = value, Type = type });
        }

        public void Close() { _isRunning = false; _computer.Close(); }

        public event PropertyChangedEventHandler? PropertyChanged;
        protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
