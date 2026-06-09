/**
 * MODEL CATALOG — the pool the COO engine routes across.
 *
 * Each entry is shaped like a COO "agent" so the core router can score it
 * directly: `type` is the model's specialty, `costPerSec` / `maxLatency` are the
 * routing proxies the fitness function reads, and `capability` (0..1) is the
 * quality bar used for capability-gated price arbitrage. `pricing` (USD per 1M
 * tokens) is the authoritative table used to METER real cost after a call.
 *
 * Verify pricing against each provider's current public rates before relying on
 * the metered cost for billing.
 *
 * `multimodal` marks models that accept image input — the router uses it as a
 * capability gate when a turn carries images (see `findBestAgentForTask`).
 */

export const MODEL_CATALOG = [
  {
    id: 'anthropic/claude-opus-4.6',
    label: 'Claude Opus 4.6',
    provider: 'anthropic',
    type: 'reasoning',
    capability: 0.98,
    costPerSec: 0.015,
    maxLatency: 3000,
    multimodal: true,
    pricing: { input: 5, output: 25 },
    blurb: 'Deepest reasoning & architecture. Premium tier. Sees images.',
  },
  {
    id: 'openai/gpt-5.3-codex',
    label: 'GPT-5.3 Codex',
    provider: 'openai',
    type: 'code',
    capability: 0.92,
    costPerSec: 0.012,
    maxLatency: 2000,
    multimodal: true,
    pricing: { input: 2, output: 8 },
    blurb: 'Code generation & refactors specialist. Reads screenshots.',
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    type: 'writing',
    capability: 0.90,
    costPerSec: 0.008,
    maxLatency: 1500,
    multimodal: true,
    pricing: { input: 3, output: 15 },
    blurb: 'Balanced workhorse — fast, capable, cheaper. Sees images.',
  },
  {
    id: 'xai/grok-4.1-fast-reasoning',
    label: 'Grok 4.1 Reasoning',
    provider: 'xai',
    type: 'analysis',
    capability: 0.85,
    costPerSec: 0.006,
    maxLatency: 1200,
    multimodal: false,
    pricing: { input: 0.5, output: 2 },
    blurb: 'Fastest & cheapest. Great for data analysis at scale. Text-only.',
  },
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
    type: 'reasoning',
    capability: 0.93,
    costPerSec: 0.009,
    maxLatency: 1800,
    multimodal: true,
    pricing: { input: 1.25, output: 10 },
    blurb: 'Google’s multimodal reasoner, huge context — cheaper than Opus.',
  },
];

export function getModel(id) {
  return MODEL_CATALOG.find((m) => m.id === id) || null;
}

/** Catalog models that accept image input. */
export function visionModels() {
  return MODEL_CATALOG.filter((m) => m.multimodal);
}

// Build the COO state's agent pool from the catalog. Each model is an always
// "idle" (available) agent the router can pick.
export function modelsAsAgents() {
  return MODEL_CATALOG.map((m) => ({
    id: m.id,
    label: m.label,
    type: m.type,
    provider: m.provider,
    capability: m.capability,
    multimodal: !!m.multimodal,
    costPerSec: m.costPerSec,
    maxLatency: m.maxLatency,
    status: 'idle',
    load: 0,
    health: 1.0,
    retiring: false,
  }));
}
