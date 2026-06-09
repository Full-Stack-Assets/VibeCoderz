/**
 * MULTI-PROVIDER LLM CLIENT — fetch-based, zero SDK dependencies.
 *
 * Mirrors the COO Engine's dual-provider proxy: a single `complete()` that talks
 * to Anthropic, OpenAI, or xAI (all OpenAI-compatible except Anthropic) using
 * only `fetch`, meters provider-aware cost, and falls back to a deterministic
 * SIMULATION when no API key is present — so Conductor runs end-to-end with zero
 * configuration, exactly like the COO dashboard's simulation mode.
 */

import { getModel } from './catalog.js';

function hasKey(provider) {
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  if (provider === 'xai') return !!process.env.XAI_API_KEY;
  return false;
}

/**
 * Resolve a single OpenAI-compatible GATEWAY that can reach EVERY catalog model
 * (Anthropic, OpenAI, xAI, Google/Gemini, …) with one key — the catalog ids are
 * already `provider/model`, exactly the slug format these gateways use.
 *   - Vercel AI Gateway  (AI_GATEWAY_API_KEY)
 *   - OpenRouter         (OPENROUTER_API_KEY)
 * Returns null when no gateway key is set (callers use per-provider native keys
 * or simulation). A gateway takes precedence over native provider keys.
 */
export function gatewayConfig(env = process.env) {
  if (env.AI_GATEWAY_API_KEY) {
    return {
      kind: 'vercel',
      baseURL: env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1',
      apiKey: env.AI_GATEWAY_API_KEY,
      headers: {},
    };
  }
  if (env.OPENROUTER_API_KEY) {
    return {
      kind: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: env.OPENROUTER_API_KEY,
      headers: {
        'HTTP-Referer': env.OPENROUTER_SITE_URL || 'https://conductor-xi.vercel.app',
        'X-Title': 'Conductor',
      },
    };
  }
  return null;
}

function meter(model, usage) {
  const p = model?.pricing || { input: 0, output: 0 };
  const input = usage?.input_tokens || 0;
  const output = usage?.output_tokens || 0;
  return Number(((input / 1e6) * p.input + (output / 1e6) * p.output).toFixed(6));
}

// Map a catalog id (e.g. "anthropic/claude-opus-4.6") to the provider's wire id.
function wireModelId(model) {
  const id = model.id.includes('/') ? model.id.split('/').slice(1).join('/') : model.id;
  return id;
}

async function callAnthropic(model, { system, messages, maxTokens }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || wireModelId(model),
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) })),
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, usage: { input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0 } };
}

async function callOpenAICompatible(model, { system, messages, maxTokens }, { baseURL, apiKey, headers = {}, modelName }) {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...headers },
    body: JSON.stringify({
      // Native providers want the bare model id; gateways want the full
      // `provider/model` catalog id. `modelName` overrides when given.
      model: modelName || wireModelId(model),
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) })),
      ],
    }),
  });
  if (!res.ok) throw new Error(`${baseURL} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    usage: { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: data.usage?.completion_tokens || 0 },
  };
}

/**
 * Deterministic simulation used when the chosen model's provider has no key.
 * Produces a contextual, clearly-labelled stub so the product is fully usable
 * (and demos truthfully) without any provider credentials.
 */
export function simulate(model, { messages }) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const ask = (last?.content || '').slice(0, 280);
  const text =
    `**[simulation · ${model.label}]** — no provider key configured, so Conductor ` +
    `is answering in simulation mode.\n\n` +
    `The COO engine routed this turn to **${model.label}** (${model.type}). ` +
    `In live mode this is where ${model.label}'s real completion would stream in.\n\n` +
    `> Your request: ${ask || '(empty)'}\n\n` +
    `Set \`AI_GATEWAY_API_KEY\` (or \`OPENROUTER_API_KEY\`) to switch every model — ` +
    `including this one — to live responses through one gateway.`;
  const usage = { input_tokens: Math.ceil(ask.length / 4) + 40, output_tokens: Math.ceil(text.length / 4) };
  return { text, usage };
}

/**
 * Run a completion on a specific catalog model. Falls back to simulation when
 * the provider key is absent. Returns a unified shape with metered cost.
 *
 * @param {string} modelId   catalog id chosen by the router
 * @param {Object} opts       { system, messages, maxTokens }
 */
export async function complete(modelId, opts = {}) {
  const model = getModel(modelId);
  if (!model) throw new Error(`unknown model ${modelId}`);
  const { system, messages = [], maxTokens = 1024 } = opts;

  // Gateway path: one key reaches every model (incl. Gemini). Takes precedence.
  const gw = gatewayConfig();
  if (gw) {
    const result = await callOpenAICompatible(model, { system, messages, maxTokens }, {
      baseURL: gw.baseURL,
      apiKey: gw.apiKey,
      headers: gw.headers,
      modelName: model.id, // gateways use the full provider/model slug
    });
    return { ...result, model: model.id, provider: `gateway:${gw.kind}`, costUSD: meter(model, result.usage), simulated: false };
  }

  if (!hasKey(model.provider)) {
    const sim = simulate(model, { messages });
    return { ...sim, model: model.id, provider: model.provider, costUSD: meter(model, sim.usage), simulated: true };
  }

  let result;
  if (model.provider === 'anthropic') {
    result = await callAnthropic(model, { system, messages, maxTokens });
  } else if (model.provider === 'openai') {
    result = await callOpenAICompatible(model, { system, messages, maxTokens }, {
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
    });
  } else if (model.provider === 'xai') {
    result = await callOpenAICompatible(model, { system, messages, maxTokens }, {
      baseURL: 'https://api.x.ai/v1',
      apiKey: process.env.XAI_API_KEY,
    });
  } else {
    throw new Error(`no transport for provider ${model.provider}`);
  }

  return { ...result, model: model.id, provider: model.provider, costUSD: meter(model, result.usage), simulated: false };
}
