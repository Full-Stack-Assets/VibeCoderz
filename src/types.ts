export type ModelId = 
  | 'gemini-3.7-flash'
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.1-flash-lite'
  | 'claude-3-7-sonnet'
  | 'gpt-4o'
  | 'deepseek-r1';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface VirtualFile {
  name: string;
  path: string;
  content: string;
  language: string;
  isModified?: boolean;
  isNew?: boolean;
}

export interface FileTreeItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeItem[];
  isOpen?: boolean;
}

export interface ToolCallStep {
  id: string;
  toolName: 'generate_files' | 'run_command' | 'create_sandbox' | 'get_sandbox_url' | 'fix_errors' | 'plan_architecture';
  summary: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: Record<string, any>;
  output?: string;
  timestamp: string;
}

export interface ConductorPlanStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  toolCalls?: ToolCallStep[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  timestamp: string;
  toolCalls?: ToolCallStep[];
  planSteps?: ConductorPlanStep[];
  suggestedPrompts?: string[];
  appliedDiffs?: {
    filePath: string;
    description: string;
  }[];
}

export interface TerminalLog {
  id: string;
  command: string;
  output: string;
  type: 'stdout' | 'stderr' | 'info' | 'success' | 'error';
  timestamp: string;
  exitCode?: number;
}

export interface RuntimeError {
  id: string;
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: string;
  fixed?: boolean;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  badge?: string;
  files: Record<string, string>;
  initialPrompt: string;
}

export interface ConductorSettings {
  model: ModelId;
  reasoningEffort: ReasoningEffort;
  autoFixErrors: boolean;
  autoRunDevServer: boolean;
  streamingSpeed: 'fast' | 'normal' | 'instant';
  sandboxTheme: 'dark' | 'light';
  conductorPlannerEnabled: boolean;
}

export interface AgentMemoryItem {
  id: string;
  key: string;
  value: string;
  category: 'preference' | 'rule' | 'context' | 'stack';
  createdAt: string;
}
