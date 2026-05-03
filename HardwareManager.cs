using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using System.Windows;
using LibreHardwareMonitor.Hardware;

namespace Cryo
{
    public class SensorModel : INotifyPropertyChanged
    {
        public string Name { get; set; }
        private string _value;
        public string Value
        {
            get => _value;
            set { if (_value != value) { _value = value; OnPropertyChanged(); } }
        }
        public string Type { get; set; }

        public event PropertyChangedEventHandler PropertyChanged;
        protected virtual void OnPropertyChanged([CallerMemberName] string propertyName = null)
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
                    Application.Current.Dispatcher.Invoke(UpdateHardware);
                    await Task.Delay(1500);
                }
            });
        }

        private void UpdateHardware()
        {
            try
            {
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
                                CpuTemperature = $"{sensor.Value.Value:F0} °C";
                            if (hardware.HardwareType == HardwareType.GpuNvidia || hardware.HardwareType == HardwareType.GpuAmd)
                                GpuTemperature = $"{sensor.Value.Value:F0} °C";
                        }
                        else if (sensor.SensorType == SensorType.Fan)
                        {
                            UpdateOrAddSensor(AllFans, cleanName, $"{sensor.Value.Value:F0} RPM", "Fan");
                        }
                        else if (sensor.SensorType == SensorType.Load)
                        {
                            UpdateOrAddSensor(AllLoads, cleanName, $"{sensor.Value.Value:F1} %", "Load");
                            if (hardware.HardwareType == HardwareType.Cpu && (sensor.Name.Contains("Total") || sensor.Name.Contains("Utilization")))
                                CpuLoad = $"{sensor.Value.Value:F0} %";
                        }
                    }
                }
            }
            catch { }
        }

        private void UpdateOrAddSensor(ObservableCollection<SensorModel> collection, string name, string value, string type)
        {
            var existing = collection.FirstOrDefault(s => s.Name == name);
            if (existing != null) existing.Value = value;
            else collection.Add(new SensorModel { Name = name, Value = value, Type = type });
        }

        public void Close() { _isRunning = false; _computer.Close(); }

        public event PropertyChangedEventHandler PropertyChanged;
        protected virtual void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
}
