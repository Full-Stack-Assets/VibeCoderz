import React from 'react';
import { AlertTriangle, Sparkles, CheckCircle2, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { RuntimeError } from '../types';

interface ErrorMonitorProps {
  errors: RuntimeError[];
  onAutoFixError: (error: RuntimeError) => void;
  onDismissError: (errorId: string) => void;
  isFixing: boolean;
}

export const ErrorMonitor: React.FC<ErrorMonitorProps> = ({
  errors,
  onAutoFixError,
  onDismissError,
  isFixing,
}) => {
  const unfixedErrors = errors.filter(e => !e.fixed);

  if (unfixedErrors.length === 0) return null;

  const currentError = unfixedErrors[unfixedErrors.length - 1];

  return (
    <div className="bg-gradient-to-r from-rose-950/90 via-slate-900/90 to-purple-950/90 border-b border-rose-500/40 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg select-none z-30">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-rose-300 uppercase tracking-wide">
              Runtime Issue Detected
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {currentError.timestamp}
            </span>
          </div>
          <p className="text-xs text-slate-200 font-mono truncate max-w-xl mt-0.5">
            {currentError.message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
        <button
          onClick={() => onAutoFixError(currentError)}
          disabled={isFixing}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
        >
          {isFixing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          )}
          <span>{isFixing ? 'Conductor Healing...' : 'Auto-Fix with Conductor'}</span>
        </button>

        <button
          onClick={() => onDismissError(currentError.id)}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
          title="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
