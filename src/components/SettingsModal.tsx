import React from 'react';
import { 
  X, Settings, Cpu, Zap, ShieldCheck, Database, Sliders, 
  Check, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';
import { ConductorSettings, ModelId, ReasoningEffort } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ConductorSettings;
  onUpdateSettings: (newSettings: Partial<ConductorSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Conductor Settings</h2>
              <p className="text-xs text-slate-400">Configure AI reasoning models, execution engine & self-healing</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
          {/* AI Model Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" /> Default Model
            </label>
            <select
              value={settings.model}
              onChange={(e) => onUpdateSettings({ model: e.target.value as ModelId })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="gemini-3.7-flash">Gemini 3.7 Flash (Default - Recommended)</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Deep Complex Reasoning)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High Speed)</option>
              <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Hybrid)</option>
              <option value="gpt-4o">GPT-4o (Omni)</option>
              <option value="deepseek-r1">DeepSeek R1 (Thinking)</option>
            </select>
          </div>

          {/* Reasoning Effort */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" /> Reasoning Effort (Thinking Budget)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['low', 'medium', 'high'] as ReasoningEffort[]).map((effort) => (
                <button
                  key={effort}
                  onClick={() => onUpdateSettings({ reasoningEffort: effort })}
                  className={`p-3 rounded-xl border text-center font-semibold capitalize transition-all ${
                    settings.reasoningEffort === effort
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {effort}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              High effort maximizes multi-step planning, automated edge-case handling, and dependency auditing.
            </p>
          </div>

          {/* Toggle Switches */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
              <div>
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Auto-Fix Runtime Errors
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">Automatically trigger self-healing loops when an exception is caught.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoFixErrors}
                onChange={(e) => onUpdateSettings({ autoFixErrors: e.target.checked })}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
              <div>
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Conductor Step-by-Step Planner
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">Show autonomous decomposition pipeline for every user prompt.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.conductorPlannerEnabled}
                onChange={(e) => onUpdateSettings({ conductorPlannerEnabled: e.target.checked })}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
              <div>
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" /> Persistent Project Storage
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">Preserve workspace files & terminal logs across page reloads.</p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md transition-all"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
