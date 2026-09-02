import { ProjectTemplate } from './types';

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'saas-analytics',
    title: 'SaaS Pulse Analytics Studio',
    description: 'Modern full-stack metrics dashboard with real-time MRR charts, active user heatmaps, conversion funnel, and team management.',
    icon: 'Activity',
    category: 'Full-Stack Web',
    badge: 'Popular',
    initialPrompt: 'Create a modern SaaS metrics analytics dashboard with real-time revenue graphs, user churn prediction, and dark mode UI.',
    files: {
      'package.json': JSON.stringify({
        name: 'saas-pulse-analytics',
        version: '1.0.0',
        scripts: { dev: 'vite', build: 'vite build' },
        dependencies: { react: '^18.2.0', 'lucide-react': '^0.344.0', recharts: '^2.12.0' }
      }, null, 2),
      'src/App.jsx': `import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, DollarSign, ArrowUpRight, ArrowDownRight, 
  Activity, Zap, Shield, Sparkles, Bell, Search, RefreshCw, BarChart3, Filter
} from 'lucide-react';

export default function App() {
  const [timeRange, setTimeRange] = useState('7d');
  const [metrics, setMetrics] = useState({
    mrr: 48290,
    mrrGrowth: 14.2,
    activeUsers: 12450,
    userGrowth: 8.6,
    conversionRate: 4.85,
    convGrowth: -0.4,
    healthScore: 98.4
  });
  const [liveEvents, setLiveEvents] = useState([
    { id: 1, user: 'Sarah Lin', action: 'Upgraded to Enterprise Tier ($990/mo)', time: 'Just now', icon: '🚀' },
    { id: 2, user: 'Alex Novak', action: 'Invited 5 new team members', time: '2m ago', icon: '👥' },
    { id: 3, user: 'Stripe Webhook', action: 'Processed recurring payment $249.00', time: '6m ago', icon: '💳' },
    { id: 4, user: 'Dev Team', action: 'Deployed AI Router v2.4 (Latency -35ms)', time: '12m ago', icon: '⚡' }
  ]);

  // Simulate real-time live pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 5) - 2,
        mrr: prev.mrr + (Math.random() > 0.6 ? 15 : 0)
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const chartData = [
    { day: 'Mon', revenue: 4200, users: 1800, cost: 650 },
    { day: 'Tue', revenue: 5600, users: 2400, cost: 720 },
    { day: 'Wed', revenue: 7100, users: 3100, cost: 890 },
    { day: 'Thu', revenue: 6800, users: 2950, cost: 820 },
    { day: 'Fri', revenue: 8400, users: 4100, cost: 1100 },
    { day: 'Sat', revenue: 9900, users: 4900, cost: 1250 },
    { day: 'Sun', revenue: 11200, users: 5600, cost: 1400 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans antialiased">
      {/* Top Navigation */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Pulse SaaS Engine
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Live v3.8</span>
              </h1>
              <p className="text-xs text-slate-400">Autonomous growth metrics & AI revenue intelligence</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center gap-1">
            {['24h', '7d', '30d', 'Quarter'].map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={\`px-3 py-1.5 text-xs font-medium rounded-md transition-all \${
                  timeRange === r 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200'
                }\`}
              >
                {r}
              </button>
            ))}
          </div>

          <button className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Stripe
          </button>
        </div>
      </header>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 hover:border-indigo-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Monthly Recurring Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">\${metrics.mrr.toLocaleString()}</span>
            <span className="flex items-center text-xs font-semibold text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +{metrics.mrrGrowth}%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Annual Run Rate: \${(metrics.mrr * 12).toLocaleString()}</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 hover:border-indigo-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Subscribed Users</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">{metrics.activeUsers.toLocaleString()}</span>
            <span className="flex items-center text-xs font-semibold text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +{metrics.userGrowth}%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Peak concurrent: 3,840 nodes</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 hover:border-indigo-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Funnel Conversion Rate</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">{metrics.conversionRate}%</span>
            <span className="flex items-center text-xs font-semibold text-amber-400">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> {metrics.convGrowth}%
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Industry benchmark: 3.2%</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 hover:border-indigo-500/40 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">System Health & SLA</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white tracking-tight">{metrics.healthScore}%</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Optimal</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Global latency: 19ms avg</p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Chart Simulator */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800/90 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Revenue Velocity & Inflow</h2>
              <p className="text-xs text-slate-400">Comparing gross weekly revenue against server inference load</p>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
              +28.4% vs last week
            </span>
          </div>

          <div className="h-64 flex items-end gap-3 pt-6 border-b border-slate-800">
            {chartData.map((item, idx) => {
              const heightPct = Math.round((item.revenue / 12000) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono text-indigo-300 bg-slate-800 px-1.5 py-0.5 rounded shadow">
                    \${item.revenue}
                  </div>
                  <div 
                    style={{ height: \`\${heightPct}%\` }}
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 via-indigo-500 to-purple-400 group-hover:from-indigo-500 group-hover:to-pink-400 transition-all duration-300 shadow-lg shadow-indigo-600/20 relative"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/40 rounded-t-lg" />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{item.day}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Revenue Inflow</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> User Engagement</span>
            </div>
            <button className="text-indigo-400 hover:text-indigo-300 font-medium">Export CSV Report →</button>
          </div>
        </div>

        {/* Live Feed & AI Suggestions */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-400" />
                Live Agent Activity
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>

            <div className="space-y-3">
              {liveEvents.map((e) => (
                <div key={e.id} className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors flex items-start gap-3">
                  <span className="text-lg">{e.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-200 truncate">{e.user}</p>
                      <span className="text-[10px] text-slate-500">{e.time}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{e.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="bg-indigo-950/50 border border-indigo-500/20 rounded-xl p-3">
              <div className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> AI Conductor Recommendation
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Conversion drop on mobile checkout (3.4% vs 5.2% desktop). Enable 1-click Apple Pay checkout to unlock ~\$4.2k/mo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`,
      'src/index.css': `@import "tailwindcss";`
    }
  },
  {
    id: 'ai-conductor-workbench',
    title: 'Conductor AI Agent Workbench',
    description: 'Interactive playground for prompt tuning, multimodal vision/audio tools, agent memory inspect, and step-by-step reasoning debugger.',
    icon: 'Bot',
    category: 'AI & Agents',
    badge: 'Flagship',
    initialPrompt: 'Build an AI Agent Playground with system prompts, temperature sliders, tool call logs, and reasoning step viewer.',
    files: {
      'package.json': JSON.stringify({
        name: 'conductor-ai-agent-workbench',
        version: '1.0.0',
        dependencies: { react: '^18.2.0', 'lucide-react': '^0.344.0' }
      }, null, 2),
      'src/App.jsx': `import React, { useState } from 'react';
import { 
  Bot, Terminal, Play, Sparkles, Cpu, Sliders, Layers, CheckCircle2, 
  ArrowRight, ShieldCheck, Database, RefreshCw, Send, Code, Settings
} from 'lucide-react';

export default function App() {
  const [prompt, setPrompt] = useState('Build a real-time web crawler agent that monitors hacker news and notifies on Gemini releases.');
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [temperature, setTemperature] = useState(0.7);
  const [reasoningEffort, setReasoningEffort] = useState('high');

  const steps = [
    { title: 'Decompose Prompt & Intent Parsing', desc: 'Identified targets: Hacker News Firebase API + Gemini keyword trigger.', tool: 'classify_intent', status: 'done' },
    { title: 'Allocate Virtual Sandbox & Dependencies', desc: 'Spawning WebContainer Node.js runtime with axios & cheerio.', tool: 'create_sandbox', status: 'done' },
    { title: 'Generate Agent Loop & Scraper Service', desc: 'Writing src/crawler.ts with exponential backoff & rate limiting.', tool: 'generate_files', status: 'in_progress' },
    { title: 'Lint & Compile Check', desc: 'Running tsc --noEmit and vitest smoke tests.', tool: 'run_command', status: 'pending' },
    { title: 'Deploy Webhook Listener & Stream Output', desc: 'Binding port 3000 and broadcasting event stream to dashboard.', tool: 'get_sandbox_url', status: 'pending' }
  ];

  const handleRunAgent = () => {
    setIsExecuting(true);
    setCurrentStep(1);
    const interval = setInterval(() => {
      setCurrentStep(s => {
        if (s >= 5) {
          clearInterval(interval);
          setIsExecuting(false);
          return 5;
        }
        return s + 1;
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Conductor Agent Orchestration Workbench
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">Gemini 3.7 Engine</span>
              </h1>
              <p className="text-xs text-slate-400">Autonomous tool calling, reasoning execution & live execution monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              <Database className="w-3.5 h-3.5 text-emerald-400" /> Memory Store: Active
            </span>
          </div>
        </div>

        {/* Prompt Input & Agent Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-pink-400" /> Goal / Instructions
              </label>
              <span className="text-xs text-slate-400 font-mono">tokens: 284</span>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono resize-none"
              placeholder="Describe the agent workflow or application you want to generate..."
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Effort: </span>
                  <select 
                    value={reasoningEffort} 
                    onChange={e => setReasoningEffort(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                  >
                    <option value="low">Low (Fast)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (Deep Think)</option>
                  </select>
                </div>
                <div>
                  <span className="text-slate-400">Temp: </span>
                  <span className="font-mono text-indigo-300 font-bold">{temperature}</span>
                </div>
              </div>

              <button
                onClick={handleRunAgent}
                disabled={isExecuting}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all"
              >
                {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {isExecuting ? 'Conductor Running...' : 'Execute Conductor Agent'}
              </button>
            </div>
          </div>

          {/* Model Config Panel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-400" /> Runtime Engine
            </h3>
            
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>Target Model</span>
                  <span className="text-indigo-400 font-mono">Gemini 3.7 Flash</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Native multimodal & autonomous tool routing</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>Self-Healing Loop</span>
                  <span className="text-emerald-400">Enabled (Max 3)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Catches runtime errors and auto-patches code</p>
              </div>
            </div>
          </div>
        </div>

        {/* Execution Timeline */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Live Conductor Execution Pipeline
          </h3>

          <div className="space-y-4">
            {steps.map((step, idx) => {
              const isDone = currentStep > idx;
              const isCurrent = currentStep === idx && isExecuting;
              return (
                <div 
                  key={idx} 
                  className={\`flex items-start gap-4 p-3.5 rounded-xl border transition-all \${
                    isCurrent 
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-sm shadow-indigo-500/10' 
                      : isDone 
                        ? 'bg-slate-950/60 border-slate-800/80' 
                        : 'bg-slate-950/20 border-slate-900 opacity-60'
                  }\`}
                >
                  <div className="mt-0.5">
                    {isDone ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : isCurrent ? (
                      <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-200">{step.title}</p>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                        {step.tool}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
`
    }
  },
  {
    id: 'mobile-app-preview',
    title: 'Mobile iOS / Android Simulator',
    description: 'Pixel-perfect mobile device simulator with iOS status bar, bottom navigation, fluid micro-interactions, and state management.',
    icon: 'Smartphone',
    category: 'Mobile & Responsive',
    badge: 'Interactive',
    initialPrompt: 'Build a mobile fitness and workout tracker app with device frame simulator, exercise logs, and water intake tracker.',
    files: {
      'package.json': JSON.stringify({
        name: 'mobile-fitness-companion',
        version: '1.0.0',
        dependencies: { react: '^18.2.0', 'lucide-react': '^0.344.0' }
      }, null, 2),
      'src/App.jsx': `import React, { useState } from 'react';
import { 
  Flame, Heart, Trophy, Droplets, Plus, Check, Calendar, 
  ChevronRight, Dumbbell, User, Home, BarChart2, Compass, Zap 
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [waterCups, setWaterCups] = useState(5);
  const [workouts, setWorkouts] = useState([
    { id: 1, name: 'Morning HIIT Blast', time: '25 min', calories: 280, done: true },
    { id: 2, name: 'Chest & Core Sculpt', time: '45 min', calories: 420, done: false },
    { id: 3, name: 'Evening Yoga Stretch', time: '15 min', calories: 95, done: false },
  ]);

  const toggleWorkout = (id) => {
    setWorkouts(workouts.map(w => w.id === id ? { ...w, done: !w.done } : w));
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      {/* Mobile Device Frame */}
      <div className="w-[375px] h-[780px] bg-slate-950 rounded-[48px] border-[8px] border-slate-800 shadow-2xl overflow-hidden flex flex-col relative">
        {/* Dynamic Island / Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-50 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 mr-2" />
          <div className="w-2 h-2 rounded-full bg-indigo-500/40" />
        </div>

        {/* Status Bar */}
        <div className="pt-3 px-6 flex justify-between items-center text-[11px] font-semibold text-slate-400">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>5G</span>
            <div className="w-5 h-2.5 border border-slate-400 rounded-sm p-0.5 flex items-center">
              <div className="h-full w-3.5 bg-emerald-400 rounded-xs" />
            </div>
          </div>
        </div>

        {/* Scrollable Mobile App Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs text-slate-400 font-medium">Welcome back,</p>
              <h1 className="text-xl font-bold text-white">Alex Morgan ⚡</h1>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 p-0.5 shadow-md">
              <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center text-xs font-bold text-white">
                AM
              </div>
            </div>
          </div>

          {/* Daily Goal Ring Summary */}
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-5 text-white shadow-xl shadow-indigo-600/25 relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-200">Daily Target</span>
              <h2 className="text-2xl font-black mt-1">795 / 900 <span className="text-sm font-normal text-indigo-200">kcal</span></h2>
              <div className="w-full bg-white/20 h-2.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-300 to-emerald-300 h-full rounded-full" style={{ width: '88%' }} />
              </div>
              <div className="flex justify-between text-[11px] text-indigo-100 mt-3 pt-3 border-t border-white/10">
                <span>🔥 6.4 km moved</span>
                <span>⏱️ 52 active mins</span>
              </div>
            </div>
          </div>

          {/* Quick Water Intake Tracker */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Hydration Tracker</h3>
                <p className="text-[11px] text-slate-400">{waterCups * 250} ml / 2,000 ml goal</p>
              </div>
            </div>
            <button 
              onClick={() => setWaterCups(c => Math.min(c + 1, 8))}
              className="w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Today's Workout Schedule */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Today's Protocol</h3>
              <span className="text-xs text-indigo-400 font-medium">3 sessions</span>
            </div>

            <div className="space-y-2.5">
              {workouts.map((w) => (
                <div 
                  key={w.id}
                  onClick={() => toggleWorkout(w.id)}
                  className={\`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between \${
                    w.done 
                      ? 'bg-slate-900/40 border-slate-800/50 opacity-70' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }\`}
                >
                  <div className="flex items-center gap-3">
                    <div className={\`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors \${
                      w.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 text-transparent'
                    }\`}>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <div>
                      <p className={\`text-xs font-bold \${w.done ? 'line-through text-slate-400' : 'text-slate-100'}\`}>{w.name}</p>
                      <p className="text-[10px] text-slate-500">{w.time} • {w.calories} kcal</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Tab Bar */}
        <div className="bg-slate-950/95 border-t border-slate-800 px-6 py-3 flex justify-between items-center text-slate-500">
          <button onClick={() => setActiveTab('today')} className={\`flex flex-col items-center gap-1 \${activeTab === 'today' ? 'text-indigo-400' : ''}\`}>
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Today</span>
          </button>
          <button onClick={() => setActiveTab('explore')} className={\`flex flex-col items-center gap-1 \${activeTab === 'explore' ? 'text-indigo-400' : ''}\`}>
            <Compass className="w-5 h-5" />
            <span className="text-[10px] font-medium">Workouts</span>
          </button>
          <button onClick={() => setActiveTab('stats')} className={\`flex flex-col items-center gap-1 \${activeTab === 'stats' ? 'text-indigo-400' : ''}\`}>
            <BarChart2 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Stats</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={\`flex flex-col items-center gap-1 \${activeTab === 'profile' ? 'text-indigo-400' : ''}\`}>
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>

        {/* Home Indicator */}
        <div className="pb-2 flex justify-center bg-slate-950">
          <div className="w-32 h-1 bg-slate-700 rounded-full" />
        </div>
      </div>
    </div>
  );
}
`
    }
  },
  {
    id: 'cyber-matrix-game',
    title: '3D Cyber Matrix Canvas Game',
    description: 'High-performance interactive HTML5 60FPS particle arcade game with score streak, synth sound waves, and particle physics.',
    icon: 'Gamepad2',
    category: 'Games & Canvas',
    badge: '60 FPS',
    initialPrompt: 'Create a neon cyber matrix retro arcade canvas game where the player dodges rogue packets and collects data crystals.',
    files: {
      'package.json': JSON.stringify({
        name: 'cyber-matrix-game',
        version: '1.0.0',
        dependencies: { react: '^18.2.0', 'lucide-react': '^0.344.0' }
      }, null, 2),
      'src/App.jsx': `import React, { useRef, useEffect, useState } from 'react';
import { Play, RotateCcw, Zap, Trophy, Shield, Volume2 } from 'lucide-react';

export default function App() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(1420);
  const [gameState, setGameState] = useState('ready'); // 'ready' | 'playing' | 'gameover'

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let player = { x: 200, y: 320, size: 16, speed: 6, vx: 0, vy: 0 };
    let enemies = [];
    let crystals = [];
    let particles = [];
    let currentScore = 0;
    let spawnCounter = 0;

    const keys = {};
    const handleKeyDown = (e) => { keys[e.code] = true; };
    const handleKeyUp = (e) => { keys[e.code] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Game loop
    const loop = () => {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Matrix rain grid background
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      if (gameState === 'playing') {
        // Player controls
        if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -player.speed;
        else if (keys['ArrowRight'] || keys['KeyD']) player.vx = player.speed;
        else player.vx *= 0.8;

        if (keys['ArrowUp'] || keys['KeyW']) player.vy = -player.speed;
        else if (keys['ArrowDown'] || keys['KeyS']) player.vy = player.speed;
        else player.vy *= 0.8;

        player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x + player.vx));
        player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y + player.vy));

        // Spawn enemies & crystals
        spawnCounter++;
        if (spawnCounter % 40 === 0) {
          enemies.push({
            x: Math.random() * canvas.width,
            y: -20,
            size: 14 + Math.random() * 10,
            vy: 3 + Math.random() * 3,
            color: '#f43f5e'
          });
        }
        if (spawnCounter % 70 === 0) {
          crystals.push({
            x: Math.random() * (canvas.width - 40) + 20,
            y: -20,
            size: 12,
            vy: 2.2,
            color: '#38bdf8'
          });
        }

        // Draw Player
        ctx.shadowColor = '#818cf8';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Update & draw crystals
        for (let i = crystals.length - 1; i >= 0; i--) {
          const c = crystals[i];
          c.y += c.vy;
          ctx.fillStyle = c.color;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
          ctx.fill();

          // Collect collision
          const dist = Math.hypot(player.x - c.x, player.y - c.y);
          if (dist < player.size + c.size) {
            crystals.splice(i, 1);
            currentScore += 50;
            setScore(currentScore);
            // Spawn sparks
            for (let p = 0; p < 8; p++) {
              particles.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 20, color: '#38bdf8' });
            }
          } else if (c.y > canvas.height + 20) {
            crystals.splice(i, 1);
          }
        }

        // Update & draw enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          e.y += e.vy;
          ctx.fillStyle = e.color;
          ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);

          // Player collision check
          const dist = Math.hypot(player.x - e.x, player.y - e.y);
          if (dist < player.size + e.size / 2) {
            setGameState('gameover');
            setHighScore(h => Math.max(h, currentScore));
          } else if (e.y > canvas.height + 20) {
            enemies.splice(i, 1);
            currentScore += 10;
            setScore(currentScore);
          }
        }

        // Particle sparks
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, 2.5, 2.5);
          if (p.life <= 0) particles.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  const startGame = () => {
    setScore(0);
    setGameState('playing');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Game Stats Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-pink-400 to-purple-400">
              CYBER MATRIX RUNNER
            </h1>
            <p className="text-[11px] text-slate-400">Use Arrow keys or WASD to dodge rogue packets</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500">Score</span>
            <p className="text-xl font-mono font-black text-indigo-300">{score}</p>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
          <canvas ref={canvasRef} width={400} height={380} className="w-full h-auto block" />

          {gameState !== 'playing' && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
              {gameState === 'gameover' ? (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-widest">Protocol Terminated</div>
                  <h2 className="text-3xl font-black text-white">GAME OVER</h2>
                  <p className="text-sm text-slate-400">Final Score: <span className="text-indigo-400 font-mono font-bold">{score}</span></p>
                  <button
                    onClick={startGame}
                    className="mt-2 flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 transition-all mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" /> Try Again
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Ready for Cyber Run?</h2>
                    <p className="text-xs text-slate-400 mt-1">Collect cyan crystals • Dodge crimson nodes</p>
                  </div>
                  <button
                    onClick={startGame}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 transition-all mx-auto"
                  >
                    <Play className="w-4 h-4 fill-current" /> Launch Matrix
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* High Score Footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 mt-4 pt-3 border-t border-slate-800">
          <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-amber-400" /> High Score: {highScore}</span>
          <span className="font-mono text-[11px] text-slate-500">60 FPS Hardware Rendered</span>
        </div>
      </div>
    </div>
  );
}
`
    }
  }
];
