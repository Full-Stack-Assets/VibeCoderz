import React, { useState } from 'react';
import { 
  Sparkles, Code2, Play, Download, Settings, Layers, RefreshCw, 
  ChevronDown, Bot, ShieldCheck, Terminal, Smartphone, Monitor, Laptop, Tablet,
  Github, Plus, FolderDown
} from 'lucide-react';
import { ModelId, ConductorSettings } from '../types';

interface HeaderProps {
  projectName: string;
  setProjectName: (name: string) => void;
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  onOpenTemplates: () => void;
  onOpenSettings: () => void;
  onExportZip: () => void;
  onResetProject: () => void;
  isGenerating: boolean;
  hasErrors: boolean;
  activeView: 'split' | 'code' | 'preview';
  setActiveView: (view: 'split' | 'code' | 'preview') => void;
  viewport: 'desktop' | 'laptop' | 'tablet' | 'mobile';
  setViewport: (vp: 'desktop' | 'laptop' | 'tablet' | 'mobile') => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  setProjectName,
  selectedModel,
  onSelectModel,
  onOpenTemplates,
  onOpenSettings,
  onExportZip,
  onResetProject,
  isGenerating,
  hasErrors,
  activeView,
  setActiveView,
  viewport,
  setViewport,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const modelLabels: Record<ModelId, { label: string; badge: string }> = {
    'gemini-3.7-flash': { label: 'Gemini 3.7 Flash', badge: 'Default' },
    'gemini-3.1-pro-preview': { label: 'Gemini 3.1 Pro', badge: 'Reasoning' },
    'gemini-3.1-flash-lite': { label: 'Gemini 3.1 Flash Lite', badge: 'Fast' },
    'claude-3-7-sonnet': { label: 'Claude 3.7 Sonnet', badge: 'Hybrid' },
    'gpt-4o': { label: 'GPT-4o', badge: 'Omni' },
    'deepseek-r1': { label: 'DeepSeek R1', badge: 'Thinking' },
  };

  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800/80 px-4 flex items-center justify-between gap-4 z-40 select-none">
      {/* Brand & Project Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white hidden sm:inline-flex items-center gap-1.5">
            VibeCoderz
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Conductor
            </span>
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" />

        {/* Project Name Editable */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isEditingName ? (
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              autoFocus
              className="bg-slate-900 border border-indigo-500 text-xs text-white px-2 py-1 rounded font-medium focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-xs font-semibold text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-slate-900 transition-colors truncate max-w-[140px] sm:max-w-[200px]"
              title="Click to rename project"
            >
              {projectName}
            </button>
          )}
        </div>

        {/* Templates Button */}
        <button
          onClick={onOpenTemplates}
          className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-850 transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Templates</span>
        </button>
      </div>

      {/* Middle: Viewport / View Mode Switcher */}
      <div className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800/80">
        <button
          onClick={() => setActiveView('split')}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === 'split' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Split View
        </button>
        <button
          onClick={() => setActiveView('code')}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === 'code' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Code Only
        </button>
        <button
          onClick={() => setActiveView('preview')}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === 'preview' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Sandbox Only
        </button>
      </div>

      {/* Right Controls: Model Selector, Export, Settings */}
      <div className="flex items-center gap-2">
        {/* Model Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{modelLabels[selectedModel]?.label || selectedModel}</span>
            <span className="sm:hidden text-[11px]">{selectedModel.split('-')[0]}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {modelDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1">
                Conductor AI Models
              </div>
              {Object.entries(modelLabels).map(([id, info]) => (
                <button
                  key={id}
                  onClick={() => {
                    onSelectModel(id as ModelId);
                    setModelDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    selectedModel === id
                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{info.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {info.badge}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Project ZIP */}
        <button
          onClick={onExportZip}
          title="Download Project ZIP"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
        >
          <FolderDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline">Export</span>
        </button>

        {/* Settings Modal Toggle */}
        <button
          onClick={onOpenSettings}
          title="Conductor Settings"
          className="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
