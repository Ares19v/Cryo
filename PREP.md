# Study Prep Guide: Cryo Control Center

Welcome! This guide is a step-by-step beginner's tutorial designed to help you understand and build **Cryo Control Center**—a hybrid hardware control utility. You will learn how to interface with low-level kernel sensors, communicate between C# and React, execute administrator-level actions, and build high-performance desktop dashboards.

---

## 🗺️ System Architecture

Cryo uses a **Hybrid Bridge Architecture**. In modern desktop development, we use WPF (Windows Presentation Foundation) for deep OS and hardware access, but render the visual dashboard using React via **WebView2** (a lightweight Chromium browser instance).

```
               React UI Dashboard (Chromium)
                            │
            (window.chrome.webview.postMessage)
                            │
                            ▼
                C# WPF Application Host
             (CoreWebView2_WebMessageReceived)
               /            │            \
              /             │             \
  [LibreHardwareMonitor]  [WMI / HP BIOS]  [powercfg CMD]
  (CPU/GPU Telemetry)     (Thermal Profile) (Power Plans)
```

---

## 📚 Core Learning Prerequisites

Before writing code, make sure you understand:
1. **C# & .NET**: The basics of object-oriented programming in C#.
2. **WebView2**: Microsoft's modern control for embedding web technologies inside native WPF/WinForms apps.
3. **Windows Management Instrumentation (WMI)**: An infrastructure for administrative data and operations on Windows operating systems.
4. **User Account Control (UAC)**: Why reading hardware sensors requires running our application with full "Administrator" privileges.

---

## 🛠️ Step-by-Step Implementation Guide

Let's build a micro-version of a C# application that queries WMI and bridges the data to a web view.

### Step 1: Querying WMI in C#
Create a simple C# file `WmiTelemetry.cs` to fetch CPU temperature or basic motherboard information:

```csharp
using System;
using System.Management; // Add System.Management reference in Visual Studio

class WmiTelemetry
{
    static void Main()
    {
        Console.WriteLine("Querying Motherboard Info via WMI...");
        
        try
        {
            // Query the Win32_BaseBoard class
            SelectQuery query = new SelectQuery("SELECT * FROM Win32_BaseBoard");
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(query))
            {
                foreach (ManagementObject board in searcher.Get())
                {
                    Console.WriteLine($"Manufacturer: {board["Manufacturer"]}");
                    Console.WriteLine($"Product: {board["Product"]}");
                    Console.WriteLine($"Serial Number: {board["SerialNumber"]}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WMI Query failed: {ex.Message}");
        }
    }
}
```

---

### Step 2: Setting Up the C# WebView2 IPC Bridge
In WPF, you initialize the WebView2 control and wire up an event listener to handle incoming messages from the frontend React UI. Here is a typical implementation of the bridge inside `MainWindow.xaml.cs`:

```csharp
using System;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace CryoMock
{
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            InitializeWebView();
        }

        async void InitializeWebView()
        {
            // 1. Ensure WebView2 Runtime is initialized
            await webView.EnsureCoreWebView2Async(null);

            // 2. Register Message Received Event
            webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            // 3. Send mock telemetry data to React every 2 seconds
            System.Windows.Threading.DispatcherTimer timer = new System.Windows.Threading.DispatcherTimer();
            timer.Interval = TimeSpan.FromSeconds(2);
            timer.Tick += (s, e) => {
                string jsonTelemetry = "{\"cpuTemp\": 45.5, \"gpuTemp\": 52.0, \"fanSpeed\": 2200}";
                webView.CoreWebView2.PostWebMessageAsString(jsonTelemetry);
            };
            timer.Start();
        }

        // 4. Handle commands received from the React UI
        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string message = e.TryGetWebMessageAsString();
            
            if (message == "SET_PROFILE_PERFORMANCE")
            {
                // In production, execute WMI call to trigger Performance Mode
                MessageBox.Show("Triggered Omen Performance Profile!");
            }
        }
    }
}
```

---

### Step 3: Triggering C# from JavaScript / React
On the React side, sending a command to the C# WPF container is simple and non-blocking:

```javascript
// Function to tell C# to toggle the thermal profile
function triggerPerformanceMode() {
  if (window.chrome && window.chrome.webview) {
    // Send command string to C# Host
    window.chrome.webview.postMessage("SET_PROFILE_PERFORMANCE");
  } else {
    console.warn("WebView2 Host interface not found. Running in web demo mode.");
  }
}
```

---

## 🔍 Key Deep Dive Topics

### 1. LibreHardwareMonitorLib
To pull exact CPU/GPU temperatures, load indexes, and motherboard fan speeds, Cryo integrates `LibreHardwareMonitorLib`. This library installs a kernel driver dynamically at runtime to tap into the CPU's Model-Specific Registers (MSR) and the motherboard's Super I/O chip (SMBus).

### 2. Manifest elevation (`requireAdministrator`)
Because reading MSR registers and sending SMBus requests requires Ring 0 privilege level, Cryo includes an `app.manifest` specifying:
```xml
<requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
```
This forces Windows to show a UAC prompt immediately when the user launches the application, ensuring that the necessary hardware hooks can be created successfully.

---

## 🎯 Verification Tasks

1. **Install and Run**: Run `INSTALL.bat` and then `Run_Project.bat` to verify that the WPF container and WebView2 launch cleanly.
2. **Switch Profile**: Navigate to the Fans page in the interface and click the thermal profile profiles (e.g. Quiet, Performance). Look at your Windows command line output to verify the C# bridge receives and prints the toggle message.
