import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Bot, User, Sparkles, Terminal, FileCode2, ChevronDown, 
  ChevronRight, RefreshCw, CheckCircle2, CornerDownLeft, Zap, ArrowRight,
  Layers, Lightbulb, Play
} from 'lucide-react';
import { ChatMessage, ToolCallStep } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isGenerating: boolean;
  onSelectSuggestedPrompt: (prompt: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isGenerating,
  onSelectSuggestedPrompt,
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const defaultPromptStarters = [
    'Add a dark/light mode toggle with smooth theme transition',
    'Add an interactive data export button for CSV and JSON',
    'Enhance mobile responsiveness with drawer menu and touch gestures',
    'Add an AI summary generator card with streaming text effect',
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80 select-none">
      {/* Panel Header */}
      <div className="h-10 px-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-200">Conductor Agent Chat</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">streaming enabled</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* User message */}
            {msg.role === 'user' ? (
              <div className="flex items-start gap-2.5 justify-end">
                <div className="max-w-[85%] bg-indigo-600 text-white rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs shadow-md shadow-indigo-600/10 leading-relaxed font-medium">
                  {msg.content}
                </div>
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : (
              /* Assistant message */
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-3.5 h-3.5" />
                </div>

                <div className="max-w-[90%] space-y-2.5">
                  {/* Assistant response text */}
                  <div className="bg-slate-900 border border-slate-800/90 rounded-2xl rounded-tl-xs p-4 text-xs text-slate-200 leading-relaxed space-y-2">
                    <p className="whitespace-pre-line">{msg.content}</p>

                    {/* Expandable Reasoning Trace */}
                    {msg.reasoning && (
                      <div className="mt-2 pt-2 border-t border-slate-800/60">
                        <button
                          onClick={() => toggleReasoning(msg.id)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          {expandedReasoning[msg.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          <span>Agent Reasoning Steps</span>
                        </button>

                        {expandedReasoning[msg.id] && (
                          <div className="mt-2 p-2.5 bg-slate-950/90 rounded-xl border border-slate-800 text-[11px] text-slate-400 font-mono leading-normal whitespace-pre-line">
                            {msg.reasoning}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tool Call Cards */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="space-y-1.5 pl-1">
                      {msg.toolCalls.map((tc) => (
                        <div
                          key={tc.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
                        >
                          <div className="w-5 h-5 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                            {tc.toolName === 'generate_files' ? <FileCode2 className="w-3 h-3" /> : <Terminal className="w-3 h-3" />}
                          </div>
                          <span className="text-[11px] text-slate-300 font-medium truncate flex-1">{tc.summary}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggested follow-up prompts */}
                  {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {msg.suggestedPrompts.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => onSelectSuggestedPrompt(s)}
                          className="text-[11px] bg-slate-900 hover:bg-slate-850 text-indigo-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 text-left"
                        >
                          <Sparkles className="w-3 h-3 text-pink-400 shrink-0" />
                          <span>{s}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Streaming Indicator */}
        {isGenerating && (
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-slate-300 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span>Conductor Agent is synthesizing code & architecture...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Starter Chips if message count is low */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-900">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-400" /> Suggested Prompts
          </div>
          <div className="space-y-1">
            {defaultPromptStarters.map((s, i) => (
              <button
                key={i}
                onClick={() => onSelectSuggestedPrompt(s)}
                className="w-full text-left text-xs text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-between group"
              >
                <span className="truncate">{s}</span>
                <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Composer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800/80">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Conductor to build a feature, fix code, or add components..."
            rows={2}
            className="w-full bg-slate-900/90 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 pr-10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors resize-none font-sans"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isGenerating}
            className="absolute right-2.5 bottom-3.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg shadow-sm transition-all"
          >
            {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 px-1">
          <span>Press Enter to send • Shift+Enter for new line</span>
          <span>Powered by Gemini 3.7</span>
        </div>
      </div>
    </div>
  );
};
