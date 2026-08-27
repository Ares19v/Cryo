[![CI](https://github.com/Ares19v/Cryo/actions/workflows/ci.yml/badge.svg)](https://github.com/Ares19v/Cryo/actions/workflows/ci.yml)

# ❄️ Cryo Control Center

<p align="center">
  <img src="app_icon.png" alt="Cryo Logo" width="128" height="128" />
</p>

<p align="center">
  <strong>Next-Generation Low-Level Hardware Monitoring & Thermal Utility for HP OMEN Laptops</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%2011%20%7C%2010-0078D4?style=flat-square&logo=windows" alt="Platform" />
  <img src="https://img.shields.io/badge/.NET-8.0%20WPF-512BD4?style=flat-square&logo=dotnet" alt=".NET 8" />
  <img src="https://img.shields.io/badge/Frontend-React%20%7C%20Vite%20%7C%20Tailwind-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Animation-Framer%20Motion-FF4154?style=flat-square&logo=framer" alt="Framer Motion" />
  <img src="https://img.shields.io/badge/GPU-NVIDIA%20RTX%20Series-76B900?style=flat-square&logo=nvidia" alt="NVIDIA" />
</p>

---

## 📖 Overview

**Cryo** is a lightweight, responsive hardware companion designed specifically for **HP OMEN 16** (and compatible HP gaming laptops). It provides instant hardware telemetry and direct **low-level ACPI Embedded Controller fan override**, completely bypassing the slow startup and heavy background footprint of OMEN Gaming Hub.

Built with a hybrid **React + Tailwind + Framer Motion** presentation layer hosted inside a hardware-accelerated **.NET 8 WPF WebView2** shell, Cryo pairs commercial-grade visuals with kernel-level sensor polling.

---

## ✨ Key Features

### 🎛️ Interactive Fan & Thermal Control
* **Percentage-Based Arc Dial**: Draggable SVG circular arc dial with continuous `0%` to `100%` fan override.
* **Dynamic Radial Glow**: Dial aura shifts dynamically based on speed profile:
  * `0%` → 🟣 **Indigo** (`🤖 Auto / Factory BIOS Curve`)
  * `1% - 25%` → 🔵 **Cyan** (`🌙 Silent Profile`)
  * `26% - 55%` → 🌊 **Electric Blue** (`⚖️ Balanced Profile`)
  * `56% - 85%` → 🟠 **Amber** (`🔥 Turbo Profile`)
  * `86% - 100%` → 🔴 **Rose Red** (`❄️ Max Cool / 5500+ RPM`)
* **Live Estimated RPM Counter**: Dynamically estimates dual-turbine fan speed in real time (`≈ 2,850 RPM`).
* **90-Second ACPI Heartbeat Loop**: Background watchdog daemon prevents HP's 120-second Embedded Controller timeout reset during heavy gaming sessions.
* **Quick Cooling Presets & Keyboard Binds**: Hotkeys `0` through `4` and `↑` / `↓` arrow keys for 1% step fine-tuning.

### 📊 Real-Time Hardware Telemetry
* **Per-Core CPU Heatmap Grid**: Live individual junction temperature tiles for all 16 cores (8 Performance + 8 Efficient cores).
* **NVIDIA GPU Blackwell / Ada Metrics**: Direct monitoring of VRAM allocation (`0 / 8,192 MB`), active core clock frequency, and real-time power draw (`W`).
* **Hardware Sparklines**: 60-second rolling trend SVG graphs for CPU Package and GPU Die temperatures.
* **Standby Memory Purge**: One-click RAM purge tool utilizing the Win32 `EmptyWorkingSet` API to free standby cache memory.

### 🎨 Refined UI & Cyber Audio
* **Cyber Obsidian Dark Mode**: OLED-optimized dark theme (`#0A0E1A`) with frost accents and zero-white-flash WPF canvas.
* **Web Audio API Haptics**: Procedural audio synthesizer generating reactive acoustic sounds on profile shifts.
* **Silent Desktop Launcher**: Zero command-prompt flicker on startup via `Launch_Cryo_Silently.vbs` and desktop shortcut integration.
* **Local HTTP Bridge**: Built-in REST API (`http://localhost:5050/api/telemetry`) enabling headless monitoring and remote sensor queries.

---

## ⌨️ Keyboard Shortcuts

| Key | Action | Description |
| :---: | :--- | :--- |
| <kbd>0</kbd> | **Auto Mode** | Reverts fans back to HP BIOS automatic management |
| <kbd>1</kbd> | **Silent Mode** | Sets quiet 20% acoustic curve for browsing and battery saving |
| <kbd>2</kbd> | **Balanced Mode** | Adaptive 50% thermal envelope for daily productivity |
| <kbd>3</kbd> | **Turbo Mode** | High-performance 80% aggressive cooling ramp |
| <kbd>4</kbd> | **Max Cool** | 100% dual-fan lock (5500+ RPM) with ACPI 90s heartbeat |
| <kbd>↑</kbd> / <kbd>↓</kbd> | **Fine-Tune** | Adjusts custom fan percentage by `+1%` / `-1%` |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React 18 Frontend                    │
│   (Vite · Framer Motion · Tailwind · Web Audio API)    │
└──────────────────────────┬─────────────────────────────┘
                           │ WebView2 IPC & HTTP Bridge (:5050)
┌──────────────────────────▼─────────────────────────────┐
│                 .NET 8 WPF Host Window                 │
├──────────────────────────┬─────────────────────────────┤
│   Hardware Telemetry     │     Thermal Dispatcher      │
│ (LibreHardwareMonitorLib)│  (ACPI WMI + OmenMon Engine)│
└──────────────┬───────────┴──────────────┬──────────────┘
               │                          │
   Kernel Ring 0 Sensor Polling    Embedded Controller (EC)
   (Intel Core i7 + RTX 5060)      (Dual Fan Speed RPM Override)
```

---

## 🚀 Getting Started

### Prerequisites
* **Windows 10 / 11** (64-bit)
* [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
* [Node.js 18+](https://nodejs.org/)
* **HP OMEN Laptop** (HP OMEN 16, 17, Transcend, or compatible HP Gaming series)

### Installation & Launch

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Ares19v/Cryo.git
   cd Cryo
   ```

2. **One-Click Launch**:
   Double-click [`Run_Project.bat`](Run_Project.bat) to build assets, configure binaries, and start Cryo.

3. **Desktop Shortcut**:
   Double-click [`Create_Desktop_Shortcut.vbs`](Create_Desktop_Shortcut.vbs) to generate a desktop shortcut with the official Cryo application icon.

---

## 🛠️ Tech Stack

* **Presentation**: React 18, Vite, Framer Motion, Tailwind CSS, Lucide Icons
* **Runtime**: C# (.NET 8 Windows Desktop), WPF, Microsoft.Web.WebView2
* **Hardware Drivers**: LibreHardwareMonitorLib, Win32 ACPI WMI (`root\wmi`, `root\HP\InstrumentedBIOS`)
* **Fan Control Engine**: Low-level HP WMI ACPI dispatch & OmenMon EC utility

---

© 2026 Devansh Tyagi (Ares19v). All Rights Reserved.
