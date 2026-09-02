import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal as TerminalIcon, Play, Trash2, CheckCircle2, AlertCircle, 
  RotateCcw, Sparkles, CornerDownLeft, ShieldCheck, Zap
} from 'lucide-react';
import { TerminalLog } from '../types';

interface TerminalPanelProps {
  logs: TerminalLog[];
  onRunCommand: (command: string) => void;
  onClearLogs: () => void;
  isExecutingCommand: boolean;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  logs,
  onRunCommand,
  onClearLogs,
  isExecutingCommand,
}) => {
  const [inputCmd, setInputCmd] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCmd.trim() || isExecutingCommand) return;
    onRunCommand(inputCmd.trim());
    setInputCmd('');
  };

  const quickCommands = [
    'npm run dev',
    'npm run build',
    'npm test -- --run',
    'git status',
    'npx prisma studio',
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-xs select-none">
      {/* Terminal Title Bar */}
      <div className="h-10 px-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200">Terminal & Command Runner</span>
          {isExecutingCommand && (
            <span className="text-[10px] text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              executing...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClearLogs}
            title="Clear Terminal Output"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Command Chips */}
      <div className="px-4 py-2 border-b border-slate-900 bg-slate-950 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider shrink-0">Quick:</span>
        {quickCommands.map((cmd) => (
          <button
            key={cmd}
            onClick={() => onRunCommand(cmd)}
            disabled={isExecutingCommand}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-indigo-300 transition-colors text-[11px] whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            $ {cmd}
          </button>
        ))}
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-950 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">
            VibeCoderz Virtual Shell ready. Type a command or select a quick action above.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="space-y-1">
              {log.command && (
                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                  <span className="text-emerald-400">user@vibecoderz:~$</span>
                  <span>{log.command}</span>
                </div>
              )}
              <pre className={`whitespace-pre-wrap leading-relaxed ${
                log.type === 'error' 
                  ? 'text-rose-400' 
                  : log.type === 'success' 
                    ? 'text-emerald-400' 
                    : log.type === 'info' 
                      ? 'text-cyan-300' 
                      : 'text-slate-300'
              }`}>
                {log.output}
              </pre>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Interactive Command Input Line */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center gap-2">
        <span className="text-emerald-400 font-bold shrink-0">$</span>
        <input
          type="text"
          value={inputCmd}
          onChange={(e) => setInputCmd(e.target.value)}
          placeholder="e.g. npm test, git log, vitest, curl..."
          disabled={isExecutingCommand}
          className="flex-1 bg-transparent text-slate-100 font-mono text-xs focus:outline-none placeholder-slate-600"
        />
        <button
          type="submit"
          disabled={!inputCmd.trim() || isExecutingCommand}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors disabled:opacity-40"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
