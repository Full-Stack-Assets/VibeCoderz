import React, { useState, useEffect } from 'react';
import { 
  Header 
} from './components/Header';
import { 
  ConductorOrchestrator 
} from './components/ConductorOrchestrator';
import { 
  ChatPanel 
} from './components/ChatPanel';
import { 
  CodeEditorPanel 
} from './components/CodeEditorPanel';
import { 
  SandboxPreview 
} from './components/SandboxPreview';
import { 
  TerminalPanel 
} from './components/TerminalPanel';
import { 
  ErrorMonitor 
} from './components/ErrorMonitor';
import { 
  ProjectTemplatesModal 
} from './components/ProjectTemplatesModal';
import { 
  SettingsModal 
} from './components/SettingsModal';
import { 
  VirtualFile, ChatMessage, ToolCallStep, ConductorPlanStep, 
  TerminalLog, RuntimeError, ProjectTemplate, ConductorSettings, ModelId 
} from './types';
import { PROJECT_TEMPLATES } from './templates';
import confetti from 'canvas-confetti';
import { Terminal as TerminalIcon, MessageSquare, Play, Sparkles, Code2, Eye } from 'lucide-react';

export default function App() {
  // Load initial template
  const defaultTemplate = PROJECT_TEMPLATES[0];

  const initialFiles: VirtualFile[] = Object.entries(defaultTemplate.files).map(([path, content]) => ({
    name: path.split('/').pop() || path,
    path,
    content,
    language: path.endsWith('.css') ? 'css' : path.endsWith('.json') ? 'json' : 'javascript',
  }));

  const [projectName, setProjectName] = useState('Pulse Analytics SaaS');
  const [files, setFiles] = useState<VirtualFile[]>(() => {
    const saved = localStorage.getItem('vibecoderz_files');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return initialFiles;
  });

  const [activeFilePath, setActiveFilePath] = useState<string>('src/App.jsx');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isFixing, setIsFixing] = useState<boolean>(false);
  const [isExecutingCommand, setIsExecutingCommand] = useState<boolean>(false);

  const [currentReasoning, setCurrentReasoning] = useState<string | undefined>(undefined);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallStep[]>([]);
  const [activePlanSteps, setActivePlanSteps] = useState<ConductorPlanStep[]>([]);

  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeError[]>([]);
  const [activeView, setActiveView] = useState<'split' | 'code' | 'preview'>('split');
  const [activeDrawerTab, setActiveDrawerTab] = useState<'chat' | 'terminal'>('chat');
  const [viewport, setViewport] = useState<'desktop' | 'laptop' | 'tablet' | 'mobile'>('desktop');

  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const [settings, setSettings] = useState<ConductorSettings>({
    model: 'gemini-3.7-flash',
    reasoningEffort: 'high',
    autoFixErrors: true,
    autoRunDevServer: true,
    streamingSpeed: 'fast',
    sandboxTheme: 'dark',
    conductorPlannerEnabled: true,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `👋 **Welcome to VibeCoderz AI Agent Studio & Conductor Workbench.**\n\nI'm your autonomous full-stack engineering agent powered by **Gemini 3.7**. I can generate complete React applications, build components, run shell tools, and auto-fix runtime errors in the live virtual sandbox.\n\nWhat would you like to build or customize today?`,
      timestamp: new Date().toLocaleTimeString(),
      suggestedPrompts: [
        'Add a dark/light mode toggle with smooth theme transition',
        'Add an interactive data export button for CSV and JSON',
        'Add a predictive churn forecasting chart component',
      ],
    },
  ]);

  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([
    {
      id: 'log-init-1',
      command: 'npm run dev',
      output: `> vibecoderz-app@1.0.0 dev\n> vite --port=3000 --host=0.0.0.0\n\n  VITE v6.2.3  ready in 142 ms\n\n  ➜  Local:   http://localhost:3000/\n  ➜  Network: http://0.0.0.0:3000/\n  ➜  press h + enter to show help`,
      type: 'success',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  // Persist files to localStorage
  useEffect(() => {
    localStorage.setItem('vibecoderz_files', JSON.stringify(files));
  }, [files]);

  // Auto-Fix Trigger when runtime error detected and autoFix enabled
  const handleCatchRuntimeError = (error: RuntimeError) => {
    setRuntimeErrors(prev => {
      if (prev.some(e => e.message === error.message && !e.fixed)) return prev;
      return [...prev, error];
    });

    if (settings.autoFixErrors && !isFixing && !isGenerating) {
      setTimeout(() => {
        handleAutoFix(error);
      }, 800);
    }
  };

  const handleAutoFix = async (error: RuntimeError) => {
    setIsFixing(true);
    setCurrentReasoning(`Analyzing runtime error stack:\n"${error.message}"\nFormulating surgical patch to restore application stability.`);

    try {
      const res = await fetch('/api/fix-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error, currentFiles: files }),
      });

      const data = await res.json();

      if (data.files && Array.isArray(data.files)) {
        setFiles(prev => {
          const next = [...prev];
          data.files.forEach((fixedFile: any) => {
            const idx = next.findIndex(f => f.path === fixedFile.path);
            if (idx >= 0) {
              next[idx] = { ...next[idx], content: fixedFile.content, isModified: true };
            } else {
              next.push({
                name: fixedFile.path.split('/').pop() || fixedFile.path,
                path: fixedFile.path,
                content: fixedFile.content,
                language: 'javascript',
              });
            }
          });
          return next;
        });
      }

      // Mark error as resolved
      setRuntimeErrors(prev => prev.map(e => e.id === error.id ? { ...e, fixed: true } : e));

      setTerminalLogs(prev => [
        ...prev,
        {
          id: 'log-fix-' + Date.now(),
          command: 'conductor --auto-heal',
          output: `[SELF-HEAL] Successfully resolved exception: ${error.message}\n${data.diagnosis || 'Patched source code.'}`,
          type: 'success',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      console.error('Self-healing failed:', err);
    } finally {
      setIsFixing(false);
      setCurrentReasoning(undefined);
    }
  };

  // Agent Chat & Generation Handler
  const handleSendMessage = async (promptText: string) => {
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);
    setCurrentReasoning(`Decomposing prompt into architecture plan:\n- Analyzing user requirement: "${promptText}"\n- Structuring component hierarchy and responsive layout\n- Synthesizing JSX, Tailwind styling, and state logic`);

    setActiveToolCalls([
      {
        id: 'tc-1',
        toolName: 'plan_architecture',
        summary: 'Deconstructed goal into execution plan',
        status: 'completed',
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: 'tc-2',
        toolName: 'generate_files',
        summary: `Updating ${activeFilePath}`,
        status: 'running',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          history: messages,
          currentFiles: files,
          reasoningEffort: settings.reasoningEffort,
        }),
      });

      const data = await res.json();

      if (data.files && Array.isArray(data.files)) {
        setFiles(prev => {
          const next = [...prev];
          data.files.forEach((newFile: any) => {
            const idx = next.findIndex(f => f.path === newFile.path);
            if (idx >= 0) {
              next[idx] = { ...next[idx], content: newFile.content, isModified: true };
            } else {
              next.push({
                name: newFile.path.split('/').pop() || newFile.path,
                path: newFile.path,
                content: newFile.content,
                language: 'javascript',
              });
            }
          });
          return next;
        });
      }

      const assistantMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: data.response || 'Changes applied successfully to the workspace.',
        reasoning: data.reasoning,
        timestamp: new Date().toLocaleTimeString(),
        toolCalls: data.toolCalls || [
          {
            id: 'tc-done',
            toolName: 'generate_files',
            summary: `Updated files and refreshed sandbox preview`,
            status: 'completed',
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
        suggestedPrompts: data.suggestedPrompts || [
          'Add a search filter and sorting options',
          'Add a modal dialog for adding new items',
          'Optimize layout for mobile devices',
        ],
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Trigger celebratory sparks
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.9 },
        colors: ['#6366f1', '#a855f7', '#ec4899', '#38bdf8'],
      });
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        role: 'assistant',
        content: `⚠️ Encountered an issue during generation: ${err.message || 'Please try again.'}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsGenerating(false);
      setCurrentReasoning(undefined);
      setActiveToolCalls([]);
    }
  };

  // Command Runner simulation
  const handleRunCommand = (cmd: string) => {
    setIsExecutingCommand(true);
    const newLogId = 'log-' + Date.now();

    let simulatedOutput = '';
    let logType: TerminalLog['type'] = 'stdout';

    if (cmd.includes('dev')) {
      simulatedOutput = `> vibecoderz-app@1.0.0 dev\n> vite --port=3000 --host=0.0.0.0\n\n  VITE v6.2.3  ready in 118 ms\n  ➜  Local: http://localhost:3000/\n  ➜  Network: http://0.0.0.0:3000/`;
      logType = 'success';
    } else if (cmd.includes('build')) {
      simulatedOutput = `vite v6.2.3 building for production...\n✓ 42 modules transformed.\ndist/index.html                   0.82 kB │ gzip:  0.44 kB\ndist/assets/index-D7h2k9.css      4.12 kB │ gzip:  1.21 kB\ndist/assets/index-C3x9pL.js     148.90 kB │ gzip: 47.12 kB\n✓ built in 420ms`;
      logType = 'success';
    } else if (cmd.includes('test') || cmd.includes('vitest')) {
      simulatedOutput = `✓ test/App.test.jsx (3 tests)\n✓ test/components/Metrics.test.jsx (4 tests)\n\nTest Files  2 passed (2)\n     Tests  7 passed (7)\n  Start at  ${new Date().toLocaleTimeString()}\n  Duration  310ms`;
      logType = 'success';
    } else if (cmd.includes('status')) {
      simulatedOutput = `On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges not staged for commit:\n  modified:   ${activeFilePath}\n\nno changes added to commit (use "git add" to track)`;
      logType = 'info';
    } else {
      simulatedOutput = `[vibecoderz-shell] Executed: "${cmd}" (exit code: 0)`;
      logType = 'stdout';
    }

    setTimeout(() => {
      setTerminalLogs(prev => [
        ...prev,
        {
          id: newLogId,
          command: cmd,
          output: simulatedOutput,
          type: logType,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setIsExecutingCommand(false);
    }, 600);
  };

  // Export Project ZIP
  const handleExportZip = () => {
    const data = {
      name: projectName,
      timestamp: new Date().toISOString(),
      files: files.reduce((acc, f) => ({ ...acc, [f.path]: f.content }), {}),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-project.json`;
    a.click();
  };

  // Load selected template
  const handleSelectTemplate = (template: ProjectTemplate) => {
    const newFiles: VirtualFile[] = Object.entries(template.files).map(([path, content]) => ({
      name: path.split('/').pop() || path,
      path,
      content,
      language: path.endsWith('.css') ? 'css' : path.endsWith('.json') ? 'json' : 'javascript',
    }));
    setFiles(newFiles);
    setProjectName(template.title);
    setActiveFilePath('src/App.jsx');
    setRuntimeErrors([]);
    setMessages([
      {
        id: 'msg-tmpl-' + Date.now(),
        role: 'assistant',
        content: `Loaded **${template.title}** template! ${template.description}`,
        timestamp: new Date().toLocaleTimeString(),
        suggestedPrompts: [
          'Add a new interactive chart',
          'Add user preferences menu',
          'Add dark mode color customizations',
        ],
      },
    ]);
  };

  const handleUpdateFileContent = (path: string, content: string) => {
    setFiles(prev => prev.map(f => f.path === path ? { ...f, content, isModified: true } : f));
  };

  const handleCreateFile = (path: string) => {
    if (files.some(f => f.path === path)) return;
    const newF: VirtualFile = {
      name: path.split('/').pop() || path,
      path,
      content: `import React from 'react';\n\nexport function Component() {\n  return (\n    <div className="p-4 bg-slate-900 rounded-xl text-white">\n      <h2>New Component</h2>\n    </div>\n  );\n}\n`,
      language: 'javascript',
    };
    setFiles(prev => [...prev, newF]);
    setActiveFilePath(path);
  };

  const handleDeleteFile = (path: string) => {
    if (files.length <= 1) return;
    setFiles(prev => prev.filter(f => f.path !== path));
    if (activeFilePath === path) {
      const remaining = files.filter(f => f.path !== path);
      setActiveFilePath(remaining[0]?.path || 'src/App.jsx');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header */}
      <Header
        projectName={projectName}
        setProjectName={setProjectName}
        selectedModel={settings.model}
        onSelectModel={(model) => setSettings(s => ({ ...s, model }))}
        onOpenTemplates={() => setTemplatesModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onExportZip={handleExportZip}
        onResetProject={() => handleSelectTemplate(defaultTemplate)}
        isGenerating={isGenerating}
        hasErrors={runtimeErrors.some(e => !e.fixed)}
        activeView={activeView}
        setActiveView={setActiveView}
        viewport={viewport}
        setViewport={setViewport}
      />

      {/* Real-Time Error Healing Monitor Banner */}
      <ErrorMonitor
        errors={runtimeErrors}
        onAutoFixError={handleAutoFix}
        onDismissError={(id) => setRuntimeErrors(prev => prev.filter(e => e.id !== id))}
        isFixing={isFixing}
      />

      {/* Active Conductor Agent Pipeline */}
      <ConductorOrchestrator
        isGenerating={isGenerating}
        activePlanSteps={activePlanSteps}
        activeToolCalls={activeToolCalls}
        currentReasoning={currentReasoning}
        autoFixEnabled={settings.autoFixErrors}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Side: Agent Chat & Terminal Drawer Tabs (380px on desktop) */}
        <div className="w-full sm:w-80 md:w-96 border-r border-slate-800/80 flex flex-col shrink-0 bg-slate-950">
          {/* Tabs Switcher for Chat vs Terminal */}
          <div className="h-9 px-2 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveDrawerTab('chat')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeDrawerTab === 'chat'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Agent Chat</span>
              </button>

              <button
                onClick={() => setActiveDrawerTab('terminal')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeDrawerTab === 'terminal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>Terminal</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0">
            {activeDrawerTab === 'chat' ? (
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                isGenerating={isGenerating}
                onSelectSuggestedPrompt={handleSendMessage}
              />
            ) : (
              <TerminalPanel
                logs={terminalLogs}
                onRunCommand={handleRunCommand}
                onClearLogs={() => setTerminalLogs([])}
                isExecutingCommand={isExecutingCommand}
              />
            )}
          </div>
        </div>

        {/* Right Side: Code Editor and/or Sandbox Preview */}
        <div className="flex-1 flex min-w-0 bg-slate-950">
          {/* Split Mode: Both Editor & Preview */}
          {activeView === 'split' && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
              <div className="h-full border-r border-slate-800/80 min-h-0 overflow-hidden">
                <CodeEditorPanel
                  files={files}
                  activeFilePath={activeFilePath}
                  onSelectFile={setActiveFilePath}
                  onUpdateFileContent={handleUpdateFileContent}
                  onCreateFile={handleCreateFile}
                  onDeleteFile={handleDeleteFile}
                />
              </div>

              <div className="h-full min-h-0 overflow-hidden">
                <SandboxPreview
                  files={files}
                  viewport={viewport}
                  setViewport={setViewport}
                  onCatchRuntimeError={handleCatchRuntimeError}
                  runtimeErrors={runtimeErrors}
                />
              </div>
            </div>
          )}

          {/* Code Only Mode */}
          {activeView === 'code' && (
            <div className="flex-1 h-full min-h-0 overflow-hidden">
              <CodeEditorPanel
                files={files}
                activeFilePath={activeFilePath}
                onSelectFile={setActiveFilePath}
                onUpdateFileContent={handleUpdateFileContent}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
              />
            </div>
          )}

          {/* Sandbox Only Mode */}
          {activeView === 'preview' && (
            <div className="flex-1 h-full min-h-0 overflow-hidden">
              <SandboxPreview
                files={files}
                viewport={viewport}
                setViewport={setViewport}
                onCatchRuntimeError={handleCatchRuntimeError}
                runtimeErrors={runtimeErrors}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ProjectTemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={(newSet) => setSettings(s => ({ ...s, ...newSet }))}
      />
    </div>
  );
}
