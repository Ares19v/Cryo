# ❄️ Cryo Control Center

**A Hardware Utility for HP Omen Laptops.**

Cryo is a high-performance system utility designed to bridge the gap between premium design and low-level hardware control. Built with a **React + Framer Motion** frontend and a **C# / .NET 8** backend using **WebView2**, Cryo provides real-time telemetry and advanced cooling profile management specifically for HP Omen hardware.

## ✨ Key Features

- 🖥️ **Live Telemetry Dashboard**: Real-time monitoring of CPU/GPU temperatures, loads, and fan speeds.
- ❄️ **Omen Thermal Profiles**: Direct interface with HP BIOS/EC via WMI to toggle Performance, Extreme, and Quiet modes.
- ⚡ **Windows Power Orchestration**: Instant switching between Windows power plans (`powercfg`).
- 🎨 **Premium UI/UX**: Commercial-grade interface featuring fluid spring-based animations and a sleek "Arctic Blue" aesthetic.
- 🔒 **Secure Execution**: Native UAC elevation for secure access to kernel-level hardware sensors.

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, Framer Motion, Tailwind CSS |
| **Backend** | C# (.NET 8), WPF (Host), WebView2 |
| **Telemetry** | LibreHardwareMonitorLib |
| **Interface** | WMI (HPBIOS_BIOSSettingInterface), ACPI |

## 🚀 Getting Started

### Prerequisites

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/)
- **HP Omen Laptop** (Requires OMEN Gaming Hub installed for WMI drivers)

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/Ares19v/Cryo.git
   cd Cryo
   ```
2. Run the automated installer:
   ```cmd
   INSTALL.bat
   ```
3. Launch the application:
   ```cmd
   Run_Project.bat
   ```

## 🏗️ Architecture

Cryo uses a **Hybrid Bridge Architecture**:
- **IPC Layer**: C# acts as the hardware server, pushing telemetry via `window.chrome.webview.postMessage`.
- **Command Layer**: The React UI sends JSON control signals to C#, which translates them into WMI calls.
- **Security**: The application manifest requires `requireAdministrator` to ensure the Hardware Monitor can hook into the motherboard's SMBus and EC.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License



---
*Created by [Ares19v](https://github.com/Ares19v)*

---
<p align="center">
  Made by Devansh Tyagi @ 2026
</p>