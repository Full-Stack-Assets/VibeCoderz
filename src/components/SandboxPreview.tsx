import React, { useState, useEffect, useRef } from 'react';
import { 
  RotateCcw, ExternalLink, Smartphone, Tablet, Laptop, Monitor, 
  Terminal, ShieldCheck, AlertTriangle, Bug, Maximize2, Sparkles,
  ChevronUp, ChevronDown, Trash2
} from 'lucide-react';
import { VirtualFile, RuntimeError } from '../types';
import { buildSandboxHtml } from '../utils/sandboxEngine';

interface SandboxPreviewProps {
  files: VirtualFile[];
  viewport: 'desktop' | 'laptop' | 'tablet' | 'mobile';
  setViewport: (vp: 'desktop' | 'laptop' | 'tablet' | 'mobile') => void;
  onCatchRuntimeError: (error: RuntimeError) => void;
  runtimeErrors: RuntimeError[];
}

export const SandboxPreview: React.FC<SandboxPreviewProps> = ({
  files,
  viewport,
  setViewport,
  onCatchRuntimeError,
  runtimeErrors,
}) => {
  const [key, setKey] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<{ level: string; message: string; timestamp: string }[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'all' | 'errors'>('all');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Re-render sandbox HTML when files change or reload requested
  const sandboxHtml = buildSandboxHtml(files);

  const handleRefresh = () => {
    setKey(k => k + 1);
  };

  const handleOpenPopout = () => {
    const blob = new Blob([sandboxHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Listen for iframe postMessages (logs, runtime errors)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'SANDBOX_LOG') {
        const log = event.data.data;
        setConsoleLogs(prev => [...prev.slice(-100), { ...log, timestamp: new Date().toLocaleTimeString() }]);
      } else if (event.data.type === 'SANDBOX_ERROR') {
        const err = event.data.data;
        const runtimeErr: RuntimeError = {
          id: 'err-' + Date.now(),
          message: err.message || 'Unknown runtime error',
          source: err.source,
          lineno: err.lineno,
          colno: err.colno,
          stack: err.stack,
          timestamp: new Date().toLocaleTimeString(),
        };
        onCatchRuntimeError(runtimeErr);
        setConsoleLogs(prev => [...prev.slice(-100), { level: 'error', message: err.message, timestamp: new Date().toLocaleTimeString() }]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCatchRuntimeError]);

  const viewportWidths = {
    desktop: '100%',
    laptop: '1024px',
    tablet: '768px',
    mobile: '375px',
  };

  const errorCount = runtimeErrors.filter(e => !e.fixed).length;

  return (
    <div className="flex flex-col h-full bg-slate-950 select-none overflow-hidden">
      {/* Browser Bar & Viewport Controls */}
      <div className="h-10 px-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-3 shrink-0">
        {/* Navigation / Address Bar */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <button
            onClick={handleRefresh}
            title="Reload Sandbox"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 flex items-center gap-1.5 bg-slate-950 border border-slate-800/80 px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-400 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-slate-500">https://</span>
            <span className="text-slate-200 truncate">vibecoderz-app.local</span>
          </div>
        </div>

        {/* Viewport Sizer Buttons */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg">
          <button
            onClick={() => setViewport('desktop')}
            title="Desktop (100%)"
            className={`p-1 rounded transition-colors ${
              viewport === 'desktop' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport('laptop')}
            title="Laptop (1024px)"
            className={`p-1 rounded transition-colors ${
              viewport === 'laptop' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport('tablet')}
            title="Tablet (768px)"
            className={`p-1 rounded transition-colors ${
              viewport === 'tablet' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport('mobile')}
            title="Mobile (375px)"
            className={`p-1 rounded transition-colors ${
              viewport === 'mobile' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Popout Button */}
        <button
          onClick={handleOpenPopout}
          title="Open in new window"
          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sandbox Body Area */}
      <div className="flex-1 bg-slate-900/40 p-3 flex items-center justify-center overflow-auto relative">
        <div
          style={{ width: viewportWidths[viewport] }}
          className={`h-full transition-all duration-300 flex flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative ${
            viewport === 'mobile' ? 'max-w-[375px] max-h-[740px] rounded-[36px] border-[6px] border-slate-800' : ''
          }`}
        >
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={sandboxHtml}
            title="VibeCoderz Virtual Sandbox"
            sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
            className="w-full h-full border-none bg-slate-950 block"
          />
        </div>
      </div>

      {/* Bottom Console Drawer */}
      <div className={`border-t border-slate-800 bg-slate-950 transition-all ${consoleOpen ? 'h-48' : 'h-8'} flex flex-col`}>
        {/* Drawer Bar */}
        <div 
          onClick={() => setConsoleOpen(!consoleOpen)}
          className="h-8 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              Console
            </span>

            {errorCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {errorCount} Error{errorCount > 1 ? 's' : ''}
              </span>
            )}

            <span className="text-[11px] text-slate-500 font-mono">
              {consoleLogs.length} logs
            </span>
          </div>

          <div className="flex items-center gap-2">
            {consoleOpen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConsoleLogs([]);
                }}
                className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800"
                title="Clear logs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            {consoleOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
          </div>
        </div>

        {/* Drawer Logs Content */}
        {consoleOpen && (
          <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1 bg-slate-950/90">
            {consoleLogs.length === 0 ? (
              <p className="text-slate-600 italic">No console logs captured yet.</p>
            ) : (
              consoleLogs.map((log, i) => (
                <div 
                  key={i} 
                  className={`flex items-start gap-2 py-0.5 ${
                    log.level === 'error' ? 'text-rose-400' : log.level === 'warn' ? 'text-amber-300' : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-600 select-none">{log.timestamp}</span>
                  <span className="font-semibold select-none">[{log.level.toUpperCase()}]</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
