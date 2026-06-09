import { type GatewayModelId } from '@ai-sdk/gateway'

export enum Models {
  AnthropicClaudeOpus46 = 'anthropic/claude-opus-4.6',
  AnthropicClaudeSonnet46 = 'anthropic/claude-sonnet-4.6',
  OpenAIGPT53Codex = 'openai/gpt-5.3-codex',
  XaiGrok41Reasoning = 'xai/grok-4.1-fast-reasoning',
}

export const DEFAULT_MODEL = Models.AnthropicClaudeOpus46

export const SUPPORTED_MODELS: GatewayModelId[] = [
  Models.AnthropicClaudeOpus46,
  Models.AnthropicClaudeSonnet46,
  Models.OpenAIGPT53Codex,
  Models.XaiGrok41Reasoning,
]

export const MODEL_NAMES: Record<string, string> = {
  [Models.AnthropicClaudeOpus46]: 'Claude Opus 4.6',
  [Models.AnthropicClaudeSonnet46]: 'Claude Sonnet 4.6',
  [Models.OpenAIGPT53Codex]: 'GPT-5.3 Codex',
  [Models.XaiGrok41Reasoning]: 'Grok 4.1 Reasoning',
}

export const TEST_PROMPTS = [
  'Generate a Next.js app that allows to list and search Pokemons',
  'Create a `golang` server that responds with "Hello World" to any request',
]

/** Starter prompts shown as chips on the new-chat screen. */
export const SUGGESTED_PROMPTS = [
  'Build a Next.js app to list and search Pokémon',
  'Make a landing page for a coffee shop with a contact form',
  'Create a REST API for a todo app backed by SQLite',
  'Build a real-time chat UI in React',
  'Scaffold a Python FastAPI service with a /health endpoint',
  'Create a Go server that responds "Hello World" to any request',
]

/** What the assistant can do — shown to new users on the empty state. */
export interface Skill {
  icon: string // lucide icon name (resolved in the UI)
  title: string
  description: string
}

export const SKILLS: Skill[] = [
  {
    icon: 'Layers',
    title: 'Full-stack apps',
    description:
      'Generate and run complete Next.js, React, or Node apps in a live sandbox.',
  },
  {
    icon: 'Server',
    title: 'Backends & APIs',
    description:
      'Build REST or GraphQL endpoints, wire up a database, and test them.',
  },
  {
    icon: 'Code',
    title: 'Many languages',
    description: 'JavaScript/TypeScript, Python, Go, and more.',
  },
  {
    icon: 'Globe',
    title: 'Live preview',
    description: 'Spin up a sandbox and share a working, public URL.',
  },
  {
    icon: 'Bug',
    title: 'Debugging & fixes',
    description: 'Diagnose errors and iterate until the code runs cleanly.',
  },
  {
    icon: 'Terminal',
    title: 'Run commands',
    description: 'Install packages, run build steps, and execute scripts.',
  },
]

/** Tips for writing prompts that get accurate results. */
export interface PromptTip {
  title: string
  description: string
}

export const PROMPT_TIPS: PromptTip[] = [
  {
    title: 'Be specific about the goal',
    description:
      'Name the framework, language, and the key features you want.',
  },
  {
    title: 'Describe the data and screens',
    description:
      'List the pages, the fields they show, and a couple of example records.',
  },
  {
    title: 'State your constraints',
    description:
      'Mention styling, libraries to use or avoid, and any ports or env vars.',
  },
  {
    title: 'Iterate in small steps',
    description:
      'Start simple, get it running, then ask for one change at a time.',
  },
  {
    title: 'Share errors verbatim',
    description:
      'Paste the exact error message so the fix targets the real problem.',
  },
  {
    title: 'Define what "done" looks like',
    description:
      'e.g. "a search box that filters the list as I type" — a checkable outcome.',
  },
]
