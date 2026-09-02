import { VirtualFile } from '../types';

export function buildSandboxHtml(files: VirtualFile[]): string {
  // Find entry points
  const indexHtml = files.find(f => f.path === 'index.html' || f.name === 'index.html')?.content;
  const appFile = files.find(f => 
    f.path.includes('App.jsx') || 
    f.path.includes('App.tsx') || 
    f.path.includes('App.js') || 
    f.path.includes('index.jsx') || 
    f.path.includes('index.tsx')
  );
  
  const cssFile = files.find(f => f.path.endsWith('.css') || f.name.endsWith('.css'))?.content || '';

  // Transform all JS/JSX files into a bundle dictionary for in-browser resolution
  const modulesDict: Record<string, string> = {};
  files.forEach(file => {
    if (file.path.endsWith('.js') || file.path.endsWith('.jsx') || file.path.endsWith('.ts') || file.path.endsWith('.tsx') || file.path.endsWith('.json')) {
      modulesDict[file.path] = file.content;
      modulesDict['/' + file.path] = file.content;
      modulesDict['./' + file.path] = file.content;
    }
  });

  const appCode = appFile?.content || `
    export default function App() {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
          <h1>✨ Application Ready</h1>
          <p>Your code is running live in the VibeCoderz Sandbox.</p>
        </div>
      );
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sandbox Preview</title>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#eef2ff',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
            }
          }
        }
      }
    }
  </script>

  <!-- React 18 & Babel Standalone for runtime JSX compilation -->
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <!-- Lucide Icons UMD -->
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>

  <style>
    ${cssFile}
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
  </style>

  <!-- Console and Error Capture Bridge -->
  <script>
    (function() {
      function sendToHost(type, data) {
        try {
          window.parent.postMessage({ type: 'SANDBOX_' + type, data: data }, '*');
        } catch (e) {}
      }

      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.log = function(...args) {
        originalLog.apply(console, args);
        sendToHost('LOG', { level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
      };

      console.warn = function(...args) {
        originalWarn.apply(console, args);
        sendToHost('LOG', { level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
      };

      console.error = function(...args) {
        originalError.apply(console, args);
        sendToHost('ERROR', { 
          message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
          timestamp: new Date().toISOString()
        });
      };

      window.onerror = function(message, source, lineno, colno, error) {
        sendToHost('ERROR', {
          message: message,
          source: source,
          lineno: lineno,
          colno: colno,
          stack: error?.stack,
          timestamp: new Date().toISOString()
        });
        return false;
      };

      window.addEventListener('unhandledrejection', function(event) {
        sendToHost('ERROR', {
          message: 'Unhandled Promise Rejection: ' + (event.reason?.message || event.reason),
          stack: event.reason?.stack,
          timestamp: new Date().toISOString()
        });
      });
    })();
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <div id="root"></div>

  <script type="text/babel">
    // Mock Lucide React icons dynamically
    const LucideMockProxy = new Proxy({}, {
      get: (target, prop) => {
        return function DynamicIcon(props) {
          const { className = "w-5 h-5", size = 20, ...rest } = props;
          // Simple graceful SVG placeholder
          return (
            <svg 
              width={size} 
              height={size} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className={className} 
              {...rest}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          );
        };
      }
    });

    // Simple Lucide icons mapping with common icons
    const LucideReact = {
      Activity: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
      TrendingUp: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
      Users: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      DollarSign: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
      ArrowUpRight: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>,
      ArrowDownRight: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/></svg>,
      Zap: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
      Shield: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
      Sparkles: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>,
      Bell: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
      Search: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
      RefreshCw: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
      BarChart3: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
      Bot: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="12" x="3" y="6" rx="2"/><path d="M9 11h.01M15 11h.01M12 2v4M2 12h1M21 12h1"/></svg>,
      Play: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="5 3 19 12 5 21 5 3"/></svg>,
      RotateCcw: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
      Flame: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
      Trophy: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1 .45-1 1v1h12v-1c0-.55-.45-1-1-1h-2c-.55 0-1-.45-1-1v-2.34"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
      Droplets: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>,
      Plus: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
      Check: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="20 6 9 17 4 12"/></svg>,
      ChevronRight: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="9 18 15 12 9 6"/></svg>,
      Home: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
      Compass: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
      BarChart2: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
      User: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      CheckCircle2: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>,
      Layers: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
      Sliders: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
      Cpu: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/></svg>,
      Database: (props) => <svg viewBox="0 0 24 24" width={props.size || 20} height={props.size || 20} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
    };

    // Inject in window environment
    window.LucideReact = LucideReact;
    window.LucideMockProxy = LucideMockProxy;

    try {
      // Execute the transformed App code
      ${cleanCodeForEval(appCode)}

      const rootElement = document.getElementById('root');
      if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(App));
      }
    } catch (err) {
      console.error('Render Error: ' + err.message);
      document.getElementById('root').innerHTML = '<div style="padding: 24px; color: #f43f5e; font-family: monospace; background: #1e112a; border: 1px solid #e11d48; border-radius: 12px; margin: 20px;"><h3>⚠️ Sandbox Execution Error</h3><p>' + err.message + '</p><pre style="font-size: 11px; opacity: 0.8; margin-top: 10px;">' + (err.stack || '') + '</pre></div>';
    }
  </script>
</body>
</html>`;
}

function cleanCodeForEval(code: string): string {
  // Strip import statements for browser sandbox execution
  let cleaned = code
    .replace(/import\s+React(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]react['"];?/g, 'const { useState, useEffect, useRef, useMemo, useCallback } = React;')
    .replace(/import\s+\{[^}]*\}\s+from\s+['"]lucide-react['"];?/g, 'const { Activity, TrendingUp, Users, DollarSign, ArrowUpRight, ArrowDownRight, Zap, Shield, Sparkles, Bell, Search, RefreshCw, BarChart3, Bot, Play, RotateCcw, Flame, Trophy, Droplets, Plus, Check, ChevronRight, Home, Compass, BarChart2, User, CheckCircle2, Layers, Sliders, Cpu, Database } = window.LucideReact || window.LucideMockProxy;')
    .replace(/import\s+.*?\s+from\s+['"][^'"]+['"];?/g, '// import bypassed in browser sandbox')
    .replace(/export\s+default\s+function\s+(\w+)/g, 'function $1')
    .replace(/export\s+default\s+/g, 'const App = ')
    .replace(/export\s+\{[^}]*\};?/g, '');

  if (!cleaned.includes('function App') && !cleaned.includes('const App =') && !cleaned.includes('let App =')) {
    cleaned = `function App() { return (${cleaned}); }`;
  }

  return cleaned;
}
