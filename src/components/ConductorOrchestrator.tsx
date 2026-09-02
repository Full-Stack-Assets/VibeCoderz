import React, { useState } from 'react';
import { 
  Bot, Sparkles, Terminal, FileCode2, CheckCircle2, AlertCircle, 
  RefreshCw, ChevronDown, ChevronUp, Cpu, Zap, Activity
} from 'lucide-react';
import { ToolCallStep, ConductorPlanStep } from '../types';

interface ConductorOrchestratorProps {
  isGenerating: boolean;
  activePlanSteps: ConductorPlanStep[];
  activeToolCalls: ToolCallStep[];
  currentReasoning?: string;
  autoFixEnabled: boolean;
}

export const ConductorOrchestrator: React.FC<ConductorOrchestratorProps> = ({
  isGenerating,
  activePlanSteps,
  activeToolCalls,
  currentReasoning,
  autoFixEnabled,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isGenerating && activeToolCalls.length === 0 && !currentReasoning) {
    return null;
  }

  return (
    <div className="bg-slate-900/95 border-b border-indigo-500/20 px-4 py-2.5 transition-all select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Bot className="w-3.5 h-3.5" />
            </div>
            {isGenerating && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                Conductor Agent Pipeline
                {isGenerating && <span className="text-[10px] text-indigo-300 font-mono animate-pulse">Running Orchestration...</span>}
              </span>
              {autoFixEnabled && (
                <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Auto-Healing Active
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800"
        >
          <span>{isExpanded ? 'Hide Trace' : 'Show Trace'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2.5">
          {/* Active Reasoning Box */}
          {currentReasoning && (
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                <Cpu className="w-3.5 h-3.5" /> Conductor Chain-of-Thought
              </div>
              <p className="text-slate-300 font-sans leading-relaxed whitespace-pre-line text-[11px]">
                {currentReasoning}
              </p>
            </div>
          )}

          {/* Active Tool Invocations */}
          {activeToolCalls.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {activeToolCalls.map((tool) => (
                <div 
                  key={tool.id} 
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-xs"
                >
                  <div className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                    {tool.toolName === 'generate_files' && <FileCode2 className="w-3 h-3" />}
                    {tool.toolName === 'run_command' && <Terminal className="w-3 h-3" />}
                    {tool.toolName === 'create_sandbox' && <Activity className="w-3 h-3" />}
                    {tool.toolName === 'get_sandbox_url' && <Zap className="w-3 h-3" />}
                    {tool.toolName === 'fix_errors' && <RefreshCw className="w-3 h-3 text-amber-400" />}
                    {tool.toolName === 'plan_architecture' && <Bot className="w-3 h-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-200 truncate">{tool.summary}</p>
                    <span className="text-[9px] font-mono text-slate-500 uppercase">{tool.toolName}</span>
                  </div>
                  {tool.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {tool.status === 'running' && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
