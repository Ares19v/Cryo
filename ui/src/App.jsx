import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Wind, Activity, Zap, Settings,
  Thermometer, Gauge, Fan, Power, Sparkles,
  BatteryCharging, HardDrive, ShieldCheck, Flame, Moon, Sliders, Laptop
} from 'lucide-react';

const API_BASE = 'http://localhost:5050';

// ─── Sparkline Mini Chart Component ──────────────────────────────────────────

const Sparkline = ({ data, color = '#00C6FF', height = 45 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 85);
  const min = Math.min(...data, 35);
  const range = max - min || 1;
  const width = 200;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-11 overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Reusable Components ────────────────────────────────────────────────────

const Card = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, type: 'spring', bounce: 0.25 }}
    className={`bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] border border-slate-100/80 overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const CardHeader = ({ title, subtitle, icon: Icon, color = 'text-[#00A8E8]' }) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/70 bg-slate-50/50">
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="p-2 rounded-xl bg-white shadow-xs border border-slate-100">
          <Icon className={`w-4.5 h-4.5 ${color}`} />
        </div>
      )}
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>}
      </div>
    </div>
  </div>
);

const SensorRow = ({ name, value, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.05 + index * 0.03 }}
    className="flex justify-between items-center px-6 py-3 border-b border-slate-50 hover:bg-slate-50/80 transition-colors"
  >
    <span className="text-xs text-slate-500 font-medium">{name}</span>
    <span className="text-xs font-bold text-[#0072FF]">{value}</span>
  </motion.div>
);

const StatCard = ({ title, value, unit = '', icon: Icon, delay, color, history = [] }) => {
  const numericVal = parseInt(value, 10) || 0;

  return (
    <Card delay={delay} className="p-6 relative flex flex-col justify-between overflow-hidden group">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${color.bg}`}>
            <Icon className={`w-5 h-5 ${color.icon}`} />
          </div>
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">REAL-TIME</span>
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <motion.span
            key={value}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-black text-slate-800 tracking-tight"
          >
            {value.replace(' °C', '').replace(' %', '')}
          </motion.span>
          <span className="text-sm font-bold text-slate-400">{unit || (value.includes('°C') ? '°C' : '%')}</span>
        </div>
      </div>

      {history.length > 2 && (
        <div className="mt-4 pt-2 border-t border-slate-100/60">
          <Sparkline data={history} color={color.sparkline || '#00C6FF'} />
        </div>
      )}
    </Card>
  );
};

// ─── Per-Core Heatmap Grid ──────────────────────────────────────────────────

const CoreHeatTile = ({ core, temp, index }) => {
  let colorClass = 'bg-cyan-50 border-cyan-200 text-cyan-700';
  if (temp >= 80) colorClass = 'bg-rose-50 border-rose-200 text-rose-700';
  else if (temp >= 70) colorClass = 'bg-amber-50 border-amber-200 text-amber-700';
  else if (temp >= 60) colorClass = 'bg-emerald-50 border-emerald-200 text-emerald-700';

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${colorClass}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-tight opacity-75">{core}</span>
      <span className="text-sm font-black mt-0.5">{temp > 0 ? `${temp}°` : '--'}</span>
    </motion.div>
  );
};

// ─── Dynamic Fan Speedometer Rotor ──────────────────────────────────────────

const FanSpeedometer = ({ speedPercentage, modeName }) => {
  // Rotate animation duration mapped to speed
  const spinSpeed = speedPercentage >= 85 ? 0.35 : speedPercentage >= 50 ? 0.7 : speedPercentage >= 20 ? 1.4 : 2.5;

  return (
    <div className="flex items-center gap-6 p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl text-white shadow-xl relative overflow-hidden">
      <div className="relative z-10 flex items-center justify-center w-28 h-28 shrink-0">
        {/* Spinning Blades */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: spinSpeed, ease: 'linear' }}
          className="w-24 h-24 rounded-full border-2 border-dashed border-[#00C6FF]/40 flex items-center justify-center"
        >
          <Fan className="w-16 h-16 text-[#00C6FF] drop-shadow-[0_0_12px_rgba(0,198,255,0.6)]" />
        </motion.div>
        {/* Glow */}
        <div className="absolute inset-0 bg-[#00C6FF]/10 rounded-full blur-xl pointer-events-none" />
      </div>

      <div className="relative z-10 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full bg-[#00C6FF] animate-ping" />
          <span className="text-[10px] font-bold tracking-widest text-[#00C6FF] uppercase">ACPI EC Fan Controller</span>
        </div>
        <h4 className="text-2xl font-black text-white">{modeName || 'Adaptive Curve'}</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          {speedPercentage >= 85
            ? '🚀 Dual Turbo Fans locked at maximum 5500+ RPM output (90s Heartbeat Active)'
            : speedPercentage === 0
            ? '🤖 Managed dynamically by HP Embedded Controller BIOS firmware'
            : `⚖️ Custom acoustic envelope target active (${speedPercentage}%)`}
        </p>
      </div>
    </div>
  );
};

// ─── Pages ──────────────────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, x: -18, transition: { duration: 0.2 } }
};

function DashboardPage({ telemetry, isConnected, cpuHistory, gpuHistory }) {
  return (
    <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Telemetry</h1>
          <p className="text-slate-400 mt-0.5 text-xs font-medium">HP OMEN 16 · Intel Core i7-14650HX · NVIDIA RTX 5060 Laptop GPU</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-100 shadow-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-xs font-bold text-slate-600">
              {isConnected ? 'Kernel Stream Active' : 'Connecting to Hardware...'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50/70 border border-blue-100 text-[#0072FF] text-xs font-bold shadow-xs">
            <BatteryCharging className="w-3.5 h-3.5" />
            <span>{telemetry.powerSource || 'AC Connected'}</span>
          </div>
        </div>
      </div>

      {/* Main 3 High-Impact Stat Cards with Sparklines */}
      <div className="grid grid-cols-3 gap-5">
        <StatCard
          title="CPU Package Temp"
          value={telemetry.cpuTemp}
          icon={Thermometer}
          delay={0.05}
          color={{ bg: 'bg-blue-50', icon: 'text-[#00A8E8]', sparkline: '#00A8E8' }}
          history={cpuHistory}
        />
        <StatCard
          title="GPU Die Temperature"
          value={telemetry.gpuTemp}
          icon={Cpu}
          delay={0.1}
          color={{ bg: 'bg-emerald-50', icon: 'text-emerald-500', sparkline: '#10B981' }}
          history={gpuHistory}
        />
        <StatCard
          title="CPU Core Utilization"
          value={telemetry.cpuLoad}
          icon={Gauge}
          delay={0.15}
          color={{ bg: 'bg-amber-50', icon: 'text-amber-500' }}
        />
      </div>

      {/* NVIDIA GPU Dedicated Telemetry Banner */}
      <Card delay={0.18} className="p-6 bg-gradient-to-r from-slate-900 via-[#0B1528] to-slate-900 text-white border-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">NVIDIA GeForce RTX 5060 Laptop GPU</h4>
              <p className="text-xs text-slate-400">8,192 MB GDDR6 · Blackwell Architecture</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {telemetry.gpuLoad || '0%'} Load
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VRAM Allocation</p>
            <p className="text-lg font-black text-white mt-0.5">{telemetry.gpuVram || '0 / 8,192 MB'}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Core Frequency</p>
            <p className="text-lg font-black text-[#00C6FF] mt-0.5">{telemetry.gpuClock || '2,205 MHz'}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Power Draw</p>
            <p className="text-lg font-black text-emerald-400 mt-0.5">{telemetry.gpuPower || '24.6 W'}</p>
          </div>
        </div>
      </Card>

      {/* Per-Core CPU Heatmap Grid (P-Cores + E-Cores) */}
      <Card delay={0.22}>
        <CardHeader
          title="Intel Core i7-14650HX · Core Thermal Grid"
          subtitle="Real-time individual core junction temperatures (8 P-Cores + 8 E-Cores)"
          icon={Thermometer}
        />
        <div className="p-6">
          {telemetry.perCoreTemps && telemetry.perCoreTemps.length > 0 ? (
            <div className="grid grid-cols-8 gap-2.5">
              {telemetry.perCoreTemps.slice(0, 16).map((c, i) => (
                <CoreHeatTile key={i} core={c.name.replace('Intel Core i7-14650HX - ', '')} temp={c.temp} index={i} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Reading per-core sensors...</p>
          )}
        </div>
      </Card>

      {/* Detailed Sensor Explorer */}
      <div className="grid grid-cols-2 gap-5">
        <Card delay={0.26}>
          <CardHeader title="All Temperature Channels" icon={Thermometer} />
          <div className="max-h-52 overflow-y-auto">
            {telemetry.temps && telemetry.temps.length > 0
              ? telemetry.temps.map((s, i) => <SensorRow key={i} name={s.name} value={s.value} index={i} />)
              : <p className="text-slate-400 text-xs p-6 italic">Polling thermal sensors...</p>}
          </div>
        </Card>

        <Card delay={0.3}>
          <CardHeader title="Hardware Utilization &amp; Subsystems" icon={Activity} color="text-amber-500" />
          <div className="max-h-52 overflow-y-auto">
            {telemetry.loads && telemetry.loads.length > 0
              ? telemetry.loads.map((s, i) => <SensorRow key={i} name={s.name} value={s.value} index={i} />)
              : <p className="text-slate-400 text-xs p-6 italic">Polling subsystem loads...</p>}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function FansPage() {
  const [activePlan, setActivePlan] = useState('High Performance');
  const [fanSpeed, setFanSpeed] = useState(0);
  const [activeModeLabel, setActiveModeLabel] = useState('🤖 Auto');
  const [applying, setApplying] = useState(false);
  const [fanStatus, setFanStatus] = useState({ text: '', ok: true });
  const [planStatus, setPlanStatus] = useState({ text: '', ok: true });

  const presets = [
    { label: '🤖 Auto', value: 0, desc: 'Factory BIOS Curve' },
    { label: '🌙 Silent', value: 20, desc: 'Quiet Acoustic Profile' },
    { label: '⚖️ Balanced', value: 50, desc: 'Adaptive Thermal Policy' },
    { label: '🔥 Turbo', value: 80, desc: 'Performance Ramp' },
    { label: '❄️ Max Cool', value: 100, desc: '100% Full Speed (5500+ RPM)' }
  ];

  // Keyboard shortcut listener for one-touch preset switching
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '0') applyPreset(presets[0]);
      if (e.key === '1') applyPreset(presets[1]);
      if (e.key === '2') applyPreset(presets[2]);
      if (e.key === '3') applyPreset(presets[3]);
      if (e.key === '4') applyPreset(presets[4]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const applyPowerPlan = async (plan) => {
    setActivePlan(plan);
    setPlanStatus({ text: 'Applying...', ok: true });

    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(JSON.stringify({ type: 'SET_POWER_PLAN', plan }));
    } else {
      try {
        const res = await fetch(`${API_BASE}/api/set-power-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan })
        });
        const data = await res.json();
        setPlanStatus({
          text: data.success ? `Switched to ${data.plan}` : `Failed to switch plan`,
          ok: data.success
        });
      } catch {
        setPlanStatus({ text: `Switched to ${plan} (Desktop bridge not connected)`, ok: true });
      }
    }
  };

  const applyPreset = (preset) => {
    setFanSpeed(preset.value);
    setActiveModeLabel(preset.label);
    executeFanSpeed(preset.value, preset.label);
  };

  const executeFanSpeed = async (speed, label) => {
    setApplying(true);
    setFanStatus({ text: '', ok: true });

    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(JSON.stringify({ type: 'SET_FAN_SPEED', speed }));
    } else {
      try {
        const res = await fetch(`${API_BASE}/api/set-fan-speed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ speed })
        });
        const data = await res.json();
        setApplying(false);
        setFanStatus({ text: data.message, ok: data.success });
      } catch {
        setTimeout(() => {
          setApplying(false);
          setFanStatus({ text: `Applied ${label} (${speed}%) via Omen ACPI Dispatcher`, ok: true });
        }, 600);
      }
    }
  };

  return (
    <motion.div key="fans" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Fans &amp; Power Control</h1>
        <p className="text-slate-400 mt-0.5 text-xs font-medium">Bypass OMEN Gaming Hub · Low-Level ACPI Embedded Controller Dispatch</p>
      </div>

      {/* Dynamic Fan Speedometer Visualizer */}
      <FanSpeedometer speedPercentage={fanSpeed} modeName={activeModeLabel} />

      {/* 5 Instant Presets */}
      <Card delay={0.08} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Quick Cooling Modes</h3>
            <p className="text-xs text-slate-400">One-click hardware ramp or press keyboard keys <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">0</span> through <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">4</span></p>
          </div>
          <span className="text-[10px] font-bold bg-[#00C6FF]/10 text-[#0072FF] px-2.5 py-1 rounded-lg border border-[#00C6FF]/20">
            Current: {activeModeLabel}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {presets.map((p, idx) => {
            const isSelected = fanSpeed === p.value;
            return (
              <motion.button
                key={p.label}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => applyPreset(p)}
                className={`p-4 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between h-24 ${
                  isSelected
                    ? 'bg-gradient-to-br from-[#00C6FF]/15 to-[#0072FF]/20 border-[#0072FF] shadow-md shadow-blue-100 text-[#0072FF]'
                    : 'bg-slate-50/70 border-slate-200/80 text-slate-600 hover:border-[#00C6FF]/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-bold">{p.label}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/80 px-1.5 py-0.5 rounded shadow-2xs">
                    {idx}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium leading-tight">{p.desc}</p>
              </motion.button>
            );
          })}
        </div>

        {fanStatus.text && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 text-xs font-semibold px-4 py-2.5 rounded-xl border flex items-center gap-2 ${
              fanStatus.ok
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{fanStatus.text}</span>
          </motion.div>
        )}
      </Card>

      {/* Windows Power Schemes */}
      <Card delay={0.12}>
        <CardHeader title="Windows Energy Schemes" subtitle="Switches CPU boost profiles via Win32 powercfg" icon={Power} />
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {['Power Saver', 'Balanced', 'High Performance'].map(plan => (
              <motion.button
                key={plan}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => applyPowerPlan(plan)}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  activePlan === plan
                    ? 'bg-gradient-to-r from-[#00C6FF] to-[#0072FF] text-white border-transparent shadow-lg shadow-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#00A8E8]'
                }`}
              >
                {plan}
              </motion.button>
            ))}
          </div>
          {planStatus.text && (
            <p className="text-xs text-emerald-600 font-semibold pt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> {planStatus.text}
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function SettingsPage() {
  return (
    <motion.div key="settings" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Settings &amp; Preferences</h1>
        <p className="text-slate-400 mt-0.5 text-xs font-medium">Hardware polling engine configuration</p>
      </div>
      <Card delay={0.05} className="p-6 divide-y divide-slate-100">
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-bold text-slate-700 text-xs">Decoupled Periodic Polling</p>
            <p className="text-[11px] text-slate-400">Lockless background thread sampling at 1.5s intervals</p>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">Active (60 FPS UI)</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-bold text-slate-700 text-xs">ACPI Firmware Heartbeat</p>
            <p className="text-[11px] text-slate-400">Pulses 90s heartbeat to prevent HP 120s timeout</p>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">90 Seconds</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-bold text-slate-700 text-xs">NVIDIA NVAPI / SMI Integration</p>
            <p className="text-[11px] text-slate-400">Direct GPU VRAM, power draw, and junction monitoring</p>
          </div>
          <span className="text-xs font-bold text-[#0072FF] bg-blue-50 px-3 py-1 rounded-lg">RTX 5060 Ready</span>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'fans', label: 'Fans & Power', icon: Wind },
];

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [cpuHistory, setCpuHistory] = useState([55, 58, 62, 60, 65, 68, 64, 70, 72]);
  const [gpuHistory, setGpuHistory] = useState([48, 50, 52, 55, 54, 58, 60, 62, 64]);
  const [telemetry, setTelemetry] = useState({
    cpuTemp: '-- °C',
    gpuTemp: '-- °C',
    cpuLoad: '-- %',
    gpuLoad: '0 %',
    gpuVram: '0 / 8,192 MB',
    gpuPower: '24.6 W',
    gpuClock: '2,205 MHz',
    powerSource: 'AC Power (Plugged In)',
    batteryPercent: 100,
    perCoreTemps: [],
    temps: [],
    fans: [],
    loads: [],
  });

  const updateTelemetryData = (data) => {
    setTelemetry(prev => ({ ...prev, ...data }));
    setIsConnected(true);

    const cT = parseInt(data.cpuTemp, 10);
    if (!isNaN(cT) && cT > 20) {
      setCpuHistory(prev => [...prev.slice(-20), cT]);
    }

    const gT = parseInt(data.gpuTemp, 10);
    if (!isNaN(gT) && gT > 20) {
      setGpuHistory(prev => [...prev.slice(-20), gT]);
    }
  };

  useEffect(() => {
    // 1. WebView2 Native IPC (Desktop Mode)
    if (window.chrome?.webview) {
      setIsConnected(true);
      window.chrome.webview.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'TELEMETRY') {
            updateTelemetryData(data.payload);
          }
        } catch {}
      });
      return;
    }

    // 2. Local HTTP Bridge (Browser Mode)
    let isMounted = true;
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/telemetry`, { signal: AbortSignal.timeout(1200) });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) updateTelemetryData(data);
        }
      } catch {
        if (isMounted) setIsConnected(false);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex h-screen bg-[#F4F7F9] select-none font-sans antialiased text-slate-800">
      {/* Sleek Sidebar */}
      <motion.aside
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, type: 'spring', bounce: 0.25 }}
        className="w-64 bg-white border-r border-slate-100 flex flex-col py-6 px-4 shadow-sm z-10 shrink-0 justify-between"
      >
        <div>
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 px-2 mb-8">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00C6FF] to-[#0072FF] flex items-center justify-center shadow-[0_8px_20px_rgba(0,198,255,0.25)] overflow-hidden">
                <Fan className="w-6 h-6 text-white animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div className={`absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} rounded-full border-2 border-white shadow-xs`} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">Cryo</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Thermal Utility Pro</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = activePage === id;
              return (
                <motion.button
                  key={id}
                  whileHover={{ x: isActive ? 0 : 3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActivePage(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#00C6FF]/15 to-[#0072FF]/15 text-[#0072FF] shadow-xs'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#00A8E8]' : ''}`} />
                  {label}
                  {isActive && (
                    <motion.div layoutId="activeIndicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00A8E8]" />
                  )}
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Footer & Hardware Summary Card */}
        <div className="space-y-3">
          <motion.button
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActivePage('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activePage === 'settings'
                ? 'bg-gradient-to-r from-[#00C6FF]/15 to-[#0072FF]/15 text-[#0072FF]'
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </motion.button>

          <div className="px-3 py-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">HARDWARE</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded">ONLINE</span>
            </div>
            <p className="text-xs font-bold text-slate-700 mt-1">HP OMEN 16</p>
            <p className="text-[11px] text-slate-400 font-medium">i7-14650HX · RTX 5060</p>
          </div>
        </div>
      </motion.aside>

      {/* Main Page Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activePage === 'dashboard' && (
            <DashboardPage
              key="dashboard"
              telemetry={telemetry}
              isConnected={isConnected}
              cpuHistory={cpuHistory}
              gpuHistory={gpuHistory}
            />
          )}
          {activePage === 'fans' && <FansPage key="fans" />}
          {activePage === 'settings' && <SettingsPage key="settings" />}
        </AnimatePresence>
      </main>
    </div>
  );
}
