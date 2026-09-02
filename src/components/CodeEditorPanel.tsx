import React, { useState, useEffect } from 'react';
import { 
  FileCode2, Folder, FolderOpen, Plus, Trash2, Copy, Check, 
  Download, FilePlus, Code2, Search, Sparkles, FileText, ChevronRight, ChevronDown
} from 'lucide-react';
import { VirtualFile } from '../types';

interface CodeEditorPanelProps {
  files: VirtualFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onUpdateFileContent: (path: string, content: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
}

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  files,
  activeFilePath,
  onSelectFile,
  onUpdateFileContent,
  onCreateFile,
  onDeleteFile,
}) => {
  const [copied, setCopied] = useState(false);
  const [newFileInputOpen, setNewFileInputOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [fileSearch, setFileSearch] = useState('');

  const activeFile = files.find(f => f.path === activeFilePath) || files[0];

  const handleCopyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const cleanPath = newFileName.trim().startsWith('src/') ? newFileName.trim() : `src/${newFileName.trim()}`;
    onCreateFile(cleanPath);
    setNewFileName('');
    setNewFileInputOpen(false);
  };

  const filteredFiles = files.filter(f => f.path.toLowerCase().includes(fileSearch.toLowerCase()));

  // Get syntax highlighting mode
  const getLanguage = (path: string) => {
    if (path.endsWith('.jsx') || path.endsWith('.js')) return 'jsx';
    if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'tsx';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.json')) return 'json';
    return 'javascript';
  };

  const lines = (activeFile?.content || '').split('\n');

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* File Explorer Sidebar */}
      <div className="w-56 bg-slate-950 border-r border-slate-800/80 flex flex-col shrink-0">
        {/* Explorer Header */}
        <div className="h-10 px-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Workspace Files</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setNewFileInputOpen(!newFileInputOpen)}
              title="New File"
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* New file quick form */}
        {newFileInputOpen && (
          <form onSubmit={handleCreateFileSubmit} className="p-2 border-b border-slate-800 bg-slate-900/80">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g. Header.jsx"
              autoFocus
              className="w-full bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
            />
          </form>
        )}

        {/* File Search */}
        <div className="p-2 border-b border-slate-900">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
            <input
              type="text"
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Filter files..."
              className="w-full bg-slate-900/60 border border-slate-800/80 rounded px-2 pl-6 py-1 text-[11px] text-slate-300 placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredFiles.map((file) => {
            const isActive = file.path === activeFilePath;
            return (
              <div
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span className="truncate text-[11px] font-mono">{file.path}</span>
                </div>

                {files.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(file.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 rounded transition-opacity"
                    title="Delete file"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Open File Tabs Header */}
        <div className="h-10 border-b border-slate-800/80 bg-slate-950 flex items-center justify-between px-2 gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 overflow-x-auto">
            {files.map((f) => (
              <button
                key={f.path}
                onClick={() => onSelectFile(f.path)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-mono transition-all border-b-2 ${
                  f.path === activeFilePath
                    ? 'bg-slate-900 text-indigo-300 border-indigo-500 font-bold'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/40'
                }`}
              >
                <FileCode2 className="w-3 h-3" />
                <span>{f.path.split('/').pop()}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pr-2">
            <button
              onClick={handleCopyCode}
              title="Copy file code"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Code View / Interactive Editor */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed bg-slate-950">
          <div className="flex min-w-full">
            {/* Line Numbers */}
            <div className="select-none text-right pr-4 text-slate-600 font-mono text-[11px] leading-5 w-10 shrink-0">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Editable Code Area */}
            <div className="flex-1 relative">
              <textarea
                value={activeFile?.content || ''}
                onChange={(e) => onUpdateFileContent(activeFile.path, e.target.value)}
                spellCheck={false}
                className="w-full h-full min-h-[480px] bg-transparent text-slate-100 font-mono text-xs leading-5 resize-none focus:outline-none border-none p-0 selection:bg-indigo-500/30"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
