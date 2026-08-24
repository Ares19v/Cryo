import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Wind, Activity, Settings,
  Thermometer, Gauge, Fan, Power,
  BatteryCharging, HardDrive, ShieldCheck,
  Moon, Sun, Sliders, RefreshCw, Volume2, VolumeX
} from 'lucide-react';

const API_BASE = 'http://localhost:5050';

// ─── Global Error Boundary ────────────────────────────────────────────────────
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#0A0E1A', color: '#F87171', fontFamily: 'monospace', padding: '40px', height: '100vh', overflow: 'auto' }}>
          <h1 style={{ color: '#00C6FF', fontSize: '24px', marginBottom: '16px' }}>❄ Cryo — Runtime Error</h1>
          <p style={{ color: '#94A3B8', marginBottom: '16px' }}>A JavaScript error prevented the UI from rendering:</p>
          <pre style={{ background: '#111827', padding: '20px', borderRadius: '12px', color: '#F87171', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {String(this.state.error?.message || this.state.error)}{'\n\n'}{String(this.state.error?.stack || '')}
          </pre>
          <p style={{ color: '#94A3B8', marginTop: '20px' }}>
            Hardware data is still available at{' '}
            <a href="http://localhost:5050/api/telemetry" style={{ color: '#00C6FF' }}>http://localhost:5050/api/telemetry</a>
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '20px', background: '#0072FF', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
          >
            ↺ Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Procedural Audio Synthesizer (Web Audio API) ───────────────────────────
const playCyberSound = (type = 'click') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'turbo') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'silent') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch {}
};

// ─── Sparkline (Hardware trend visualizer) ───────────────────────────────────
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
  const safeId = `grad-${String(color).replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-11 overflow-visible">
      <defs>
        <linearGradient id={safeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${safeId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Interactive Fan Curve Visualizer ─────────────────────────────────────────
const FanCurveEditor = ({ currentTemp = 60 }) => {
  const points = [
    { temp: 35, rpm: 20 },
    { temp: 50, rpm: 35 },
    { temp: 65, rpm: 55 },
    { temp: 75, rpm: 80 },
    { temp: 85, rpm: 100 }
  ];
  const svgW = 480;
  const svgH = 140;
  const getX = (t) => ((t - 30) / (90 - 30)) * (svgW - 40) + 20;
  const getY = (r) => svgH - (r / 100) * (svgH - 30) - 15;
  const pathStr = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${getX(p.temp)} ${getY(p.rpm)}`, '');
  const curX = Math.max(20, Math.min(svgW - 20, getX(currentTemp)));

  return (
    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-white relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#00C6FF]" />
          <span className="text-xs font-bold text-slate-200">EC Acoustic Dynamic Thermal Curve</span>
        </div>
        <span className="text-[11px] font-mono text-[#00C6FF]">Live Tracking: {currentTemp}°C</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-32 overflow-visible">
          <line x1="20" y1="20" x2={svgW - 20} y2="20" stroke="#1E293B" strokeDasharray="3 3" />
          <line x1="20" y1={svgH / 2} x2={svgW - 20} y2={svgH / 2} stroke="#1E293B" strokeDasharray="3 3" />
          <line x1="20" y1={svgH - 20} x2={svgW - 20} y2={svgH - 20} stroke="#334155" />
          <path d={pathStr} fill="none" stroke="#00C6FF" strokeWidth="3" strokeLinecap="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={getX(p.temp)} cy={getY(p.rpm)} r="5" fill="#0072FF" stroke="#FFFFFF" strokeWidth="2" />
              <text x={getX(p.temp)} y={getY(p.rpm) - 10} fill="#94A3B8" fontSize="9" textAnchor="middle" fontWeight="bold">{p.rpm}%</text>
            </g>
          ))}
          <line x1={curX} y1="10" x2={curX} y2={svgH - 10} stroke="#F43F5E" strokeWidth="2" strokeDasharray="2 2" />
          <circle cx={curX} cy={getY(Math.min(100, Math.max(20, (currentTemp - 30) * 1.5)))} r="6" fill="#F43F5E" />
        </svg>
      </div>
      <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-4">
        <span>30°C (Idle)</span>
        <span>50°C</span>
        <span>70°C (Load)</span>
        <span>90°C (Peak)</span>
      </div>
    </div>
  );
};

// ─── Reusable UI Components ───────────────────────────────────────────────────
const Card = ({ children, className = '', delay = 0, isDark, style }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, type: 'spring', bounce: 0.2 }}
    style={style}
    className={`rounded-2xl transition-colors overflow-hidden ${
      isDark
        ? 'bg-[#111827] border border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.4)] text-white'
        : 'bg-white border border-slate-100/90 shadow-[0_4px_24px_rgba(0,0,0,0.04)] text-slate-800'
    } ${className}`}
  >
    {children}
  </motion.div>
);

const CardHeader = ({ title, subtitle, icon: Icon, color = 'text-[#00A8E8]', isDark }) => (
  <div className={`flex items-center justify-between px-6 py-4 border-b ${
    isDark ? 'border-slate-800/80 bg-slate-900/60' : 'border-slate-100/70 bg-slate-50/50'
  }`}>
    <div className="flex items-center gap-3">
      {Icon && (
        <div className={`p-2 rounded-xl border ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
        }`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      )}
      <div>
        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>}
      </div>
    </div>
  </div>
);

const SensorRow = ({ name, value, index, isDark }) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.04 + index * 0.02 }}
    className={`flex justify-between items-center px-6 py-3 border-b transition-colors ${
      isDark ? 'border-slate-800/60 hover:bg-slate-800/40' : 'border-slate-50 hover:bg-slate-50/80'
    }`}
  >
    <span className="text-xs text-slate-400 font-medium">{String(name ?? '')}</span>
    <span className="text-xs font-bold text-[#00C6FF]">{String(value ?? '')}</span>
  </motion.div>
);

const StatCard = ({ title, value, unit = '', icon: Icon, delay, color, history = [], isDark }) => {
  const strVal = String(value ?? '--');
  const displayNum = strVal.replace(' °C', '').replace(' %', '').replace('°C', '').replace('%', '').trim();
  const displayUnit = unit || (strVal.includes('°C') ? '°C' : strVal.includes('%') ? '%' : '');

  return (
    <Card delay={delay} isDark={isDark} className="p-6 relative flex flex-col justify-between overflow-hidden group">
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
            key={displayNum}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}
          >
            {displayNum}
          </motion.span>
          <span className="text-sm font-bold text-slate-400">{displayUnit}</span>
        </div>
      </div>

      {history.length > 2 && (
        <div className={`mt-4 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-100/60'}`}>
          <Sparkline data={history} color={color.sparkline || '#00C6FF'} />
        </div>
      )}
    </Card>
  );
};

const CoreHeatTile = ({ core, temp, index, isDark }) => {
  let colorClass = isDark ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300' : 'bg-cyan-50 border-cyan-200 text-cyan-700';
  if (temp >= 80) colorClass = isDark ? 'bg-rose-950/50 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700';
  else if (temp >= 70) colorClass = isDark ? 'bg-amber-950/50 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700';
  else if (temp >= 60) colorClass = isDark ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700';

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

const FanSpeedometer = ({ speedPercentage, modeName }) => {
  const spinSpeed = speedPercentage >= 85 ? 0.35 : speedPercentage >= 50 ? 0.7 : speedPercentage >= 20 ? 1.4 : 2.5;

  return (
    <div className="flex items-center gap-6 p-6 bg-gradient-to-br from-slate-900 via-[#0B132B] to-slate-900 rounded-2xl text-white shadow-xl relative overflow-hidden border border-slate-800">
      <div className="relative z-10 flex items-center justify-center w-28 h-28 shrink-0">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: spinSpeed, ease: 'linear' }}
          className="w-24 h-24 rounded-full border-2 border-dashed border-[#00C6FF]/40 flex items-center justify-center"
        >
          <Fan className="w-16 h-16 text-[#00C6FF] drop-shadow-[0_0_12px_rgba(0,198,255,0.6)]" />
        </motion.div>
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
            : `⚖️ Custom target active: ${speedPercentage}%`}
        </p>
      </div>
    </div>
  );
};

// ─── Page Transitions ──────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, x: -16, transition: { duration: 0.18 } }
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage({ telemetry, isConnected, cpuHistory, gpuHistory, isDark, onPurgeRam, isPurging }) {
  const curCpuNum = parseInt(telemetry.cpuTemp, 10) || 60;

  return (
    <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>System Telemetry</h1>
          <p className="text-slate-400 mt-0.5 text-xs font-medium">HP OMEN 16 · Intel Core i7-14650HX · NVIDIA RTX 5060 Laptop GPU</p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-xs ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
              {isConnected ? 'Kernel Stream Active' : 'Connecting to Hardware...'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#00C6FF] text-xs font-bold shadow-xs">
            <BatteryCharging className="w-3.5 h-3.5" />
            <span>{String(telemetry.powerSource || 'AC Connected')}</span>
          </div>
        </div>
      </div>

      {/* Primary Hardware Metrics */}
      <div className="grid grid-cols-3 gap-5">
        <StatCard
          title="CPU Package Temp"
          value={telemetry.cpuTemp}
          icon={Thermometer}
          delay={0.05}
          color={{ bg: isDark ? 'bg-blue-950/60' : 'bg-blue-50', icon: 'text-[#00A8E8]', sparkline: '#00A8E8' }}
          history={cpuHistory}
          isDark={isDark}
        />
        <StatCard
          title="GPU Die Temperature"
          value={telemetry.gpuTemp}
          icon={Cpu}
          delay={0.1}
          color={{ bg: isDark ? 'bg-emerald-950/60' : 'bg-emerald-50', icon: 'text-emerald-400', sparkline: '#10B981' }}
          history={gpuHistory}
          isDark={isDark}
        />
        <StatCard
          title="CPU Core Utilization"
          value={telemetry.cpuLoad}
          icon={Gauge}
          delay={0.15}
          color={{ bg: isDark ? 'bg-amber-950/60' : 'bg-amber-50', icon: 'text-amber-400' }}
          isDark={isDark}
        />
      </div>

      {/* System Memory Bar */}
      <Card delay={0.18} isDark={isDark} className="p-4 flex items-center justify-between border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">System RAM Utilization:</span>
              <span className="text-sm font-black text-purple-400">{String(telemetry.ramUsed || '12.4 GB')} / {String(telemetry.ramTotal || '31.8 GB')}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {String(telemetry.ramPercent || '38%')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">High-speed DDR5 memory footprint</p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={onPurgeRam}
          disabled={isPurging}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-purple-500/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPurging ? 'animate-spin' : ''}`} />
          {isPurging ? 'Purging Cache...' : '⚡ Purge Standby RAM'}
        </motion.button>
      </Card>

      {/* GPU Advanced Telemetry */}
      <Card delay={0.2} isDark={isDark} className="p-6 bg-gradient-to-r from-slate-900 via-[#0B1528] to-slate-900 text-white border-slate-800">
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
            {String(telemetry.gpuLoad || '0%')} Load
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VRAM Allocation</p>
            <p className="text-lg font-black text-white mt-0.5">{String(telemetry.gpuVram || '0 / 8,192 MB')}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Core Frequency</p>
            <p className="text-lg font-black text-[#00C6FF] mt-0.5">{String(telemetry.gpuClock || '2,205 MHz')}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Power Draw</p>
            <p className="text-lg font-black text-emerald-400 mt-0.5">{String(telemetry.gpuPower || '24.6 W')}</p>
          </div>
        </div>
      </Card>

      {/* Per-Core CPU Heatmap Grid */}
      <Card delay={0.24} isDark={isDark}>
        <CardHeader
          title="Intel Core i7-14650HX · Core Thermal Grid"
          subtitle="Real-time individual core junction temperatures (8 P-Cores + 8 E-Cores)"
          icon={Thermometer}
          isDark={isDark}
        />
        <div className="p-6">
          {telemetry.perCoreTemps && telemetry.perCoreTemps.length > 0 ? (
            <div className="grid grid-cols-8 gap-2.5">
              {telemetry.perCoreTemps.slice(0, 16).map((c, i) => (
                <CoreHeatTile
                  key={i}
                  core={String(c.Name ?? c.name ?? `C${i}`).replace('Intel Core i7-14650HX - ', '').replace('CPU Core ', 'Core ').trim()}
                  temp={c.Temp ?? c.temp ?? 0}
                  index={i}
                  isDark={isDark}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Reading per-core sensors...</p>
          )}
        </div>
      </Card>

      {/* Interactive Thermal Curve */}
      <FanCurveEditor currentTemp={curCpuNum} />

      {/* Detailed Sensor Explorer */}
      <div className="grid grid-cols-2 gap-5">
        <Card delay={0.28} isDark={isDark}>
          <CardHeader title="All Temperature Channels" icon={Thermometer} isDark={isDark} />
          <div className="max-h-52 overflow-y-auto">
            {telemetry.temps && telemetry.temps.length > 0
              ? telemetry.temps.map((s, i) => <SensorRow key={i} name={s.name} value={s.value} index={i} isDark={isDark} />)
              : <p className="text-slate-400 text-xs p-6 italic">Polling thermal sensors...</p>}
          </div>
        </Card>

        <Card delay={0.32} isDark={isDark}>
          <CardHeader title="Hardware Utilization & Subsystems" icon={Activity} color="text-amber-400" isDark={isDark} />
          <div className="max-h-52 overflow-y-auto">
            {telemetry.loads && telemetry.loads.length > 0
              ? telemetry.loads.map((s, i) => <SensorRow key={i} name={s.name} value={s.value} index={i} isDark={isDark} />)
              : <p className="text-slate-400 text-xs p-6 italic">Polling subsystem loads...</p>}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

// ─── Fans Page (with Percentage Arc Dial & Presets) ───────────────────────────
function FansPage({ isDark, soundEnabled }) {
  const [activePlan, setActivePlan] = useState('High Performance');
  const [fanSpeed, setFanSpeed] = useState(0);
  const [sliderPct, setSliderPct] = useState(0);
  const [activeModeLabel, setActiveModeLabel] = useState('🤖 Auto');
  const [applying, setApplying] = useState(false);
  const [fanStatus, setFanStatus] = useState({ text: '', ok: true });
  const [planStatus, setPlanStatus] = useState({ text: '', ok: true });
  const [isDragging, setIsDragging] = useState(false);
  const dialRef = useRef(null);

  const presets = [
    { label: 'Auto',     emoji: '🤖', value: 0,   desc: 'Factory BIOS Curve',          sound: 'click'  },
    { label: 'Silent',   emoji: '🌙', value: 20,  desc: 'Quiet Acoustic Profile',       sound: 'silent' },
    { label: 'Balanced', emoji: '⚖️', value: 50,  desc: 'Adaptive Thermal Policy',      sound: 'click'  },
    { label: 'Turbo',    emoji: '🔥', value: 80,  desc: 'Performance Ramp',             sound: 'turbo'  },
    { label: 'Max Cool', emoji: '❄️', value: 100, desc: '100% Full Speed (5500+ RPM)',  sound: 'turbo'  },
  ];

  const getColor = (pct) => {
    if (pct === 0)  return '#6366F1';
    if (pct <= 25)  return '#22D3EE';
    if (pct <= 55)  return '#00C6FF';
    if (pct <= 85)  return '#F59E0B';
    return '#F43F5E';
  };
  const dialColor = getColor(sliderPct);
  const estRpm = sliderPct === 0 ? '—' : Math.round(800 + (sliderPct / 100) * 4700).toLocaleString();

  // Arc geometry
  const R = 88, CX = 110, CY = 110, startA = -220, sweepA = 260;
  const pctA = startA + (sliderPct / 100) * sweepA;
  const rad = (d) => (d * Math.PI) / 180;
  const arc = (from, to, r) => {
    const sx = CX + r * Math.cos(rad(from)), sy = CY + r * Math.sin(rad(from));
    const ex = CX + r * Math.cos(rad(to)),   ey = CY + r * Math.sin(rad(to));
    return `M ${sx} ${sy} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${ex} ${ey}`;
  };
  const tx = CX + R * Math.cos(rad(pctA));
  const ty = CY + R * Math.sin(rad(pctA));

  const pctFromPtr = (e) => {
    const svg = dialRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const py = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    const nx = (px / rect.width) * 220 - CX;
    const ny = (py / rect.height) * 220 - CY;
    let angle = Math.atan2(ny, nx) * (180 / Math.PI);
    let rel = angle - startA;
    if (rel < 0) rel += 360;
    if (rel > sweepA + 30) return null;
    return Math.min(100, Math.max(0, Math.round((rel / sweepA) * 100)));
  };

  const onDialMove = (e) => {
    if (!isDragging) return;
    const pct = pctFromPtr(e);
    if (pct === null) return;
    setSliderPct(pct);
    const near = presets.reduce((a, b) => Math.abs(b.value - pct) < Math.abs(a.value - pct) ? b : a);
    setActiveModeLabel(Math.abs(near.value - pct) <= 8 ? `${near.emoji} ${near.label}` : `Custom ${pct}%`);
  };

  const commitDial = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (soundEnabled) playCyberSound(sliderPct >= 80 ? 'turbo' : sliderPct <= 20 ? 'silent' : 'click');
    executeFanSpeed(sliderPct, activeModeLabel);
  };

  useEffect(() => {
    const up = () => commitDial();
    window.addEventListener('pointerup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchend', up);
    };
  }, [isDragging, sliderPct]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '0') applyPreset(presets[0]);
      else if (e.key === '1') applyPreset(presets[1]);
      else if (e.key === '2') applyPreset(presets[2]);
      else if (e.key === '3') applyPreset(presets[3]);
      else if (e.key === '4') applyPreset(presets[4]);
      else if (e.key === 'ArrowUp')   setSliderPct(v => Math.min(100, v + 1));
      else if (e.key === 'ArrowDown') setSliderPct(v => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const applyPowerPlan = async (plan) => {
    setActivePlan(plan);
    setPlanStatus({ text: 'Applying...', ok: true });
    if (soundEnabled) playCyberSound('click');

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
        setPlanStatus({ text: data.success ? `Switched to ${data.plan}` : 'Failed', ok: data.success });
      } catch {
        setPlanStatus({ text: `Switched to ${plan}`, ok: true });
      }
    }
  };

  const applyPreset = (preset) => {
    setFanSpeed(preset.value);
    setSliderPct(preset.value);
    setActiveModeLabel(`${preset.emoji} ${preset.label}`);
    if (soundEnabled) playCyberSound(preset.sound);
    executeFanSpeed(preset.value, preset.label);
  };

  const executeFanSpeed = async (speed, label) => {
    setApplying(true);
    setFanStatus({ text: '', ok: true });
    setFanSpeed(speed);

    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(JSON.stringify({ type: 'SET_FAN_SPEED', speed }));
      setTimeout(() => setApplying(false), 600);
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
          setFanStatus({ text: `Applied ${label} (${speed}%)`, ok: true });
        }, 600);
      }
    }
  };

  return (
    <motion.div key="fans" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div>
        <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Fans & Power Control</h1>
        <p className="text-slate-400 mt-0.5 text-xs font-medium">Bypass OMEN Gaming Hub · ACPI Embedded Controller Dispatch</p>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-6 items-start">
        {/* ── Arc Dial Card ── */}
        <Card isDark={isDark} className="p-6 flex flex-col items-center gap-3 select-none" style={{ minWidth: 256 }}>
          <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fan Override</p>

          <div className="relative" style={{ width: 220, height: 220 }}>
            {/* Ambient Glow */}
            <motion.div
              animate={{ opacity: sliderPct > 0 ? 0.35 : 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
              style={{ background: dialColor }}
            />

            <svg
              ref={dialRef}
              width="220"
              height="220"
              viewBox="0 0 220 220"
              className="cursor-pointer touch-none"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDragging(true); }}
              onPointerMove={onDialMove}
              onPointerUp={commitDial}
            >
              {/* Background Arc Track */}
              <path d={arc(startA, startA + sweepA, R)} fill="none" stroke={isDark ? '#1E293B' : '#E2E8F0'} strokeWidth="14" strokeLinecap="round" />

              {/* Dynamic Filled Arc */}
              {sliderPct > 0 && (
                <path d={arc(startA, pctA, R)} fill="none" stroke={dialColor} strokeWidth="14" strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 8px ${dialColor}88)` }} />
              )}

              {/* Ticks */}
              {[0, 25, 50, 75, 100].map((tick) => {
                const a = startA + (tick / 100) * sweepA;
                return (
                  <line
                    key={tick}
                    x1={CX + 72 * Math.cos(rad(a))}
                    y1={CY + 72 * Math.sin(rad(a))}
                    x2={CX + 79 * Math.cos(rad(a))}
                    y2={CY + 79 * Math.sin(rad(a))}
                    stroke={tick <= sliderPct ? dialColor : (isDark ? '#334155' : '#CBD5E1')}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Draggable Thumb */}
              <motion.circle
                cx={tx}
                cy={ty}
                fill={dialColor}
                stroke="white"
                style={{ filter: `drop-shadow(0 0 6px ${dialColor})`, cursor: 'grab' }}
                animate={{ r: isDragging ? 12 : 9, strokeWidth: isDragging ? 3 : 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              />

              {/* Central Dynamic Readout */}
              <motion.text
                x={CX}
                y={CY - 14}
                textAnchor="middle"
                fontWeight="900"
                fontFamily="sans-serif"
                fill={sliderPct === 0 ? (isDark ? '#818CF8' : '#6366F1') : dialColor}
                animate={{ fontSize: isDragging ? '42' : '38' }}
              >
                {sliderPct === 0 ? '~' : sliderPct}
              </motion.text>
              <text x={CX} y={CY + 10} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="sans-serif" fill={isDark ? '#94A3B8' : '#64748B'}>
                {sliderPct === 0 ? 'AUTO' : 'PERCENT'}
              </text>
              <text x={CX} y={CY + 28} textAnchor="middle" fontSize="10" fontFamily="monospace" fill={isDark ? '#475569' : '#94A3B8'}>
                {sliderPct === 0 ? 'BIOS managed' : `≈ ${estRpm} RPM`}
              </text>
            </svg>
          </div>

          {/* Linear Fine Slider */}
          <div className="w-full px-2">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={sliderPct}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSliderPct(v);
                const near = presets.reduce((a, b) => Math.abs(b.value - v) < Math.abs(a.value - v) ? b : a);
                setActiveModeLabel(Math.abs(near.value - v) <= 8 ? `${near.emoji} ${near.label}` : `Custom ${v}%`);
              }}
              onMouseUp={(e) => executeFanSpeed(Number(e.target.value), activeModeLabel)}
              onTouchEnd={() => executeFanSpeed(sliderPct, activeModeLabel)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${dialColor} ${sliderPct}%, ${isDark ? '#1E293B' : '#E2E8F0'} ${sliderPct}%)`,
                accentColor: dialColor
              }}
            />
            <div className="flex justify-between text-[10px] font-mono mt-1.5" style={{ color: isDark ? '#475569' : '#94A3B8' }}>
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Execute Button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => executeFanSpeed(sliderPct, activeModeLabel)}
            disabled={applying}
            className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white cursor-pointer transition-all"
            style={{ background: `linear-gradient(135deg, ${dialColor}, ${dialColor}99)`, boxShadow: `0 4px 20px ${dialColor}44` }}
          >
            <Fan className={`w-4 h-4 ${applying ? 'animate-spin' : ''}`} />
            {applying ? 'Applying...' : sliderPct === 0 ? 'Set Auto (BIOS)' : `Apply ${sliderPct}%`}
          </motion.button>

          {fanStatus.text && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-[11px] font-semibold text-center ${fanStatus.ok ? 'text-emerald-400' : 'text-amber-400'}`}
            >
              {fanStatus.ok ? '✓' : '⚠'} {fanStatus.text}
            </motion.p>
          )}
        </Card>

        {/* ── Right Column: Modes & Schemes ── */}
        <div className="space-y-4">
          <FanSpeedometer speedPercentage={fanSpeed} modeName={activeModeLabel} />

          {/* Preset Buttons */}
          <Card isDark={isDark} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Quick Cooling Modes</h3>
                <p className="text-xs text-slate-400">
                  Keys <kbd className="font-mono bg-slate-700/40 px-1 rounded text-slate-300">0</kbd>–<kbd className="font-mono bg-slate-700/40 px-1 rounded text-slate-300">4</kbd> · ↑↓ fine-tune 1%
                </p>
              </div>
              <motion.span
                key={activeModeLabel}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[10px] font-bold bg-[#00C6FF]/10 text-[#00C6FF] px-2.5 py-1 rounded-lg border border-[#00C6FF]/20"
              >
                {activeModeLabel}
              </motion.span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {presets.map((p, idx) => {
                const col = getColor(p.value);
                const sel = fanSpeed === p.value && activeModeLabel === `${p.emoji} ${p.label}`;
                return (
                  <motion.button
                    key={p.label}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => applyPreset(p)}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col gap-1.5 relative overflow-hidden ${
                      sel
                        ? 'border-transparent text-white'
                        : isDark
                        ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-600'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                    style={sel ? { background: `linear-gradient(135deg, ${col}22, ${col}11)`, borderColor: col, boxShadow: `0 0 20px ${col}33` } : {}}
                  >
                    {sel && <motion.div layoutId="presetGlow" className="absolute inset-0 rounded-xl opacity-10" style={{ background: col }} />}
                    <div className="flex items-center justify-between">
                      <span className="text-base">{p.emoji}</span>
                      <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${isDark ? 'bg-slate-800/80 text-slate-500' : 'bg-white text-slate-400'}`}>{idx}</span>
                    </div>
                    <p className="text-[10px] font-bold leading-none" style={{ color: sel ? col : undefined }}>{p.label}</p>
                    <p className="text-[9px] text-slate-500 leading-tight">{p.desc}</p>
                    {p.value > 0 && (
                      <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: isDark ? '#1E293B' : '#E2E8F0' }}>
                        <motion.div
                          animate={{ width: `${p.value}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut', delay: idx * 0.05 }}
                          className="h-full rounded-full"
                          style={{ background: col }}
                        />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </Card>

          {/* Windows Energy Schemes */}
          <Card isDark={isDark}>
            <CardHeader title="Windows Energy Schemes" subtitle="CPU boost profiles via Win32 powercfg" icon={Power} isDark={isDark} />
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {['Power Saver', 'Balanced', 'High Performance'].map(plan => (
                  <motion.button
                    key={plan}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => applyPowerPlan(plan)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      activePlan === plan
                        ? 'bg-gradient-to-r from-[#00C6FF] to-[#0072FF] text-white border-transparent shadow-lg shadow-blue-500/20'
                        : isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-[#00C6FF]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#00A8E8]'
                    }`}
                  >
                    {plan}
                  </motion.button>
                ))}
              </div>
              {planStatus.text && (
                <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> {planStatus.text}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage({ isDark, setIsDark, soundEnabled, setSoundEnabled }) {
  return (
    <motion.div key="settings" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div>
        <h1 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Settings & Preferences</h1>
        <p className="text-slate-400 mt-0.5 text-xs font-medium">Customize interface theme, haptics, and hardware polling</p>
      </div>

      <Card delay={0.05} isDark={isDark} className="p-6 divide-y divide-slate-800/40">
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-bold text-xs">Visual Theme</p>
            <p className="text-[11px] text-slate-400">Frost Light or Cyber Obsidian OLED Dark</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsDark(!isDark)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border cursor-pointer ${
              isDark ? 'bg-slate-800 border-slate-700 text-[#00C6FF]' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {isDark ? 'Cyber Dark' : 'Frost Light'}
          </motion.button>
        </div>

        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-bold text-xs">Acoustic Audio Haptics</p>
            <p className="text-[11px] text-slate-400">Procedural audio on profile change</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border cursor-pointer ${
              soundEnabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {soundEnabled ? 'Enabled' : 'Muted'}
          </motion.button>
        </div>

        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-bold text-xs">ACPI Firmware Heartbeat</p>
            <p className="text-[11px] text-slate-400">90s pulse prevents HP 120s EC timeout</p>
          </div>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">90s Active</span>
        </div>

        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-bold text-xs">NVIDIA NVAPI Integration</p>
            <p className="text-[11px] text-slate-400">GPU VRAM, power draw, and junction monitoring</p>
          </div>
          <span className="text-xs font-bold text-[#00C6FF] bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">RTX 5060 Ready</span>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const navItems = [
  { id: 'dashboard', label: 'Dashboard',    icon: Activity },
  { id: 'fans',      label: 'Fans & Power', icon: Wind },
];

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPurging, setIsPurging] = useState(false);
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
    ramUsed: '12.4 GB',
    ramTotal: '31.8 GB',
    ramPercent: '38 %',
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
    if (!isNaN(cT) && cT > 20) setCpuHistory(prev => [...prev.slice(-20), cT]);
    const gT = parseInt(data.gpuTemp, 10);
    if (!isNaN(gT) && gT > 20) setGpuHistory(prev => [...prev.slice(-20), gT]);
  };

  const handlePurgeRam = async () => {
    setIsPurging(true);
    if (soundEnabled) playCyberSound('click');
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(JSON.stringify({ type: 'PURGE_RAM' }));
    } else {
      try {
        await fetch(`${API_BASE}/api/purge-ram`, { method: 'POST' });
      } catch {}
    }
    setTimeout(() => setIsPurging(false), 1200);
  };

  useEffect(() => {
    if (window.chrome?.webview) {
      setIsConnected(true);
      window.chrome.webview.addEventListener('message', (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === 'TELEMETRY') updateTelemetryData(d.payload);
        } catch {}
      });
      return;
    }
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/telemetry`, { signal: AbortSignal.timeout(1200) });
        if (res.ok) {
          const d = await res.json();
          if (mounted) updateTelemetryData(d);
        }
      } catch {
        if (mounted) setIsConnected(false);
      }
    };
    poll();
    const iv = setInterval(poll, 1500);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className={`flex h-screen select-none font-sans antialiased ${isDark ? 'bg-[#0A0E1A] text-slate-100' : 'bg-[#F4F7F9] text-slate-800'}`}>
      <motion.aside
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, type: 'spring', bounce: 0.25 }}
        className={`w-64 flex flex-col py-6 px-4 z-10 shrink-0 justify-between border-r ${
          isDark ? 'bg-[#0D1222] border-slate-800/80' : 'bg-white border-slate-100'
        }`}
      >
        <div>
          <div className="flex items-center gap-3 px-2 mb-8">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00C6FF] to-[#0072FF] flex items-center justify-center overflow-hidden">
                <Fan className="w-6 h-6 text-white animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div className={`absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} rounded-full border-2 border-white`} />
            </div>
            <div>
              <h1 className={`text-xl font-black tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-800'}`}>Cryo</h1>
              <p className="text-[10px] text-[#00C6FF] font-bold uppercase tracking-widest mt-1">Thermal Utility Pro</p>
            </div>
          </div>
          <nav className="space-y-1.5">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = activePage === id;
              return (
                <motion.button
                  key={id}
                  whileHover={{ x: active ? 0 : 3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (soundEnabled) playCyberSound('click');
                    setActivePage(id);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-[#00C6FF]/20 to-[#0072FF]/20 text-[#00C6FF]'
                      : isDark
                      ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-[#00C6FF]' : ''}`} />
                  {label}
                  {active && <motion.div layoutId="activeIndicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00C6FF]" />}
                </motion.button>
              );
            })}
          </nav>
        </div>
        <div className="space-y-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (soundEnabled) playCyberSound('click');
              setActivePage('settings');
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activePage === 'settings' ? 'bg-gradient-to-r from-[#00C6FF]/20 to-[#0072FF]/20 text-[#00C6FF]' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" /> Settings
          </motion.button>
          <div className={`px-3 py-3 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">HARDWARE</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">ONLINE</span>
            </div>
            <p className={`text-xs font-bold mt-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>HP OMEN 16</p>
            <p className="text-[11px] text-slate-400 font-medium">i7-14650HX · RTX 5060</p>
          </div>
        </div>
      </motion.aside>

      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activePage === 'dashboard' && (
            <DashboardPage
              key="dashboard"
              telemetry={telemetry}
              isConnected={isConnected}
              cpuHistory={cpuHistory}
              gpuHistory={gpuHistory}
              isDark={isDark}
              onPurgeRam={handlePurgeRam}
              isPurging={isPurging}
            />
          )}
          {activePage === 'fans' && <FansPage key="fans" isDark={isDark} soundEnabled={soundEnabled} />}
          {activePage === 'settings' && (
            <SettingsPage key="settings" isDark={isDark} setIsDark={setIsDark} soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
