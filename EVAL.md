# EVAL — Cryo

> **Evaluation Date:** 2026-05-29  
> **Evaluator:** Automated Portfolio Review  
> **Maturity Level:** MVP

---

## 1. Project Purpose & Problem Statement

HP Omen laptops ship with thermal profiles and fan control accessible through the proprietary OMEN Gaming Hub, but that software is bloated, has limited real-time telemetry visibility, and offers no programmable control. Cryo fills this gap as a lightweight, precision hardware utility that exposes CPU/GPU temperatures, loads, fan speeds, and thermal profiles through a premium React frontend embedded in a native WPF host via WebView2.

The target user is an Omen laptop owner who wants real-time telemetry without the overhead of OMEN Gaming Hub, and direct switching between Performance, Extreme, and Quiet thermal profiles through a clean interface. The hardware-specific nature makes this a niche but technically ambitious tool — interfacing directly with WMI BIOS settings and kernel-level hardware sensors requires administrator elevation and careful EC access.

---

## 2. Technical Architecture

Cryo implements a hybrid bridge architecture connecting a modern React UI to C# backend hardware access:

**Frontend (`frontend/` or `ui/`):** React 18 + Vite with Framer Motion (spring-based animations) and Tailwind CSS. Implements an "Arctic Blue" design aesthetic with a live telemetry dashboard and fan control page. Communicates with the C# host via `window.chrome.webview.postMessage` and listens to incoming telemetry via WebView2's JavaScript bridge.

**Backend (C# / .NET 8 WPF Host):** `MainWindow.xaml.cs` hosts the WebView2 control, initializes LibreHardwareMonitorLib for kernel-level telemetry (CPU/GPU temperatures, fan RPM, load percentages), and manages the IPC bridge. `OmenFanControl.cs` interfaces with `HPBIOS_BIOSSettingInterface` via WMI to toggle HP's native thermal profiles. `PowerManager.cs` invokes `powercfg` for Windows power plan switching.

**IPC Layer:** C# pushes telemetry data to the React UI as JSON via `window.chrome.webview.postMessage`. React sends JSON control signals back to C# via `chrome.webview.hostObjects` or postMessage, which the `CoreWebView2_WebMessageReceived` handler routes to WMI calls.

**Python Backend (`backend/`):** A supplementary Python server (likely for additional telemetry or scripting). The architecture suggests optional use alongside the .NET host.

**Security:** `app.manifest` sets `requireAdministrator` — UAC elevation is required for LibreHardwareMonitor's SMBus/EC hook access. This is correctly documented as a mandatory requirement.

---

## 3. Strengths

- **Technically ambitious hardware interfacing:** Direct WMI BIOS interface (`HPBIOS_BIOSSettingInterface`) access is non-trivial and requires deep understanding of HP's hardware abstraction layer.
- **Hybrid architecture is appropriate:** WebView2 bridges the gap between a native C# host (needed for hardware access) and a modern React UI (needed for animation quality) without the overhead of Electron.
- **LibreHardwareMonitorLib integration:** Using the industry-standard open-source library for kernel-level hardware monitoring is the correct choice over implementing custom SMBus drivers.
- **UAC elevation handled correctly:** `requireAdministrator` in the manifest is the right mechanism — not requesting elevation at runtime with a UAC prompt mid-session.
- **Premium UI:** Framer Motion spring animations and Tailwind CSS with an "Arctic Blue" aesthetic suggest serious attention to UX quality.

---

## 4. Limitations & Known Gaps

- **Highly hardware-specific:** Requires an HP Omen laptop with OMEN Gaming Hub installed (for WMI drivers). Zero portability to other hardware.
- **README is sparse:** 69 lines with minimal technical detail. The architecture section is brief. No documented API surface for the IPC bridge.
- **No CI/CD pipeline:** No `.github/workflows/` visible. No automated build validation.
- **Limited test coverage:** No test suite visible. Hardware-dependent code is difficult to test, but the business logic layers (telemetry parsing, profile management) could be unit tested with mocked WMI responses.
- **Python backend purpose undocumented:** `backend/` directory with a `main.py` is present but not described in the README. Its role in the architecture is unclear.
- **No cross-model support:** Tied to WMI BIOS interface of HP Omen series. Different Omen generations may have different WMI namespaces.
- **No installer/packaging:** No MSIX or installer packaging documented beyond the `INSTALL.bat`. Requires .NET 8 SDK installed by end users.

---

## 5. Code Quality Assessment

The C# files are clearly organized: `HardwareManager.cs` for LibreHardwareMonitor, `OmenFanControl.cs` for WMI BIOS, `PowerManager.cs` for `powercfg`, and separate XAML pages for Dashboard and Fans. The WPF + WebView2 hosting pattern is architecturally sound for this use case.

**Documentation:** README is notably thin for the technical complexity involved. The architecture section covers the pattern at a high level but omits the IPC message format and the Python backend's role.

**Testing:** No CI/CD or test suite observed. This is a significant gap given the hardware interaction complexity.

**Build system:** `.csproj` for .NET 8 and Vite for the React frontend — appropriate choices.

---

## 6. Maturity Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Functionality | 7/10 | Core telemetry and profile switching work; Python backend role unclear |
| Code Quality | 6/10 | Well-structured C# layers; no tests; Python backend undocumented |
| Documentation | 4/10 | README too sparse for technical complexity; IPC format undocumented |
| Scalability | 2/10 | HP Omen-specific; no generalization possible without WMI abstraction |
| Security | 7/10 | UAC elevation correct; local-only tool with no network surface |
| **Overall** | **5.2/10** | **Technically impressive hardware work; documentation and testing needed** |

---

## 7. Suggested Next Steps

1. **Expand the README** to document the IPC bridge message format, the Python backend's role, the required OMEN Gaming Hub WMI driver version, and the specific Omen models known to work.
2. **Add a GitHub Actions CI pipeline** — at minimum, a `dotnet build` check and a `vite build` check to validate both layers on every push.
3. **Document the Python backend's purpose** and integrate it cleanly into the architecture diagram and startup scripts, or remove it if unused.

---

## 8. Verdict

Cryo is technically impressive: the WebView2 hybrid bridge between a C# WPF host and a React frontend is architecturally sophisticated, and direct WMI BIOS access for HP thermal profile control requires real systems programming knowledge. The hardware-specific nature limits its audience but not its technical credibility. Its primary weaknesses are documentation depth (the README dramatically undersells the technical complexity) and the complete absence of CI/CD or testing — both straightforward to address given the well-structured codebase.
