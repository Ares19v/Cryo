import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Wind, Activity, Zap, Server, Settings,
  Thermometer, Gauge, Fan, Power, ChevronRight
} from 'lucide-react';

// ─── Reusable Components ────────────────────────────────────────────────────

const Card = ({ children, className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, type: 'spring', bounce: 0.3 }}
    className={`bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden ${className}`}
  >
    {children}
  </motion.div>
);

const CardHeader = ({ title, icon: Icon, color = 'text-cryo-blue' }) => (
  <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
    {Icon && <Icon className={`w-5 h-5 ${color}`} />}
    <h3 className="text-base font-bold text-slate-700">{title}</h3>
  </div>
);

const SensorRow = ({ name, value, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.1 + index * 0.05 }}
    className="flex justify-between items-center px-6 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors"
  >
    <span className="text-sm text-slate-500">{name}</span>
    <span className="text-sm font-bold text-[#0072FF]">{value}</span>
  </motion.div>
);

const StatCard = ({ title, value, icon: Icon, delay, color }) => (
  <Card delay={delay} className="p-6 relative">
    <div className="relative z-10">
      <div className={`inline-flex p-2.5 rounded-xl mb-4 ${color.bg}`}>
        <Icon className={`w-6 h-6 ${color.icon}`} />
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{title}</p>
      <motion.p
        key={value}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.5 }}
        className="text-4xl font-extrabold text-slate-800"
      >
        {value}
      </motion.p>
    </div>
    <Icon className="absolute right-4 bottom-4 w-20 h-20 text-slate-100" strokeWidth={1} />
  </Card>
);

const PowerPlanButton = ({ label, active, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.03 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 border ${
      active
        ? 'bg-gradient-to-r from-[#00C6FF] to-[#0072FF] text-white border-transparent shadow-lg shadow-blue-200'
        : 'bg-white text-slate-500 border-slate-200 hover:border-[#00A8E8] hover:text-[#00A8E8]'
    }`}
  >
    {label}
  </motion.button>
);

// ─── Pages ──────────────────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

function DashboardPage({ telemetry }) {
  return (
    <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800">System Telemetry</h1>
        <p className="text-slate-400 mt-1 text-sm">Live hardware monitoring · HP Omen</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-5">
        <StatCard title="CPU Package Temp" value={telemetry.cpuTemp} icon={Thermometer} delay={0.05}
          color={{ bg: 'bg-blue-50', icon: 'text-[#00A8E8]' }} />
        <StatCard title="GPU Temperature" value={telemetry.gpuTemp} icon={Cpu} delay={0.1}
          color={{ bg: 'bg-emerald-50', icon: 'text-emerald-500' }} />
        <StatCard title="CPU Total Load" value={telemetry.cpuLoad} icon={Gauge} delay={0.15}
          color={{ bg: 'bg-amber-50', icon: 'text-amber-500' }} />
      </div>

      {/* Detail Lists */}
      <div className="grid grid-cols-2 gap-5">
        <Card delay={0.2}>
          <CardHeader title="Detailed Temperatures" icon={Thermometer} />
          <div className="max-h-56 overflow-y-auto">
            {telemetry.temps.length > 0
              ? telemetry.temps.map((s, i) => <SensorRow key={i} name={s.name} value={s.value} index={i} />)
              : <p className="text-slate-400 text-sm p-6 italic">Waiting for sensor data…</p>}
          </div>
        </Card>

        <div className="space-y-5">
          <Card delay={0.25}>
            <CardHeader title="Active Fans" icon={Fan} color="text-emerald-500" />
            <div className="max-h-28 overflow-y-auto">
              {telemetry.fans.length > 0
                ? telemetry.fans.map((s, i) => <SensorRow key={i} name={s.name} value={s.value} index={i} />)
                : <p className="text-slate-400 text-sm p-6 italic">No fan data (run as Administrator)</p>}
            </div>
          </Card>

          <Card delay={0.3}>
            <CardHeader title="System Loads" icon={Activity} color="text-amber-500" />
            <div className="max-h-28 overflow-y-auto">
              {telemetry.loads.length > 0
                ? telemetry.loads.map((s, i) => <SensorRow key={i} name={s.name} value={s.value} index={i} />)
                : <p className="text-slate-400 text-sm p-6 italic">Waiting for data…</p>}
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function FansPage() {
  const [activePlan, setActivePlan] = useState('Balanced');
  const [fanSpeed, setFanSpeed] = useState(50);
  const [applying, setApplying] = useState(false);
  const [fanStatus, setFanStatus] = useState({ text: '', ok: true });
  const [planStatus, setPlanStatus] = useState({ text: '', ok: true });
  const [hpDiag, setHpDiag] = useState('');

  useEffect(() => {
    const handler = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'FAN_SPEED_RESULT') {
          setApplying(false);
          setFanStatus({ text: data.message, ok: data.success });
        }
        if (data.type === 'POWER_PLAN_RESULT') {
          setPlanStatus({
            text: data.success ? `Switched to ${data.plan}` : `Failed to switch plan`,
            ok: data.success
          });
        }
        if (data.type === 'HP_DIAGNOSTICS') {
          setHpDiag(data.message);
        }
      } catch {}
    };
    window.chrome?.webview?.addEventListener('message', handler);
    return () => window.chrome?.webview?.removeEventListener('message', handler);
  }, []);

  const applyPowerPlan = (plan) => {
    setActivePlan(plan);
    setPlanStatus({ text: '', ok: true });
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(JSON.stringify({ type: 'SET_POWER_PLAN', plan }));
    } else {
      // In browser preview mode
      setPlanStatus({ text: `Switched to ${plan} (preview mode)`, ok: true });
    }
  };

  const applyFanSpeed = () => {
    setApplying(true);
    setFanStatus({ text: '', ok: true });
    if (window.chrome?.webview) {
      window.chrome.webview.postMessage(JSON.stringify({ type: 'SET_FAN_SPEED', speed: fanSpeed }));
    } else {
      // In browser preview mode
      setTimeout(() => {
        setApplying(false);
        setFanStatus({ text: `Fan target set to ${fanSpeed}% (preview mode — no C# backend)`, ok: true });
      }, 1200);
    }
  };

  return (
    <motion.div key="fans" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800">Fans &amp; Power</h1>
        <p className="text-slate-400 mt-1 text-sm">Control cooling profiles and power plans</p>
      </div>

      {/* Power Plans */}
      <Card delay={0.05}>
        <CardHeader title="Windows Power Plan" icon={Power} />
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-400">Select an energy profile. Changes apply instantly via Windows powercfg.</p>
          <div className="flex gap-3">
            {['Power Saver', 'Balanced', 'High Performance'].map(plan => (
              <PowerPlanButton
                key={plan}
                label={plan}
                active={activePlan === plan}
                onClick={() => applyPowerPlan(plan)}
              />
            ))}
          </div>
          <p className="text-xs text-slate-300 pt-1">Active: <span className="text-[#00A8E8] font-semibold">{activePlan}</span></p>
        </div>
      </Card>

      {/* Fan Control */}
      <Card delay={0.1}>
        <CardHeader title="HP Omen Fan Control" icon={Fan} color="text-[#00A8E8]" />
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-400 leading-relaxed">
            Control your HP Omen's cooling profile. Maps to HP's ACPI thermal modes via WMI — no need for OMEN Gaming Hub to be open.
            <span className="text-amber-500 font-medium"> HP firmware may override values when on AC power.</span>
          </p>
          {hpDiag && (
            <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg font-mono">{hpDiag}</p>
          )}

          {/* Speed Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-600">Fan Target Speed</span>
              <motion.span
                key={fanSpeed}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-2xl font-extrabold text-[#0072FF]"
              >
                {fanSpeed}%
              </motion.span>
            </div>

            <input
              type="range" min="0" max="100" step="5" value={fanSpeed}
              onChange={(e) => setFanSpeed(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#00A8E8]"
            />

            <div className="flex justify-between text-xs text-slate-300">
              <span>Silent (0%)</span>
              <span>Auto (50%)</span>
              <span>Max (100%)</span>
            </div>
          </div>

          {/* Fan Speed Presets */}
          <div className="flex gap-2">
            {[{ label: '🌙 Silent', value: 20 }, { label: '⚖️ Balanced', value: 50 }, { label: '🔥 Performance', value: 80 }, { label: '❄️ Max Cool', value: 100 }].map(p => (
              <motion.button
                key={p.label}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setFanSpeed(p.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  fanSpeed === p.value
                    ? 'bg-[#00A8E8]/10 border-[#00A8E8] text-[#0072FF]'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-[#00A8E8]'
                }`}
              >
                {p.label}
              </motion.button>
            ))}
          </div>

          {/* Apply Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={applyFanSpeed}
            disabled={applying}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-[#00C6FF] to-[#0072FF] shadow-lg shadow-blue-200 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
          >
            {applying ? (
              <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full"></span> Applying…</>
            ) : (
              <><Zap className="w-4 h-4" /> Apply Fan Profile</>
            )}
          </motion.button>

          {fanStatus.text && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-xs font-medium px-4 py-2 rounded-lg border ${
                fanStatus.ok
                  ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                  : 'text-amber-600 bg-amber-50 border-amber-100'
              }`}
            >
              {fanStatus.ok ? '✓' : '⚠'} {fanStatus.text}
            </motion.p>
          )}
          {planStatus.text && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-xs font-medium px-4 py-2 rounded-lg border ${
                planStatus.ok
                  ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                  : 'text-amber-600 bg-amber-50 border-amber-100'
              }`}
            >
              {planStatus.ok ? '✓' : '⚠'} {planStatus.text}
            </motion.p>
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
        <h1 className="text-3xl font-extrabold text-slate-800">Settings</h1>
        <p className="text-slate-400 mt-1 text-sm">Configure Cryo preferences</p>
      </div>
      <Card delay={0.05} className="p-8">
        <div className="flex items-center justify-center h-32 flex-col gap-3 text-slate-300">
          <Settings className="w-12 h-12" strokeWidth={1} />
          <p className="text-sm">Settings coming soon</p>
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
  const [telemetry, setTelemetry] = useState({
    cpuTemp: '-- °C',
    gpuTemp: '-- °C',
    cpuLoad: '-- %',
    temps: [],
    fans: [],
    loads: [],
  });

  useEffect(() => {
    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'TELEMETRY') {
            setTelemetry(prev => ({ ...prev, ...data.payload }));
          }
        } catch {}
      });
    }
  }, []);

  return (
    <div className="flex h-screen bg-[#F4F7F9] select-none">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
        className="w-60 bg-white border-r border-slate-100 flex flex-col py-6 px-4 shadow-sm z-10 shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center gap-4 px-2 mb-10">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-[0_8px_20px_rgba(0,168,232,0.15)] border border-slate-50 overflow-hidden">
              <img src="/logo.png" alt="Cryo Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <div className="absolute -right-1 -bottom-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white shadow-sm" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 leading-none tracking-tight">Cryo</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Utility Pro</p>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activePage === id;
            return (
              <motion.button
                key={id}
                whileHover={{ x: isActive ? 0 : 3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActivePage(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#00C6FF]/10 to-[#0072FF]/10 text-[#0072FF]'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[#00A8E8]' : ''}`} />
                {label}
                {isActive && (
                  <motion.div layoutId="activeIndicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00A8E8]" />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Settings */}
        <motion.button
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActivePage('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
            activePage === 'settings'
              ? 'bg-gradient-to-r from-[#00C6FF]/10 to-[#0072FF]/10 text-[#0072FF]'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          <Settings className="w-4.5 h-4.5" />
          Settings
        </motion.button>

        {/* System Info */}
        <div className="mt-6 px-2 py-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Device</p>
          <p className="text-xs font-semibold text-slate-600">HP Omen</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] text-slate-400">Monitoring Active</span>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activePage === 'dashboard' && <DashboardPage key="dashboard" telemetry={telemetry} />}
          {activePage === 'fans' && <FansPage key="fans" />}
          {activePage === 'settings' && <SettingsPage key="settings" />}
        </AnimatePresence>
      </main>
    </div>
  );
}
